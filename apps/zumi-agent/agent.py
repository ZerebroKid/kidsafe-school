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
import time
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
    stt,
    tts,
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
# af_heart: Kokoro's best English voice (warm female) -- English-only pass.
# The old Hindi voice was hf_alpha; restore it for the Hinglish phase.
KOKORO_VOICE = os.environ.get("KOKORO_VOICE") or os.environ.get("kokoro_voice", "af_heart")
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

# Phase 5: self-hosted Whisper STT (the speaches server on the GPU VM, see
# infra/RUNBOOK.md). The PROVIDER is chosen remotely (appConfig/zumi
# .sttProvider: "sarvam" | "whisper") so rollback is a console edit; the URL
# is deployment config and lives here because it changes when the VM restarts
# (ephemeral external IP). Must point at the OpenAI-compatible root, e.g.
# http://<vm-ip>:8000/v1 -- empty means whisper is unavailable on this worker.
WHISPER_URL = os.environ.get("ZUMI_WHISPER_URL", "").strip()
# English-only for now (the product decision; Hinglish later). The .en model
# is English-specialized -- faster and more accurate for English speech, and
# it handles Indian-accented English well (accent robustness lives in the
# model; there is no separate accent setting). For the future Hinglish phase,
# switch to the multilingual "Systran/faster-whisper-medium" + language "hi".
WHISPER_MODEL = os.environ.get("ZUMI_WHISPER_MODEL", "Systran/faster-whisper-medium.en")
# Language hint; empty = let Whisper auto-detect per utterance.
WHISPER_LANGUAGE = os.environ.get("ZUMI_WHISPER_LANGUAGE", "en").strip()

# Phase 6: GPU Kokoro (the same VM as Whisper, port 8880 -- see
# infra/RUNBOOK.md). Like ZUMI_WHISPER_URL this is deployment config, not a
# remote flag: the spot VM's external IP changes on every start. The PROVIDER
# is chosen remotely (appConfig/zumi.ttsProvider: "kokoro-cpu" | "kokoro-gpu").
# Must be the full speech endpoint, e.g. http://<vm-ip>:8880/v1/audio/speech
# -- empty means the GPU is unavailable on this worker.
KOKORO_GPU_URL = os.environ.get("ZUMI_KOKORO_GPU_URL", "").strip()


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


def build_sarvam_stt() -> stt.STT:
    """Managed Sarvam STT."""
    return sarvam.STT(
        model="saaras:v3",
        # English-only pass: hint English so Indian-accented English is not
        # misread as Hindi. Switch back to "unknown" for the Hinglish phase.
        language="en-IN",
        mode="transcribe",
        flush_signal=True,
    )


def build_openai_whisper_stt(vad: inference.VAD) -> stt.STT:
    """OpenAI hosted Whisper STT (model whisper-1) using OPENAI_API_KEY."""
    whisper = openai.STT(
        model="whisper-1",
        api_key=os.environ.get("OPENAI_API_KEY"),
        language=WHISPER_LANGUAGE or "en",
    )
    return stt.StreamAdapter(stt=whisper, vad=vad)


def build_stt(provider: str, vad: inference.VAD) -> stt.STT:
    """Select the STT stage.

    Uses OpenAI Whisper STT if Sarvam is not configured or if provider is whisper/openai.
    """
    sarvam_key = os.environ.get("SARVAM_API_KEY", "").strip()
    has_sarvam = bool(sarvam_key and not sarvam_key.startswith("sk_xxx") and not sarvam_key.startswith("sk_xxxx"))

    if provider in ("whisper", "openai") or not has_sarvam:
        if WHISPER_URL:
            whisper = openai.STT(
                model=WHISPER_MODEL,
                base_url=WHISPER_URL,
                api_key=os.environ.get("OPENAI_API_KEY") or "speaches",
                language=WHISPER_LANGUAGE or "en",
                detect_language=not WHISPER_LANGUAGE,
            )
            fallback = build_sarvam_stt() if has_sarvam else build_openai_whisper_stt(vad)
            return stt.FallbackAdapter([whisper, fallback], vad=vad)

        logger.info("[config] using OpenAI Whisper STT (whisper-1)")
        return build_openai_whisper_stt(vad)

    return build_sarvam_stt()


