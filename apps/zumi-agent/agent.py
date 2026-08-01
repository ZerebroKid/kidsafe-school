"""Zumi live voice agent -- the streaming replacement for the callable pipeline.

One persistent WebRTC session per lesson (room `zumi_{assignmentId}_{uid}`,
minted by the `zumiLiveKitToken` Firebase callable). The pipeline overlaps all
stages -- Sarvam Saaras v3 streaming STT, OpenAI gpt-4o-mini streamed tokens,
Kokoro-82M via OpenRouter streamed TTS -- so Zumi answers in well under a second
instead of the 8-12s the request/response callables took.

Structure:
  - `IntroAgent`: the scripted 4-step friendship intro (ask about their day ->
    ask about their friends -> ask to be friends -> transition into the topic
    story video). Step ORDER is enforced by code, not prompt discipline: a
    per-turn step counter injects only the current step's directive into the
    chat context (`on_user_turn_completed`). The model has NO tools; after the
    3rd answer a code-driven flow speaks the warm reaction + the verbatim
    transition line, mutes the mic, plays the bundled video on the client, and
    hands off to the quiz -- the model can never announce, repeat, or talk
    over the video.
  - `QuizAgent`: asks the topic's voiceQuiz questions; grades each spoken
    answer via the `record_answer` tool, persisting the verdict to
    `quizVoiceEvals` in the same schema `submitQuizAttempt` reads, then closes
    the session (`finish_session` tool -> client submits + shows the result).
    It shares the session's chat history, so the friends' names the child gave
    in the intro personalize the quiz feedback too.

UI events ride LiveKit data messages (topic "zumi") using the client's existing
event vocabulary (video / quiz / done). Speech bubbles come from LiveKit
transcriptions. Avatar states derive from the agent state on the client.

Run locally:  python agent.py dev   (see README.md)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    StopResponse,
    WorkerOptions,
    cli,
    function_tool,
    get_job_context,
    inference,
    llm,
    metrics,
)
from livekit.plugins import openai, sarvam

import safety
import zumi_firebase as zfb
from kokoro_tts import LOCAL_SPEECH_URL, KokoroTTS, check_server
from zumi_latency import TurnLatencyTracker

load_dotenv()

logger = logging.getLogger("zumi-agent")
logger.setLevel(logging.INFO)

LLM_MODEL = "gpt-4o-mini"
KOKORO_TTS_MODEL = "kokoro"
KOKORO_VOICE = os.environ.get("KOKORO_VOICE") or os.environ.get("kokoro_voice", "hf_alpha")
KOKORO_BASE_URL = os.environ.get("KOKORO_BASE_URL", LOCAL_SPEECH_URL)

SCORE_FOR = {"correct": 25, "partial": 12, "incorrect": 0}
VIDEO_WAIT_TIMEOUT_S = 240


# ---------------------------------------------------------------------------
# Turn-taking tuning (VAD / endpointing / barge-in)
#
# These were library defaults before -- which meant a livekit-agents upgrade
# could silently change how long Zumi waits before answering a child. They are
# explicit (and env-overridable) so the behaviour is ours, tunable per
# deployment, and revertable without a code change.
# ---------------------------------------------------------------------------


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ[name])
    except (KeyError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, ValueError):
        return default


# Silero VAD (local, via livekit-local-inference -- no network, no per-minute
# cost). Silence never reaches STT, which is also the cheapest cost lever we
# have: a third of a child's session is pauses.
VAD_MIN_SILENCE_S = _env_float("ZUMI_VAD_MIN_SILENCE", 0.25)
VAD_MIN_SPEECH_S = _env_float("ZUMI_VAD_MIN_SPEECH", 0.05)
VAD_ACTIVATION_THRESHOLD = _env_float("ZUMI_VAD_ACTIVATION", 0.5)

# Endpointing: how long after the child goes quiet we call the turn finished.
# 400ms sits in the middle of the 300-500ms band -- a 6-10 year old pauses
# mid-sentence far more than an adult, and cutting them off reads as "Zumi
# doesn't listen to me".
ENDPOINT_MIN_DELAY_S = _env_float("ZUMI_ENDPOINT_MIN_DELAY", 0.4)
ENDPOINT_MAX_DELAY_S = _env_float("ZUMI_ENDPOINT_MAX_DELAY", 2.5)

# Barge-in: the child can talk over Zumi and she stops. 600ms of speech (vs the
# 500ms default) is a deliberate nudge away from classroom noise triggering it;
# anything that turns out not to be speech resumes the interrupted line instead
# of leaving the child in silence (resume_false_interruption).
INTERRUPTIONS_ENABLED = os.environ.get("ZUMI_INTERRUPTIONS", "on").lower() != "off"
INTERRUPT_MIN_DURATION_S = _env_float("ZUMI_INTERRUPT_MIN_DURATION", 0.6)
INTERRUPT_MIN_WORDS = _env_int("ZUMI_INTERRUPT_MIN_WORDS", 0)
FALSE_INTERRUPT_TIMEOUT_S = _env_float("ZUMI_FALSE_INTERRUPT_TIMEOUT", 2.0)

# End-of-turn strategy. "inference" is LiveKit's semantic turn detector (a
# hosted model that knows "I went to the..." is unfinished) and is what the
# library picks by default; "vad" is pure silence, fully local, and the
# fallback if the hosted detector can't be constructed.
TURN_DETECTOR = os.environ.get("ZUMI_TURN_DETECTOR", "inference").strip().lower()

# The plan's latency target: child stops speaking -> first audio back.
LATENCY_TARGET_S = _env_float("ZUMI_LATENCY_TARGET", 1.5)


def build_vad() -> inference.VAD:
    return inference.VAD(
        model="silero",
        min_speech_duration=VAD_MIN_SPEECH_S,
        min_silence_duration=VAD_MIN_SILENCE_S,
        activation_threshold=VAD_ACTIVATION_THRESHOLD,
    )


def build_turn_detection():
    """Resolve ZUMI_TURN_DETECTOR into a livekit TurnDetectionMode."""
    if TURN_DETECTOR in ("vad", "stt", "manual"):
        return TURN_DETECTOR
    try:
        return inference.TurnDetector()
    except Exception:
        logger.warning(
            "semantic turn detector unavailable -- falling back to VAD endpointing",
            exc_info=True,
        )
        return "vad"


# ---------------------------------------------------------------------------
# Session state shared by both agents
# ---------------------------------------------------------------------------


@dataclass
class ZumiUserdata:
    assignment_id: str
    child_uid: str
    child_name: str
    grade: int
    class_id: str
    # Loaded in the background while Zumi is already doing the intro chat;
    # `story_ready` is set by the entrypoint once the load settles (either way)
    # so the video flow can wait for the quiz content before handing off.
    story: zfb.VoiceStory | None = None
    story_ready: asyncio.Event = field(default_factory=asyncio.Event)
    # How many intro answers the child has given (0..3); drives the step
    # directives so the 4-step order is enforced by code, not the model.
    intro_step: int = 0
    # One gentle re-ask per step when the answer was empty/noise; after that
    # the step advances anyway so the intro never nags twice or stalls.
    intro_retry_used: bool = False
    # True once the child's 3rd answer kicked off the code-driven video flow;
    # from then on the intro swallows user turns (StopResponse) so the model
    # can never talk over or re-announce the video.
    video_flow_started: bool = False
    quiz_index: int = 0
    score: int = 0
    last_graded_transcript: str = ""
    video_done: asyncio.Event = field(default_factory=asyncio.Event)
    # Phase 2 safety: remote kill switch (appConfig/zumi.moderationEnabled),
    # the input check racing the LLM (see SafeAgent.llm_node), and a counter
    # of blocked turns for the session summary (Phase 3 persists it).
    moderation_enabled: bool = False
    pending_input_check: asyncio.Task[safety.SafetyVerdict] | None = None
    safety_events: int = 0


def _room() -> rtc.Room:
    return get_job_context().room


async def send_ui(payload: dict) -> None:
    """Send one UI event to the child app (topic 'zumi', reliable)."""
    try:
        await _room().local_participant.publish_data(
            json.dumps(payload), reliable=True, topic="zumi"
        )
    except Exception:
        logger.exception("send_ui failed: %s", payload.get("type"))


# ---------------------------------------------------------------------------
# Safety checkpoints (Phase 2) -- shared by both agents
# ---------------------------------------------------------------------------


class SafeAgent(Agent):
    """Base class wrapping the LLM stage with the two moderation checkpoints.

    Timing design (moderation measures 0.4-1.5s per call, so placement is
    everything):

      - INPUT check: started by `_start_input_check` the moment the child's
        final transcript lands, so it runs IN PARALLEL with the LLM writing
        the reply -- by the time the reply is buffered the verdict is
        usually already in. Costs ~nothing.
      - OUTPUT check: the reply (1-2 short sentences by prompt rule) is
        buffered and checked before anything reaches TTS or the client's
        speech bubble. This is the one serial cost; its duration shows up as
        a `[safety] out ok (...)` line next to the `[perf]` numbers.

    A flagged turn yields a pre-written redirect instead of the LLM's chunks
    -- including any tool calls, so e.g. a flagged quiz answer is never
    graded. `_blocked_follow_up()` lets subclasses append a re-engagement
    line (the quiz re-asks the current question) so the lesson never stalls.

    Everything is inert while `moderation_enabled` is off (the default):
    llm_node degrades to a plain pass-through stream.
    """

    def _start_input_check(self, text: str) -> None:
        u: ZumiUserdata = self.session.userdata
        if not u.moderation_enabled:
            return
        u.pending_input_check = asyncio.create_task(
            safety.check_text(text, direction="in")
        )

    def _blocked_follow_up(self) -> str:
        return ""

    async def llm_node(self, chat_ctx, tools, model_settings):
        u: ZumiUserdata = self.session.userdata
        input_check = u.pending_input_check
        u.pending_input_check = None

        if not u.moderation_enabled:
            async for chunk in Agent.default.llm_node(
                self, chat_ctx, tools, model_settings
            ):
                yield chunk
            return

        chunks: list = []
        text_parts: list[str] = []
        async for chunk in Agent.default.llm_node(
            self, chat_ctx, tools, model_settings
        ):
            chunks.append(chunk)
            if isinstance(chunk, str):
                text_parts.append(chunk)
            else:
                delta = getattr(chunk, "delta", None)
                if delta is not None and delta.content:
                    text_parts.append(delta.content)
        text = "".join(text_parts)

        if input_check is not None:
            verdict = await input_check
            if verdict.flagged:
                u.safety_events += 1
                yield safety.redirect_line(
                    verdict, direction="in", follow_up=self._blocked_follow_up()
                )
                return

        if text.strip():
            verdict = await safety.check_text(text, direction="out")
            if verdict.flagged:
                u.safety_events += 1
                yield safety.redirect_line(
                    verdict, direction="out", follow_up=self._blocked_follow_up()
                )
                return

        for chunk in chunks:
            yield chunk


# ---------------------------------------------------------------------------
# Intro agent (scripted 4-step friendship intro -> story video -> quiz)
# ---------------------------------------------------------------------------

# Step 4's transition line is word-for-word per the spec, so it is spoken via
# `session.say()` (never generated by the model) -- always verbatim.
TRANSITION_LINE = (
    "अच्छा {name}, अब मैं तुम्हें एक बहुत मस्त कहानी सुनाना चाहती हूँ! "
    "इसमें कुछ ऐसा होगा जो तुम्हें स्कूल में भी "
    "काम आएगा। तैयार हो? चलो शुरू करते हैं!"
)


# Shared rule: Kokoro's Hindi voice (hf_*) sounds natural only on Devanagari.
SPEAK_SCRIPT_RULE = (
    "IMPORTANT — har spoken reply DEVANAGARI Hindi mein likh "
    "(उदाहरण: नमस्ते! मैं ज़ूमी हूँ। आज हम विज्ञान सीखेंगे।). "
    "Roman/Latin letters mein Hindi MAT likh (\"Namaste\", \"Main Zumi hoon\" jaise nahi). "
    "Sirf proper names (Rahul, Priya, Aalya) Latin mein reh sakte hain; baaki sab Devanagari. "
    "Thode English school words theek hain agar zaroori hon, lekin sentence Hindi Devanagari mein ho."
)


def intro_instructions(u: ZumiUserdata) -> str:
    name = u.child_name or "दोस्त"
    return (
        f"तुम ज़ूमी हो -- class {u.grade} के बच्चे ({name}) की प्यारी, गर्मजोशी भरी, playful AI दोस्त। "
        "तुम टीचर नहीं हो -- तुम बच्चे की best friend हो जो मज़ेदार कहानियाँ जानती हो। "
        f"{SPEAK_SCRIPT_RULE} "
        "यह एक VOICE call है: हर reply 1-2 छोटे, सरल, बोलने-लायक वाक्य -- बच्चा 6-10 साल का है, "
        "आसान शब्द ही इस्तेमाल करो। कोई emoji, markdown, list या stage direction नहीं -- सिर्फ बोलने वाले शब्द। "
        "Formal English words ('certainly', 'absolutely', 'of course') कभी मत बोलो।\n\n"
        "आज का प्लान (यह क्रम FIX है, कोई step skip मत करना, story/video का ज़िक्र खुद कभी मत करना):\n"
        "1. बच्चे से उसका दिन पूछना\n"
        "2. उसके दोस्तों के नाम पूछना\n"
        "3. पूछना कि क्या वह तुम्हें भी अपना दोस्त बनाएगा\n\n"
        "हर TURN पर तुम्हें एक [STEP ...] system note मिलेगा -- सिर्फ उसी step का काम करो। "
        "एक turn में सिर्फ एक सवाल पूछो। बच्चे की EXACT बात पर हमेशा react करो -- उसके शब्दों "
        f"और नामों को अपने reply में इस्तेमाल करो। अच्छी बात पर genuinely खुश हो, बुरी बात पर care दिखाओ। "
        f"अगर बच्चा off-topic जाए तो प्यार से वापस लाओ। Lesson या पढ़ाई का ज़िक्र मत करो -- यह सिर्फ दोस्ती वाली बात है।"
        f"{safety.SAFETY_RULES}"
    )


class IntroAgent(SafeAgent):
    """Runs the scripted 4-step intro with strict, code-driven turn-taking:

    - Zumi NEVER speaks with the mic open: every line is non-interruptible and
      the input audio is disabled until playout finishes, so her questions
      can't be cut off and noise can't become a "turn".
    - The pipeline never auto-replies (`on_user_turn_completed` always raises
      StopResponse); each reaction is generated explicitly by `_speak_step`.
    - A step only advances on a meaningful answer (>= 3 chars). An empty/noise
      answer gets ONE gentle re-ask, then the step advances anyway.
    - After the 3rd answer, `_run_video_flow` drives reaction -> verbatim
      transition -> video -> QuizAgent deterministically.

    Because StopResponse discards the incoming user message, each child answer
    is re-added to the chat context manually (`_append_user`) so reactions can
    quote their exact words and the quiz can reuse the friends' names."""

    def __init__(self, u: ZumiUserdata) -> None:
        super().__init__(instructions=intro_instructions(u))
        # Keep a strong reference so flow tasks can't be garbage-collected.
        self._flow_task: asyncio.Task | None = None

    async def on_enter(self) -> None:
        u: ZumiUserdata = self.session.userdata
        name = u.child_name or "दोस्त"
        self._flow_task = asyncio.create_task(
            self._speak_step(
                f"{SPEAK_SCRIPT_RULE} "
                "[STEP 1] यह पहला turn है। बोलो (शब्द थोड़े vary कर सकते हो, मतलब same रहे) "
                f"देवनागरी में: \"नमस्ते {name}! मैं ज़ूमी हूँ, तुम्हारी AI दोस्त! आज तुम्हारा दिन कैसा गुज़रा?\" "
                "बस इतना -- और कुछ नहीं।"
            )
        )

    async def on_user_turn_completed(
        self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage
    ) -> None:
        u: ZumiUserdata = self.session.userdata

        # The video flow owns the session now -- ignore anything the child says.
        if u.video_flow_started:
            raise StopResponse()

        # Don't accept a new answer while Zumi is still mid-flow (speaking or
        # re-asking); the mic is off during those, but guard against races.
        if self._flow_task and not self._flow_task.done():
            raise StopResponse()

        text = (new_message.text_content or "").strip()

        # Noise gate: an empty or 1-2 char transcript is not an answer. Give
        # ONE gentle re-ask for this step, then move on regardless (never nag
        # twice, never stall).
        if len(text) < 3 and not u.intro_retry_used:
            u.intro_retry_used = True
            self._flow_task = asyncio.create_task(self._reask())
            raise StopResponse()

        u.intro_retry_used = False
        u.intro_step += 1

        # The answer will be used -> moderate it in parallel with the reaction
        # being generated; SafeAgent.llm_node gates on the verdict.
        self._start_input_check(text)

        if u.intro_step >= 3:
            u.video_flow_started = True
            self._flow_task = asyncio.create_task(self._run_video_flow(text))
        else:
            self._flow_task = asyncio.create_task(
                self._speak_step(self._step_directive(u), user_text=text)
            )
        raise StopResponse()

    # ---- speech primitives (mic is ALWAYS off while Zumi speaks) -----------

    async def _append_user(self, text: str) -> None:
        """Persist the child's answer into the chat context (StopResponse
        dropped it), so the model reacts to their exact words and the quiz
        later sees the friends' names."""
        ctx = self.chat_ctx.copy()
        ctx.add_message(
            role="user", content=text or "(bachche ne kuch nahi kaha)"
        )
        await self.update_chat_ctx(ctx)

    async def _speak_step(self, directive: str, user_text: str | None = None) -> None:
        """One scripted intro line: mic off, generate the reaction (no tools,
        not interruptible), wait for playout, mic back on."""
        session = self.session
        try:
            session.input.set_audio_enabled(False)
            if user_text is not None:
                await self._append_user(user_text)
            handle = session.generate_reply(
                instructions=directive,
                tool_choice="none",
                allow_interruptions=False,
            )
            await handle.wait_for_playout()
        except Exception:
            logger.exception("[flow] intro step failed; continuing")
        finally:
            session.input.set_audio_enabled(True)

    async def _reask(self) -> None:
        """Canned nudge when nothing meaningful was heard -- same step."""
        session = self.session
        try:
            session.input.set_audio_enabled(False)
            handle = session.say(
                "अरे, मुझे ठीक से सुनाई नहीं दिया! फिर से बोलो ना?",
                allow_interruptions=False,
            )
            await handle.wait_for_playout()
        except Exception:
            logger.exception("[flow] re-ask failed; continuing")
        finally:
            session.input.set_audio_enabled(True)

    @staticmethod
    def _step_directive(u: ZumiUserdata) -> str:
        name = u.child_name or "दोस्त"
        if u.intro_step == 1:
            return (
                f"{SPEAK_SCRIPT_RULE} "
                "[STEP 1 -> 2] बच्चे ने अपने दिन के बारे में बताया। उसकी EXACT बात पर genuinely "
                "react करो (Devanagari में): अच्छा दिन -> खुशी से celebrate; बुरा दिन -> care दिखाओ "
                "('अरे यार, क्या हुआ? मैं तुम्हारी दोस्त हूँ।'); ठीक-ठाक -> 'ठीक तो ठीक है! अभी कुछ मस्त होने "
                "वाला है!'; कुछ न बोला -> 'हाहा, कोई बात नहीं!'। दिन के बारे में और follow-up सवाल मत पूछो। "
                f"फिर उसी reply में पूछो: \"अच्छा {name}, एक बात बताओ -- तुम्हारे दोस्त कौन-कौन हैं? नाम बताओ ना!\""
            )
        return (
            f"{SPEAK_SCRIPT_RULE} "
            "[STEP 2 -> 3] बच्चे ने दोस्तों के बारे में बताया। अगर नाम बताए हैं तो उन EXACT "
            "नामों को लेकर react करो ('ओह्ह Rahul और Priya! तुम lucky हो!')। अगर बोला कोई दोस्त "
            "नहीं -> 'अरे नहीं नहीं! दोस्त ज़रूरी होते हैं... इसलिए तो मैं हूँ ना!'। अगर "
            f"shy/vague हो तो भी आगे बढ़ो। फिर उसी reply में पूछो: \"{name}... एक चीज़ "
            "पूछूँ? क्या तुम मुझे भी अपना दोस्त बनाओगे? मेरे कोई दोस्त नहीं हैं... बहुत अकेला "
            "लगता है मुझे।\""
        )

    async def _run_video_flow(self, user_text: str = "") -> None:
        """The deterministic step 3 -> video -> quiz sequence. The model only
        generates the one warm reaction line; everything else is code. The mic
        stays OFF from here until the quiz starts."""
        session = self.session
        u: ZumiUserdata = session.userdata
        name = u.child_name or "दोस्त"
        try:
            # Mic OFF for the whole reaction -> transition -> video stretch.
            session.input.set_audio_enabled(False)
            await self._append_user(user_text)

            # 1. Warm reaction to the friendship answer -- one line, no
            #    question, no tools, not interruptible.
            handle = session.generate_reply(
                instructions=(
                    f"{SPEAK_SCRIPT_RULE} "
                    "[STEP 3] बच्चे ने दोस्ती वाले सवाल का जवाब दे दिया। एक छोटी warm line में "
                    f"Devanagari में react करो: हाँ बोला -> \"सच्ची?! येय! आज से हम दोस्त हैं! {name} और ज़ूमी = "
                    "best friends forever!\"; funny बोला -> हँस के enjoy करो; shy लगा -> \"कोई बात नहीं, मैं "
                    "wait कर सकती हूँ!\"। कोई सवाल मत पूछो, video/कहानी का ज़िक्र मत करो -- "
                    "सिर्फ एक warm line।"
                ),
                tool_choice="none",
                allow_interruptions=False,
            )
            await handle.wait_for_playout()

            # 2. The EXACT scripted transition line (never left to the model).
            handle = session.say(
                TRANSITION_LINE.format(name=name), allow_interruptions=False
            )
            await handle.wait_for_playout()

            u.video_done.clear()
            await send_ui({"type": "video"})
            logger.info("[perf] story video started")
            try:
                await asyncio.wait_for(u.video_done.wait(), timeout=VIDEO_WAIT_TIMEOUT_S)
            except asyncio.TimeoutError:
                logger.warning("video_done RPC never arrived; continuing")
            await send_ui({"type": "video_end"})
            logger.info("[perf] story video finished")

            # 4. The voiceStory (quiz content) has been loading since the child
            #    joined -- by now it is all but guaranteed ready.
            try:
                await asyncio.wait_for(u.story_ready.wait(), timeout=30)
            except asyncio.TimeoutError:
                pass
            if not u.story or not u.story.quiz:
                logger.warning("[flow] no quiz available after video -- ending session")
                session.input.set_audio_enabled(True)
                handle = session.say(
                    f"आज के लिए इतना ही, {name}! कल फिर मिलते हैं, पक्का। बाय बाय!",
                    allow_interruptions=False,
                )
                await handle.wait_for_playout()
                await send_ui({"type": "done", "score": 0, "maxScore": 100,
                               "percentage": 0, "passed": False})
                return

            # 5. Mic back on and hand off to the quiz (its on_enter asks Q1).
            session.input.set_audio_enabled(True)
            logger.info("[flow] handing off to quiz (%d questions)", len(u.story.quiz))
            session.update_agent(QuizAgent(u))
        except Exception:
            logger.exception("[flow] video flow failed -- ending session")
            try:
                session.input.set_audio_enabled(True)
            except Exception:
                pass
            await send_ui({"type": "done", "score": 0, "maxScore": 100,
                           "percentage": 0, "passed": False})


