"""Zumi live voice agent -- the streaming replacement for the callable pipeline.

One persistent WebRTC session per lesson (room `zumi_{assignmentId}_{uid}`,
minted by the `zumiLiveKitToken` Firebase callable). The pipeline overlaps all
stages -- Sarvam Saaras v3 streaming STT, OpenAI gpt-4o-mini streamed tokens,
ElevenLabs Flash v2.5 streamed TTS -- so Zumi answers in well under a second
instead of the 8-12s the request/response callables took.

Structure:
  - `TeachAgent`: greeting + adaptive stealth-teaching (same persona/phases as
    apps/functions/src/lib/zumiAi.ts). Control moves through function tools:
    `show_animation`, `play_explain_video` (pauses for the bundled video on the
    client), and `start_quiz` (handoff).
  - `QuizAgent`: asks the topic's voiceQuiz questions; grades each spoken
    answer via the `record_answer` tool, persisting the verdict to
    `quizVoiceEvals` in the same schema `submitQuizAttempt` reads, then closes
    the session (`finish_session` tool -> client submits + shows the result).

UI events ride LiveKit data messages (topic "zumi") using the client's existing
event vocabulary (cue / video / quiz / done). Speech bubbles come from LiveKit
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
    WorkerOptions,
    cli,
    function_tool,
    get_job_context,
    metrics,
)
from livekit.plugins import elevenlabs, openai, sarvam

import zumi_firebase as zfb

load_dotenv()

logger = logging.getLogger("zumi-agent")
logger.setLevel(logging.INFO)

LLM_MODEL = "gpt-4o-mini"
TTS_MODEL = "eleven_flash_v2_5"
ELEVEN_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")

SCORE_FOR = {"correct": 25, "partial": 12, "incorrect": 0}
VIDEO_WAIT_TIMEOUT_S = 240


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
    # Loaded in the background while Zumi is already greeting the child; set
    # (and instructions updated) well before the lesson needs it.
    story: zfb.VoiceStory | None = None
    quiz_index: int = 0
    score: int = 0
    last_graded_transcript: str = ""
    video_played: bool = False
    video_done: asyncio.Event = field(default_factory=asyncio.Event)


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
# Teaching agent (greeting + adaptive stealth lesson)
# ---------------------------------------------------------------------------


def greeting_instructions(u: ZumiUserdata) -> str:
    """Minimal persona used for the very first turn, before the voiceStory has
    loaded from Firestore -- lets the greeting start with zero extra wait."""
    name = u.child_name or "dost"
    return (
        f"Tu Zumi hai -- ek class {u.grade} bachche ({name}) ka pyaara, mazaakiya, super-energetic AI dost. "
        "Tu Hinglish (Roman script) mein baat karta hai. Ye ek VOICE call hai: 1-2 chhote, simple, bolne-layak "
        "sentences. Koi emoji, markdown ya list nahi -- sirf bolne wale words. Abhi sirf warm greeting aur "
        "chhoti friendly baat kar; lesson thodi der mein shuru hoga."
    )


def teach_instructions(u: ZumiUserdata) -> str:
    s = u.story
    assert s is not None
    name_clause = (
        f"Bachche ka naam {u.child_name} hai."
        if u.child_name
        else "Tujhe bachche ka naam abhi nahi pata; pehle usse puchh aur fir use kar."
    )
    return (
        f"Tu Zumi hai -- ek class {u.grade} bachche ka pyaara, mazaakiya, super-energetic AI dost. {name_clause} "
        "Tu Hinglish (Roman script) mein baat karta hai. Ye ek VOICE call hai: hamesha 1-2 chhote, simple, "
        "bolne-layak sentences -- kabhi lambi speech nahi. Har turn EXACTLY ek hi sawaal/invite pe khatam kar "
        "taaki bachcha bole. Koi emoji, markdown, list ya stage direction mat likh -- sirf bolne wale words.\n\n"
        "SABSE ZARURI -- HOOK: Bachche ko pehle second se baandh ke rakhna hai. Suspense, mystery, 'guess karo!', "
        "chhote challenges, funny twists use kar. Boring ya lecture-y bilkul mat ho.\n\n"
        "GOAL (chhupa hua): Bachche ko aise padhana hai ki use bilkul na lage ki wo padh raha hai. Pehle dost ki "
        "tarah 1 chhota turn baat karo (naam/mood), fir baaton-baaton mein topic pe le aao, aur aise guide karo ki "
        "bachcha khud concept 'discover' kar le. Har baar bachche ki EXACT baat pe react karo, fir aage badho. "
        "Kabhi same sawaal/line dobara mat bolo.\n\n"
        "CREATIVE FREEDOM: Neeche ka content sirf TERA gyaan + lesson goal hai -- word-by-word MAT padho.\n"
        f"TOPIC: {s.topic_name}\n"
        f"- Real-life hook idea: {s.hook_context}\n"
        f"- Guess karwane ka mauka: {s.predict_context}\n"
        f"- Chhota experiment: {s.experiment_instruction}\n"
        f"- Concept (jo bachche ko samajhna hai): {s.concept_reveal_script}\n"
        f"- Sahi (exam) definition: {s.ncert_definition}\n"
        f"- Key points: {' | '.join(s.key_points)}\n"
        f"- Keywords (natural tarike se daalo): {', '.join(s.keywords)}\n"
        f"- Memory trick: {s.memory_trick}\n\n"
        "LESSON KA RAASTA: warmup (1 chhota turn) -> hook (kahani/mystery) -> explore (guess + experiment) -> "
        "explain -> chhota samajh-check -> quiz. Dheere-dheere aage badho, bachche ke pace pe.\n\n"
        "TOOLS (zaroor use kar, par bachche ko kabhi mat bata):\n"
        "- show_animation: jab bhi kuch dikhane layak ho -- 'visualize' (groups/sort/concept dikhana), "
        "'experiment' (activity), 'reveal' (bada concept reveal), 'celebrate' (bachcha accha kare), 'trap' "
        "(playful galat-idea bust). Sahi mauke pe zaroor bhej.\n"
        "- play_explain_video: jab tu concept EXPLAIN karna shuru kare (explain phase ki shuruaat mein), pehle "
        "ek chhoti excited line bol jaise 'Maine tumhare liye ek chhota video banaya hai, dekho!', FIR ye tool "
        "call kar. Video khatam hone ke baad video ki baat se concept ko aage badha. Ye tool sirf EK baar use kar.\n"
        "- start_quiz: jab bachche ko concept samajh aa gaya ho AUR memory trick sun chuka ho, ek excited line "
        "bol ke ('chalo ab ek mazedaar game khelte hai!') ye tool call kar.\n\n"
        "Agar bachcha kuch na bole ya samajh na aaye, pyaar se aur mazedaar tarike se wapas conversation mein "
        "laao -- ruko mat, repeat mat karo."
    )


class TeachAgent(Agent):
    def __init__(self, u: ZumiUserdata) -> None:
        super().__init__(
            instructions=teach_instructions(u) if u.story else greeting_instructions(u)
        )

    async def on_enter(self) -> None:
        u: ZumiUserdata = self.session.userdata
        name = u.child_name or "dost"
        self.session.generate_reply(
            instructions=(
                f"Greet {name} warmly by name jaise ek excited naya dost pehli baar mil raha ho. "
                "2 chhote playful Hinglish sentences, aur ek simple sawaal (naam ya din kaisa raha). "
                "Abhi lesson/topic ka zikr mat kar."
            )
        )

    @function_tool()
    async def show_animation(self, context: RunContext, hint: str) -> str:
        """Play a visual on the child's screen alongside what you're saying.

        Args:
            hint: One of: visualize, experiment, reveal, celebrate, trap, none.
        """
        valid = {"visualize", "experiment", "reveal", "celebrate", "trap", "none"}
        h = hint if hint in valid else "none"
        await send_ui({"type": "cue", "hint": h})
        return f"Animation '{h}' is now playing on screen."

    @function_tool()
    async def play_explain_video(self, context: RunContext) -> str:
        """Play the topic's explanation video fullscreen on the child's device.
        Call this once, right when you begin explaining the concept, AFTER
        telling the child you made a video for them. The lesson pauses until
        the video finishes."""
        u: ZumiUserdata = context.session.userdata
        if u.video_played:
            return "The video was already played. Continue teaching."
        u.video_played = True
        u.video_done.clear()
        # Let the intro line finish playing out before the video takes over.
        await context.wait_for_playout()
        await send_ui({"type": "video"})
        logger.info("[perf] explanation video started")
        try:
            await asyncio.wait_for(u.video_done.wait(), timeout=VIDEO_WAIT_TIMEOUT_S)
        except asyncio.TimeoutError:
            logger.warning("video_done RPC never arrived; continuing")
        await send_ui({"type": "video_end"})
        logger.info("[perf] explanation video finished")
        return (
            "The video just finished. React excitedly, ask what the child liked, "
            "and connect it to the concept."
        )

    @function_tool()
    async def start_quiz(self, context: RunContext) -> Agent | str:
        """Start the quiz game. Call this only when the child clearly understands
        the concept AND has heard the memory trick."""
        u: ZumiUserdata = context.session.userdata
        if not u.story or not u.story.quiz:
            return "The quiz is not ready yet. Keep teaching for now."
        await context.wait_for_playout()
        logger.info("[flow] handing off to quiz (%d questions)", len(u.story.quiz))
        return QuizAgent(u)


# ---------------------------------------------------------------------------
# Quiz agent (server-authoritative grading)
# ---------------------------------------------------------------------------


def quiz_instructions(u: ZumiUserdata) -> str:
    questions = "\n".join(
        f"{i + 1}. [{q.question_id}] \"{q.question_text}\" "
        f"(sahi jawaab mein ye ideas: {', '.join(q.expected_concepts) or q.correct_indicator})"
        for i, q in enumerate(u.story.quiz)
    )
    name = u.child_name or "dost"
    return (
        f"Tu Zumi hai, {name} ke saath ek mazedaar voice quiz game khel raha hai (class {u.grade}). "
        "Hinglish (Roman script), 1-2 chhote sentences per turn, koi emoji/markdown nahi.\n\n"
        f"QUESTIONS (order mein, total {len(u.story.quiz)}):\n{questions}\n\n"
        "AISE KHELO:\n"
        "1. Pehla question pucho (apne words mein, friendly).\n"
        "2. Bachche ke jawaab ke baad HAR BAAR record_answer tool call kar -- question_id, verdict aur "
        "chhota reasoning ke saath. Verdict lenient ho: spelling/Hinglish/child phrasing maaf, IDEA judge kar. "
        "'correct' = main idea aa gaya; 'partial' = aadha idea; 'incorrect' = galat ya khaali. "
        "Agar bachcha kuch na bole ya 'pata nahi' bole toh 'incorrect'.\n"
        "3. Tool result tujhe batayega aage kya karna hai (feedback + agla question, ya closing).\n"
        "4. Feedback hamesha warm ho: sahi pe celebrate, galat pe pyaar se sahi idea batao, kabhi daanto mat.\n"
        "5. Jab tool bole ki quiz khatam ho gaya, ek warm closing line bol aur finish_session tool call kar."
    )


class QuizAgent(Agent):
    def __init__(self, u: ZumiUserdata) -> None:
        super().__init__(instructions=quiz_instructions(u))

    async def on_enter(self) -> None:
        u: ZumiUserdata = self.session.userdata
        await send_ui(
            {"type": "quiz", "current": 0, "total": len(u.story.quiz), "score": 0}
        )
        first = u.story.quiz[0].question_text if u.story.quiz else ""
        self.session.generate_reply(
            instructions=(
                "Ek excited line mein bata ki ab ek chhota quiz game khelenge, fir pehla question puchh: "
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
                f"Ab warm feedback de, fir ye closing feel use kar: '{closing_ctx}'. "
                "Uske baad finish_session tool call kar."
            )

        next_q = u.story.quiz[u.quiz_index]
        return (
            f"Answer recorded ({v}). Ab warm feedback de (1 chhota sentence), "
            f'fir agla question puchh: "{next_q.question_text}" [{next_q.question_id}]'
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

    # Load the voiceStory in the BACKGROUND: the greeting doesn't need it, so
    # Zumi starts talking immediately and the lesson content is swapped into
    # the instructions ~1s later (long before the child finishes replying).
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
    )

    session: AgentSession[ZumiUserdata] = AgentSession(
        userdata=userdata,
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
        tts=elevenlabs.TTS(
            model=TTS_MODEL,
            voice_id=ELEVEN_VOICE_ID,
            voice_settings=elevenlabs.VoiceSettings(
                stability=0.6,
                similarity_boost=0.85,
                style=0.0,
                use_speaker_boost=True,
                speed=0.95,
            ),
        ),
        # Bundled Silero VAD handles endpointing; Sarvam's server VAD assists.
    )

    # RPC from the client when the explanation video ends / is skipped.
    @ctx.room.local_participant.register_rpc_method("zumi.video_done")
    async def _on_video_done(data: rtc.RpcInvocationData) -> str:
        session.userdata.video_done.set()
        return "ok"

    # Per-stage latency logs (EOU -> LLM ttft -> TTS ttfb), the [ZumiPerf] of
    # the streaming world.
    usage = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics(ev):
        usage.collect(ev.metrics)
        m = ev.metrics
        kind = type(m).__name__
        if kind == "EOUMetrics":
            logger.info("[perf] end-of-utterance delay %.0fms", m.end_of_utterance_delay * 1000)
        elif kind == "LLMMetrics":
            logger.info("[perf] LLM first token %.0fms", m.ttft * 1000)
        elif kind == "TTSMetrics":
            logger.info("[perf] TTS first audio %.0fms", m.ttfb * 1000)

    # Greeting starts NOW (story-less instructions) -- no Firestore wait.
    teach_agent = TeachAgent(userdata)
    await session.start(agent=teach_agent, room=ctx.room)

    # Swap the full lesson into the instructions as soon as the story lands.
    try:
        userdata.story = await story_task
        logger.info(
            "[flow] voiceStory loaded: %s (%d quiz questions)",
            userdata.story.topic_name, len(userdata.story.quiz),
        )
        await teach_agent.update_instructions(teach_instructions(userdata))
    except Exception:
        logger.exception("voiceStory load failed -- ending session")
        session.say(
            "Arre yaar, mera lesson wala bag ghar pe reh gaya! Thodi der baad phir se try karna, pakka."
        )
        await send_ui({"type": "done", "score": 0, "maxScore": 100,
                       "percentage": 0, "passed": False})


def prewarm(proc) -> None:
    """Runs in each idle process before a job arrives: initialize Firestore so
    the first read of a session doesn't pay the auth handshake."""
    try:
        zfb.warm_up()
    except Exception:
        logger.exception("prewarm failed (will retry lazily in the job)")


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