def build_cpu_kokoro() -> KokoroTTS:
    """Today's TTS -- the default provider and the GPU fallback."""
    return KokoroTTS(
        base_url=KOKORO_BASE_URL,
        voice=KOKORO_VOICE,
        model=KOKORO_TTS_MODEL,
        # Only used (sent as Authorization) if the base_url needs it,
        # e.g. the OpenRouter fallback; the local container ignores it.
        api_key=os.environ.get("OPENROUTER_API_KEY", ""),
    )


def build_tts(provider: str) -> tts.TTS:
    """Select the TTS stage from the remote `ttsProvider` flag (Phase 6).

    "kokoro-gpu" = the same Kokoro-FastAPI server, GPU build, on the Phase 4
    VM (~0.5s per sentence vs ~2.6s on CPU). Both endpoints are per-sentence
    (non-streaming) backends, so the FallbackAdapter also reports
    streaming=False and AgentSession wraps the whole thing in its sentence
    StreamAdapter -- synthesis starts on the first LLM sentence either way.
    A stopped/unreachable GPU VM degrades to exactly today's CPU pipeline.
    """
    if provider == "kokoro-gpu":
        if not KOKORO_GPU_URL:
            logger.warning(
                "[config] ttsProvider=kokoro-gpu but ZUMI_KOKORO_GPU_URL is "
                "not set -- using kokoro-cpu"
            )
            return build_cpu_kokoro()
        gpu = KokoroTTS(
            base_url=KOKORO_GPU_URL,
            voice=KOKORO_VOICE,
            model=KOKORO_TTS_MODEL,
        )
        return tts.FallbackAdapter([gpu, build_cpu_kokoro()])
    return build_cpu_kokoro()


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
    # Phase 3: what Zumi remembers from the child's previous session (loaded
    # in the background at start), plus fields the session summary needs.
    memory: zfb.SessionMemory | None = None
    topic_name: str = ""
    finished: bool = False


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
    "Okay {name}, now I want to show you a really cool story! "
    "There's something in it that will help you at school too. "
    "Ready? Let's go!"
)


# Shared rule: English-only pass (the Kokoro voice is an English one, af_*).
# Kids are 6-10 year old Indian school children -- keep the words simple.
SPEAK_SCRIPT_RULE = (
    "IMPORTANT — speak in simple, warm, everyday ENGLISH only. "
    "Never write Hindi (no Devanagari, no romanized Hindi like 'Namaste yaar'). "
    "Use short, easy words an Indian school kid knows; proper names (Rahul, "
    "Priya, Aalya) stay as they are. Never use big formal words "
    "('certainly', 'absolutely', 'furthermore')."
)


def memory_note(u: ZumiUserdata) -> str:
    """Cross-session recall for the intro prompt (Phase 3).

    Only the CHILD's own words from the last session are surfaced (their day,
    their friends' names) -- Zumi's old lines add nothing. Kept to a few short
    quotes so the prompt stays cheap and the model can't recite a transcript.
    """
    mem = u.memory
    if not mem:
        return ""
    child_lines = [
        t["text"][:100] for t in mem.turns if t.get("role") == "user"
    ][-4:]
    if not child_lines:
        return ""
    quoted = "; ".join(f"'{line}'" for line in child_lines)
    topic = mem.topic_name or "a topic"
    return (
        f"\n\nMEMORY from your last chat (the {topic} session) -- the child "
        f"said these things: {quoted}. You are their old friend: use these "
        "naturally where it fits (like asking about their friends by name). "
        "Do NOT recite them like a list, and you don't have to mention "
        "everything."
    )