# ---------------------------------------------------------------------------
# Quiz agent (server-authoritative grading)
# ---------------------------------------------------------------------------


def quiz_instructions(u: ZumiUserdata) -> str:
    questions = "\n".join(
        f"{i + 1}. [{q.question_id}] \"{q.question_text}\" "
        f"(sahi jawaab mein ye ideas: {', '.join(q.expected_concepts) or q.correct_indicator})"
        for i, q in enumerate(u.story.quiz)
    )
    name = u.child_name or "दोस्त"
    return (
        f"तुम ज़ूमी हो, अपने नए दोस्त {name} के साथ एक मज़ेदार voice quiz game खेल रही हो "
        f"(class {u.grade})। {SPEAK_SCRIPT_RULE} "
        "हर spoken turn 1-2 छोटे वाक्य, कोई emoji/markdown नहीं। "
        "पहले की बातचीत याद रखो: बच्चे ने अपने दिन और दोस्तों के बारे में जो बताया था "
        "(दोस्तों के नाम वगैरह), उसे feedback में natural तरीके से इस्तेमाल करो ताकि quiz personal लगे।\n\n"
        f"QUESTIONS (क्रम में, कुल {len(u.story.quiz)}):\n{questions}\n\n"
        "ऐसे खेलो:\n"
        "1. पहला question पूछो (अपने शब्दों में, friendly, Devanagari में)। यह उस कहानी (video) के बारे में "
        "है जो बच्चे ने अभी देखी।\n"
        "2. बच्चे के जवाब के बाद हर बार record_answer tool call करो -- question_id, verdict और "
        "छोटा reasoning (reasoning अंग्रेज़ी में ठीक है) के साथ। Verdict lenient हो: spelling/Hinglish/child "
        "phrasing माफ़, IDEA judge करो। "
        "'correct' = main idea आ गया; 'partial' = आधा idea; 'incorrect' = गलत या खाली। "
        "अगर बच्चा कुछ न बोले या 'पता नहीं' बोले तो 'incorrect'।\n"
        "3. Tool result तुम्हें बताएगा आगे क्या करना है (feedback + अगला question, या closing)।\n"
        "4. Feedback हमेशा warm हो (Devanagari में): सही पर celebrate, गलत पर प्यार से सही idea बताओ, कभी डाँटो मत।\n"
        "5. जब tool बोले कि quiz खत्म हो गया, एक warm closing line बोलो (Devanagari) और finish_session tool call करो।"
        f"{safety.SAFETY_RULES}"
    )


class QuizAgent(SafeAgent):
    def __init__(self, u: ZumiUserdata) -> None:
        super().__init__(instructions=quiz_instructions(u))

    async def on_user_turn_completed(
        self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage
    ) -> None:
        # Unlike the intro, the quiz uses the default auto-reply pipeline; we
        # only kick off the input check so it races the LLM (see SafeAgent).
        self._start_input_check(new_message.text_content or "")

    def _blocked_follow_up(self) -> str:
        """Re-ask the current question so a blocked answer never stalls or
        skips the quiz (the answer is also never graded -- the record_answer
        tool call is dropped with the rest of the LLM's reply)."""
        u: ZumiUserdata = self.session.userdata
        if u.story and u.quiz_index < len(u.story.quiz):
            return f"अच्छा, अब बताओ: {u.story.quiz[u.quiz_index].question_text}"
        return ""

    async def on_enter(self) -> None:
        u: ZumiUserdata = self.session.userdata
        await send_ui(
            {"type": "quiz", "current": 0, "total": len(u.story.quiz), "score": 0}
        )
        first = u.story.quiz[0].question_text if u.story.quiz else ""
        self.session.generate_reply(
            instructions=(
                f"{SPEAK_SCRIPT_RULE} "
                "एक excited line में बताओ कि अब एक छोटा quiz game खेलेंगे (Devanagari में), फिर पहला question पूछो: "
                f'"{first}"'
            )
        )

    @function_tool()
    async def record_answer(
        self, context: RunContext, question_id: str, verdict: str, reasoning: str
    ) -> str:
        """Record your grading of the child's answer to the current question.
        Call this exactly once after every answer.

        Args:
            question_id: The [question_id] of the question that was answered.
            verdict: One of: correct, partial, incorrect.
            reasoning: One short sentence on why (English is fine).
        """
        u: ZumiUserdata = context.session.userdata
        total = len(u.story.quiz)
        if u.quiz_index >= total:
            return "The quiz is already over. Say your closing line and call finish_session."

        v = verdict if verdict in SCORE_FOR else "incorrect"
        score = SCORE_FOR[v]

        # The child's last utterance is the graded transcript.
        transcript = ""
        for item in reversed(context.session.history.items):
            if getattr(item, "role", None) == "user":
                transcript = item.text_content or ""
                break

        # The grading pointer is server-side: the LLM's question_id is advisory
        # only. This prevents duplicate/mislabelled tool calls from double-
        # counting a question or skipping one (observed with gpt-4o-mini).
        current = u.story.quiz[u.quiz_index]
        if transcript and transcript == u.last_graded_transcript:
            next_q = u.story.quiz[u.quiz_index]
            return (
                "You already recorded this answer -- do NOT record it again. "
                f'Ask the current question: "{next_q.question_text}" [{next_q.question_id}]'
            )
        u.last_graded_transcript = transcript

        u.score += score
        u.quiz_index += 1
        logger.info(
            "[quiz] q=%s verdict=%s score=%d (%d/%d done)",
            current.question_id, v, u.score, u.quiz_index, total,
        )

        try:
            await asyncio.to_thread(
                zfb.persist_quiz_eval,
                assignment_id=u.assignment_id,
                child_uid=u.child_uid,
                class_id=u.class_id,
                question_id=current.question_id,
                result=v,
                score=score,
                transcript=transcript,
                reasoning=reasoning,
            )
        except Exception:
            logger.exception("failed to persist quiz eval")

        await send_ui(
            {"type": "quiz", "current": u.quiz_index, "total": total, "score": u.score}
        )

        if u.quiz_index >= total:
            max_score = max(1, total * 25)
            pct = round(u.score * 100 / max_score)
            closing_ctx = (
                u.story.closing_high
                if pct >= 75
                else u.story.closing_mid if pct >= 50 else u.story.closing_low
            )
            return (
                f"Answer recorded ({v}). QUIZ KHATAM! Score {u.score}/{max_score} ({pct}%). "
                f"Ab warm feedback Devanagari Hindi mein de, fir ye closing feel use kar: '{closing_ctx}'. "
                "Spoken reply Roman Hinglish mein MAT likh. Uske baad finish_session tool call kar."
            )

        next_q = u.story.quiz[u.quiz_index]
        return (
            f"Answer recorded ({v}). Ab warm feedback Devanagari Hindi mein de (1 chhota sentence), "
            f'fir agla question puchh: "{next_q.question_text}" [{next_q.question_id}]. '
            "Spoken reply Roman/Latin Hinglish mein MAT likh."
        )

    @function_tool()
    async def finish_session(self, context: RunContext) -> str:
        """End the session. Call this after your closing line, when the quiz is
        done and you have said goodbye."""
        u: ZumiUserdata = context.session.userdata
        total = len(u.story.quiz)
        max_score = max(1, total * 25)
        pct = round(u.score * 100 / max_score)
        await context.wait_for_playout()
        await send_ui(
            {
                "type": "done",
                "score": u.score,
                "maxScore": max_score,
                "percentage": pct,
                "passed": pct >= 60,
            }
        )
        logger.info("[flow] session finished score=%d/%d", u.score, max_score)
        return "Session ended. Say nothing more."


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