def intro_instructions(u: ZumiUserdata) -> str:
    name = u.child_name or "friend"
    return (
        f"You are Zumi -- the sweet, warm, playful AI friend of {name}, a "
        f"class {u.grade} kid. You are NOT a teacher -- you are the child's "
        "best friend who knows fun stories. "
        f"{SPEAK_SCRIPT_RULE} "
        "This is a VOICE call: every reply is 1-2 short, simple, speakable "
        "sentences -- the child is 6-10 years old, use easy words. No emoji, "
        "markdown, lists or stage directions -- only spoken words.\n\n"
        "Today's plan (this order is FIXED, never skip a step, never mention "
        "the story/video yourself):\n"
        "1. Ask the child about their day\n"
        "2. Ask for their friends' names\n"
        "3. Ask if they will make you their friend too\n\n"
        "Every TURN you get a [STEP ...] system note -- do only that step's "
        "job. Ask only one question per turn. Always react to the child's "
        "EXACT words -- reuse their words and names in your reply. Be "
        "genuinely happy about good things, show care about bad things. "
        "If the child goes off-topic, gently bring them back. Never mention "
        "lessons or studying -- this is just friends talking."
        f"{memory_note(u)}"
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
        name = u.child_name or "friend"
        self._flow_task = asyncio.create_task(
            self._speak_step(
                f"{SPEAK_SCRIPT_RULE} "
                "[STEP 1] This is the very first turn. Say (you may vary the "
                "words slightly, keep the meaning): "
                f"\"Hi {name}! I'm Zumi, your AI friend! How was your day today?\" "
                "That's all -- nothing else."
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
            role="user", content=text or "(the child said nothing)"
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
                "Oh, I couldn't hear you properly! Can you say that again?",
                allow_interruptions=False,
            )
            await handle.wait_for_playout()
        except Exception:
            logger.exception("[flow] re-ask failed; continuing")
        finally:
            session.input.set_audio_enabled(True)

    @staticmethod
    def _step_directive(u: ZumiUserdata) -> str:
        name = u.child_name or "friend"
        if u.intro_step == 1:
            return (
                f"{SPEAK_SCRIPT_RULE} "
                "[STEP 1 -> 2] The child told you about their day. React "
                "genuinely to their EXACT words: good day -> celebrate "
                "happily; bad day -> show care ('Oh no, what happened? I'm "
                "your friend, you can tell me.'); just okay -> 'Okay is "
                "fine! Something fun is coming!'; said nothing -> 'Haha, no "
                "problem!'. Do NOT ask any follow-up question about the day. "
                f"Then, in the SAME reply, ask: \"So {name}, tell me one "
                "thing -- who are your friends? Tell me their names!\""
            )
        return (
            f"{SPEAK_SCRIPT_RULE} "
            "[STEP 2 -> 3] The child told you about their friends. If they "
            "gave names, react using those EXACT names ('Ohh Rahul and "
            "Priya! You're so lucky!'). If they said they have no friends -> "
            "'Oh no no! Friends matter so much... that's why I'm here!'. If "
            "they were shy or vague, still move on. Then, in the SAME "
            f"reply, ask: \"{name}... can I ask you something? Will you make "
            "me your friend too? I don't have any friends... I feel really "
            "lonely.\""
        )

    async def _run_video_flow(self, user_text: str = "") -> None:
        """The deterministic step 3 -> video -> quiz sequence. The model only
        generates the one warm reaction line; everything else is code. The mic
        stays OFF from here until the quiz starts."""
        session = self.session
        u: ZumiUserdata = session.userdata
        name = u.child_name or "friend"
        try:
            # Mic OFF for the whole reaction -> transition -> video stretch.
            session.input.set_audio_enabled(False)
            await self._append_user(user_text)

            # 1. Warm reaction to the friendship answer -- one line, no
            #    question, no tools, not interruptible.
            handle = session.generate_reply(
                instructions=(
                    f"{SPEAK_SCRIPT_RULE} "
                    "[STEP 3] The child answered the friendship question. "
                    "React with ONE short warm line: said yes -> \"Really?! "
                    f"Yay! From today we're friends! {name} and Zumi = best "
                    "friends forever!\"; said something funny -> laugh and "
                    "enjoy it; seemed shy -> \"No problem, I can wait!\". "
                    "Ask no question, do not mention the video or story -- "
                    "just one warm line."
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
                    f"That's all for today, {name}! See you tomorrow, promise. Bye bye!",
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
        f"(a good answer has these ideas: {', '.join(q.expected_concepts) or q.correct_indicator})"
        for i, q in enumerate(u.story.quiz)
    )
    name = u.child_name or "friend"
    return (
        f"You are Zumi, playing a fun voice quiz game with your new friend "
        f"{name} (class {u.grade}). {SPEAK_SCRIPT_RULE} "
        "Every spoken turn is 1-2 short sentences, no emoji/markdown. "
        "Remember the earlier conversation: what the child told you about "
        "their day and their friends (names etc.) -- weave it naturally into "
        "your feedback so the quiz feels personal.\n\n"
        f"QUESTIONS (in order, {len(u.story.quiz)} total):\n{questions}\n\n"
        "How to play:\n"
        "1. Ask the first question (in your own words, friendly). It is "
        "about the story (video) the child just watched. If a question's "
        "text is not in English, ask it in simple English (keep the exact "
        "same meaning).\n"
        "2. After every answer, call the record_answer tool with "
        "question_id, verdict and a short reasoning. Be LENIENT: forgive "
        "spelling/phrasing/accent artifacts in the transcript, judge the "
        "IDEA. 'correct' = main idea is there; 'partial' = half the idea; "
        "'incorrect' = wrong or empty. If the child says nothing or 'I "
        "don't know', use 'incorrect'.\n"
        "3. The tool result tells you what to do next (feedback + next "
        "question, or closing).\n"
        "4. Feedback is always warm: celebrate correct answers, lovingly "
        "give the right idea for wrong ones, never scold.\n"
        "5. When the tool says the quiz is over, say one warm closing line "
        "and call the finish_session tool."
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
            return f"Okay, now tell me: {u.story.quiz[u.quiz_index].question_text}"
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
                "In ONE excited line, say you're going to play a little quiz "
                f'game now, then ask the first question: "{first}" '
                "(if that question is not in English, ask it in simple "
                "English with the same meaning)"
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
                f"Answer recorded ({v}). THE QUIZ IS OVER! Score {u.score}/{max_score} ({pct}%). "
                f"Give warm feedback in simple English, using this closing feel: '{closing_ctx}'. "
                "Then call the finish_session tool."
            )

        next_q = u.story.quiz[u.quiz_index]
        return (
            f"Answer recorded ({v}). Give warm feedback in simple English (1 short sentence), "
            f'then ask the next question: "{next_q.question_text}" [{next_q.question_id}].'
        )

    @function_tool()
    async def finish_session(self, context: RunContext) -> str:
        """End the session. Call this after your closing line, when the quiz is
        done and you have said goodbye."""
        u: ZumiUserdata = context.session.userdata
        u.finished = True
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
    # It is the guaranteed TTS fallback, so a session must never start
    # without it.
    await check_server(KOKORO_BASE_URL)

    # The GPU endpoint is optional: probe it in the background purely for the
    # logs (an unreachable GPU just means the FallbackAdapter uses CPU).
    # Keep the task reference on ctx.proc.userdata so it isn't GC'd mid-probe.
    if KOKORO_GPU_URL:
        async def _probe_gpu() -> None:
            try:
                await check_server(KOKORO_GPU_URL)
                logger.info("[config] GPU Kokoro reachable at %s", KOKORO_GPU_URL)
            except Exception:
                logger.warning(
                    "[config] GPU Kokoro NOT reachable at %s -- TTS will fall "
                    "back to CPU (%s)",
                    KOKORO_GPU_URL,
                    KOKORO_BASE_URL,
                )
        ctx.proc.userdata["gpu_probe"] = asyncio.create_task(_probe_gpu())

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

    child_uid = str(meta.get("childUid", ""))
    started_at_ms = int(time.time() * 1000)

    # Phase 0 config + Phase 3 memory: two independent Firestore reads, run
    # concurrently so session start pays for the slower one only.
    cfg_task = asyncio.create_task(asyncio.to_thread(zfb.load_zumi_config))
    memory_task = asyncio.create_task(asyncio.to_thread(zfb.load_memory, child_uid))

    zumi_cfg = await cfg_task
    logger.info(
        "[config] pipeline=%s stt=%s tts=%s moderation=%s memory=%s",
        zumi_cfg.pipeline,
        zumi_cfg.stt_provider,
        zumi_cfg.tts_provider,
        zumi_cfg.moderation_enabled,
        zumi_cfg.memory_enabled,
    )

    # Last-session recall for the intro prompt. Best-effort: a slow/failed
    # read must never delay Zumi's first word, so cap the wait.
    memory: zfb.SessionMemory | None = None
    if zumi_cfg.memory_enabled:
        try:
            memory = await asyncio.wait_for(memory_task, timeout=2)
            if memory:
                logger.info(
                    "[flow] memory loaded: %d turns from '%s'",
                    len(memory.turns), memory.topic_name,
                )
        except Exception:
            logger.warning("memory load failed/slow -- starting without it")
    else:
        memory_task.cancel()

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
        child_uid=child_uid,
        child_name=str(meta.get("childName", "")).split(" ")[0][:40],
        grade=int(meta.get("grade", 3) or 3),
        class_id=str(meta.get("classId", "")),
        # Phase 2: both moderation checkpoints, killable from the Firebase
        # console (appConfig/zumi.moderationEnabled) without a deploy.
        moderation_enabled=zumi_cfg.moderation_enabled,
        # Phase 3: previous-session recall + summary fields.
        memory=memory,
        topic_name=str(meta.get("topicName", "")),
    )

    # Loaded once per worker process in prewarm; fall back to building it here
    # if the hook didn't run (e.g. `agent.py console`).
    vad = ctx.proc.userdata.get("vad") or build_vad()
    turn_detection = build_turn_detection()
    if zumi_cfg.stt_provider == "whisper":
        logger.info(
            "[config] stt=whisper url=%s model=%s lang=%s (sarvam fallback)",
            WHISPER_URL or "(unset!)",
            WHISPER_MODEL,
            WHISPER_LANGUAGE or "auto",
        )
    if zumi_cfg.tts_provider == "kokoro-gpu":
        logger.info(
            "[config] tts=kokoro-gpu url=%s voice=%s (cpu fallback %s)",
            KOKORO_GPU_URL or "(unset!)",
            KOKORO_VOICE,
            KOKORO_BASE_URL,
        )
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
        stt=build_stt(zumi_cfg.stt_provider, vad),
        llm=openai.LLM(
            model=LLM_MODEL,
            temperature=0.8,
            prompt_cache_key=prompt_cache_key,
        ),
        tts=build_tts(zumi_cfg.tts_provider),
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

    # Phase 3: ONE batched Firestore write when the job ends (quiz done, child
    # left, or worker draining) -- audit doc, memory doc, usage counter. Never
    # per turn. Runs in the shutdown grace period, so it can't add turn latency.
    async def _persist_summary() -> None:
        u = session.userdata
        if not u.child_uid:
            return  # console/dev session -- nothing to meter
        turns: list[dict[str, str]] = []
        for item in session.history.items:
            if getattr(item, "role", None) not in ("user", "assistant"):
                continue
            text = (item.text_content or "").strip()
            if text:
                turns.append({"role": item.role, "text": text[:200]})
        quiz_total = len(u.story.quiz) if u.story else 0
        try:
            await asyncio.to_thread(
                zfb.persist_session_summary,
                assignment_id=u.assignment_id,
                child_uid=u.child_uid,
                class_id=u.class_id,
                topic_name=u.topic_name,
                started_at_ms=started_at_ms,
                ended_at_ms=int(time.time() * 1000),
                turns=turns,
                safety_events=u.safety_events,
                latency=turn_latency.stats(),
                completed=u.finished,
                score=u.score,
                max_score=quiz_total * 25,
            )
            logger.info(
                "[flow] session summary persisted: %.1f min, %d turns, "
                "completed=%s, safety_events=%d",
                (time.time() * 1000 - started_at_ms) / 60000,
                len(turns), u.finished, u.safety_events,
            )
        except Exception:
            logger.exception("session summary write failed (usage not metered)")

    ctx.add_shutdown_callback(_persist_summary)

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
            "Oh no, I left my story bag at home! Please try again in a "
            "little while, promise."
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