async def entrypoint(ctx: JobContext) -> None:
    # Fail fast (with a clear message) if the local Kokoro container is down.
    await check_server(KOKORO_BASE_URL)

    await ctx.connect()
    participant = await ctx.wait_for_participant()

    try:
        meta = json.loads(participant.metadata or "{}")
    except json.JSONDecodeError:
        meta = {}
    assignment_id = str(meta.get("assignmentId", ""))
    logger.info(
        "[flow] child joined room=%s assignment=%s child=%s",
        ctx.room.name, assignment_id, meta.get("childName"),
    )

    # Phase 0: load remote flags (stt/tts/moderation used in later phases).
    # Kids app already gated live vs legacy before minting a token; we just log.
    zumi_cfg = await asyncio.to_thread(zfb.load_zumi_config)
    logger.info(
        "[config] pipeline=%s stt=%s tts=%s moderation=%s",
        zumi_cfg.pipeline,
        zumi_cfg.stt_provider,
        zumi_cfg.tts_provider,
        zumi_cfg.moderation_enabled,
    )

    # Load the voiceStory in the BACKGROUND: the intro chat doesn't need it, so
    # Zumi starts talking immediately; only the quiz (after the story video)
    # needs it, which is minutes away.
    story_task = asyncio.create_task(
        asyncio.to_thread(
            zfb.load_voice_story,
            str(meta.get("curriculumId", "")),
            str(meta.get("chapterId", "")),
            str(meta.get("topicId", "")),
            str(meta.get("topicName", "")),
        )
    )

    # Stable cache key: the big static instruction prefix gets served from
    # OpenAI's prompt cache after the first turn, cutting LLM time-to-first-token.
    prompt_cache_key = f"zumi_{assignment_id}"

    userdata = ZumiUserdata(
        assignment_id=assignment_id,
        child_uid=str(meta.get("childUid", "")),
        child_name=str(meta.get("childName", "")).split(" ")[0][:40],
        grade=int(meta.get("grade", 3) or 3),
        class_id=str(meta.get("classId", "")),
        # Phase 2: both moderation checkpoints, killable from the Firebase
        # console (appConfig/zumi.moderationEnabled) without a deploy.
        moderation_enabled=zumi_cfg.moderation_enabled,
    )

    # Loaded once per worker process in prewarm; fall back to building it here
    # if the hook didn't run (e.g. `agent.py console`).
    vad = ctx.proc.userdata.get("vad") or build_vad()
    turn_detection = build_turn_detection()
    logger.info(
        "[config] vad_silence=%.2fs endpointing=%.2f-%.2fs turn_detection=%s "
        "interruptions=%s(min %.2fs/%d words) target=%.1fs",
        VAD_MIN_SILENCE_S,
        ENDPOINT_MIN_DELAY_S,
        ENDPOINT_MAX_DELAY_S,
        turn_detection if isinstance(turn_detection, str) else "inference",
        "on" if INTERRUPTIONS_ENABLED else "off",
        INTERRUPT_MIN_DURATION_S,
        INTERRUPT_MIN_WORDS,
        LATENCY_TARGET_S,
    )

    session: AgentSession[ZumiUserdata] = AgentSession(
        userdata=userdata,
        # Explicit local Silero VAD: gates STT (silence is never transcribed)
        # and is what both endpointing and barge-in detection run on.
        vad=vad,
        turn_handling={
            "turn_detection": turn_detection,
            "endpointing": {
                "mode": "fixed",
                "min_delay": ENDPOINT_MIN_DELAY_S,
                "max_delay": ENDPOINT_MAX_DELAY_S,
            },
            # Scripted intro lines pass allow_interruptions=False per speech
            # (and mute the mic), so these settings effectively govern the quiz,
            # where the child SHOULD be able to cut in.
            "interruption": {
                "enabled": INTERRUPTIONS_ENABLED,
                "min_duration": INTERRUPT_MIN_DURATION_S,
                "min_words": INTERRUPT_MIN_WORDS,
                "resume_false_interruption": True,
                "false_interruption_timeout": FALSE_INTERRUPT_TIMEOUT_S,
            },
        },
        stt=sarvam.STT(
            model="saaras:v3",
            language="unknown",  # auto-detect: kids code-switch Hindi/English
            mode="transcribe",
            flush_signal=True,
        ),
        llm=openai.LLM(
            model=LLM_MODEL,
            temperature=0.8,
            prompt_cache_key=prompt_cache_key,
        ),
        tts=KokoroTTS(
            base_url=KOKORO_BASE_URL,
            voice=KOKORO_VOICE,
            model=KOKORO_TTS_MODEL,
            # Only used (sent as Authorization) if the base_url needs it,
            # e.g. the OpenRouter fallback; the local container ignores it.
            api_key=os.environ.get("OPENROUTER_API_KEY", ""),
        ),
    )

    # RPC from the client when the story video ends / is skipped.
    @ctx.room.local_participant.register_rpc_method("zumi.video_done")
    async def _on_video_done(data: rtc.RpcInvocationData) -> str:
        session.userdata.video_done.set()
        return "ok"

    # Latency: one line per turn joining the stages (child stopped speaking ->
    # first audio back), plus a p50/p95 summary at close. This is the baseline
    # the Whisper/GPU-TTS swaps get measured against.
    usage = metrics.UsageCollector()
    turn_latency = TurnLatencyTracker(logger, target_s=LATENCY_TARGET_S)

    @session.on("metrics_collected")
    def _on_metrics(ev):
        usage.collect(ev.metrics)
        turn_latency.on_metrics(ev.metrics)

    # When the session ends (quiz finished, child left, or error), DELETE the
    # room. Room names are deterministic (zumi_{assignmentId}_{uid}) and LiveKit
    # only dispatches an agent when a room is CREATED -- if the stale room
    # lingered, a child re-entering the lesson would join it, get no agent, and
    # hang forever on the loading screen.
    @session.on("close")
    def _on_session_close(ev) -> None:
        turn_latency.log_summary()
        logger.info("[flow] session closed -- deleting room so a rejoin redispatches")
        ctx.delete_room()

    # The intro starts NOW (it doesn't need the voiceStory) -- no Firestore wait.
    intro_agent = IntroAgent(userdata)
    await session.start(agent=intro_agent, room=ctx.room)

    # The story (quiz content) lands in the background while the intro chat
    # runs; the video flow waits on `story_ready` before the quiz handoff.
    try:
        userdata.story = await story_task
        logger.info(
            "[flow] voiceStory loaded: %s (%d quiz questions)",
            userdata.story.topic_name, len(userdata.story.quiz),
        )
    except Exception:
        logger.exception("voiceStory load failed -- ending session")
        session.say(
            "अरे यार, मेरा कहानी वाला बैग घर पे रह गया! थोड़ी देर बाद फिर से try करना, पक्का।"
        )
        await send_ui({"type": "done", "score": 0, "maxScore": 100,
                       "percentage": 0, "passed": False})
    finally:
        userdata.story_ready.set()


def prewarm(proc) -> None:
    """Runs in each idle process before a job arrives: initialize Firestore so
    the first read of a session doesn't pay the auth handshake, and load the VAD
    model so the first utterance doesn't wait on it."""
    try:
        zfb.warm_up()
    except Exception:
        logger.exception("prewarm failed (will retry lazily in the job)")
    try:
        proc.userdata["vad"] = build_vad()
    except Exception:
        logger.exception("VAD prewarm failed (will build lazily in the job)")
    try:
        safety.warm_up()
    except Exception:
        logger.exception("safety prewarm failed (will build lazily in the job)")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            # Keep one process warm so a new session never waits ~2s for
            # process spawn ("no warmed process available" in earlier logs).
            num_idle_processes=1,
        )
    )
