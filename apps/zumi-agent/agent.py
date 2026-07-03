"""
Zumi Voice Agent — LiveKit real-time educational voice assistant.

Pipeline: Deepgram STT → OpenAI LLM (gpt-4o-mini) → Cartesia TTS
Transport: LiveKit WebRTC (replaces Firebase Callable HTTP round-trips)

Session flow (driven by the LLM via tools):
  1. Firebase callable mints a LiveKit token + dispatches this agent
  2. Agent joins room, loads voiceStory from Firestore via room metadata
  3. Greeting → Teaching (warmup→hook→explore→explain→check) → Quiz → Closing
  4. Agent publishes UI events via DataChannel (phase, avatar, bubble, quiz, done)
  5. RN client receives voice via WebRTC audio track + events via DataChannel

The whole conversation is driven by one Agent with a comprehensive system
prompt. The LLM calls tools to emit UI events (advance_phase), grade quiz
answers (evaluate_answer), and end the session (end_session).
"""

from __future__ import annotations

import json
import logging
import os

from dotenv import load_dotenv

load_dotenv()

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import deepgram, openai, cartesia

import asyncio

from context_loader import VoiceContext, load_voice_context
from events import emit_state, emit_avatar, emit_bubble
from prompts import (
    teaching_system_prompt,
    closing_context,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zumi.agent")

CARTESIA_VOICE_ID = os.getenv(
    "CARTESIA_VOICE_ID", "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"
)
AGENT_NAME = "zumi-voice-agent"


# -- Tools (the LLM calls these to drive UI + scoring) --

@function_tool()
async def advance_phase(
    ctx: RunContext,
    phase: str,
    animation_hint: str = "none",
) -> str:
    """Advance the teaching phase and optionally trigger a UI animation.

    Call this whenever the lesson moves to a new phase or when a visual
    animation should play on the child's screen.

    Args:
        phase: The teaching phase to move to. One of: warmup, hook, explore, explain, check, ready_for_quiz.
        animation_hint: Optional animation. One of: none, experiment, visualize, reveal, celebrate, trap.
    """
    from tools.teaching import advance_phase as _impl

    return await _impl(ctx, phase, animation_hint)


@function_tool()
async def evaluate_answer(
    ctx: RunContext,
    verdict: str,
    reasoning: str,
) -> str:
    """Grade the child's spoken quiz answer. Be lenient with Hinglish and child phrasing.

    Args:
        verdict: Your assessment. One of: correct, partial, incorrect.
        reasoning: Brief explanation of why this verdict was chosen.
    """
    from tools.quiz import evaluate_answer as _impl

    return await _impl(ctx, verdict, reasoning)


@function_tool()
async def end_session(ctx: RunContext) -> str:
    """End the Zumi voice session. Call after the closing goodbye is spoken."""
    from tools.session import end_session as _impl

    return await _impl(ctx)


def build_instructions(voice_ctx: VoiceContext) -> str:
    """Combine teaching material + full quiz + closing guidance into one prompt."""
    base = teaching_system_prompt(
        voice_ctx.child_name,
        voice_ctx.grade,
        voice_ctx.material,
        "warmup",
    )

    # Build a numbered quiz block the model asks in order. Expected concepts are
    # for the model's grading only — never read them aloud to the child.
    quiz_lines = []
    for i, q in enumerate(voice_ctx.quiz_questions):
        text = q.get("questionText", "").replace(
            "{child_name}", voice_ctx.child_name or "dost"
        )
        concepts = q.get("expectedConcepts", [])
        indicator = q.get("correctIndicator", "")
        quiz_lines.append(
            f'{i + 1}. "{text}"\n'
            f"   (sahi jawab me ye concepts hone chahiye: {concepts}; "
            f"correct = {indicator})"
        )
    quiz_block = "\n".join(quiz_lines) if quiz_lines else "(no quiz questions)"

    vs = voice_ctx.voice_story
    closing_high = vs.get("closingHighScoreContext", "")
    closing_mid = vs.get("closingMidScoreContext", "")
    closing_low = vs.get("closingLowScoreContext", "")

    flow = (
        "\n\n=== SESSION FLOW (tu ye poora khud drive karega) ===\n"
        "1. GREETING: Sabse pehle bachche ko warmly greet karo, naam poochho, "
        "mood poochho (koi lesson mat mention karo). advance_phase('warmup') call karo.\n"
        "2. TEACHING: Phir stealth-teaching conversation karo, phases mein aage badho "
        "(warmup->hook->explore->explain->check). Har phase change pe advance_phase(phase, hint) call karo.\n"
        "3. QUIZ: Jab concept clear ho aur memory trick sun liya ho, advance_phase('ready_for_quiz') call karo, "
        "phir neeche diye gaye questions EK EK karke apne fun Hinglish style mein poochho (word-by-word mat padho). "
        "Har jawab ke baad evaluate_answer(verdict, reasoning) call karo, phir warm feedback do, phir agla question.\n"
        f"\nQUIZ QUESTIONS (in order):\n{quiz_block}\n\n"
        "4. CLOSING: Saare questions ke baad, score ke hisaab se warmly wrap up karo:\n"
        f"   - High score (>=75%): {closing_high}\n"
        f"   - Mid score (50-74%): {closing_mid}\n"
        f"   - Low score (<50%): {closing_low}\n"
        "   Fir end_session() call karo.\n"
        "\nHamesha short Hinglish (Roman script) mein bolo, ek time pe ek hi sawaal."
    )

    return base + flow


# -- Agent entrypoint --

async def entrypoint(ctx: JobContext):
    await ctx.connect()

    metadata_raw = ctx.room.metadata or "{}"
    try:
        metadata = json.loads(metadata_raw)
    except json.JSONDecodeError:
        logger.error("Invalid room metadata: %s", metadata_raw)
        metadata = {}

    # Demo fallback: the LiveKit "Test in Console" button and the Agents
    # Playground create rooms WITHOUT the app's lesson metadata, so
    # assignmentId is missing. To keep those one-click test paths working
    # (e.g. when no physical device / working emulator mic is available), fall
    # back to a known demo assignment so the agent still loads a real lesson.
    if not metadata.get("assignmentId"):
        demo_assignment = os.getenv(
            "ZUMI_DEMO_ASSIGNMENT_ID",
            "hUzy1q63Vbz3NjuCYdvs_classifying_things_2026-07-02",
        )
        logger.warning(
            "No assignmentId in room metadata; using demo fallback %s",
            demo_assignment,
        )
        metadata = {
            "assignmentId": demo_assignment,
            "childUid": metadata.get("childUid", "console-test-user"),
            "childName": metadata.get("childName", "Hari"),
            "grade": metadata.get("grade", 3),
            "topicName": metadata.get("topicName", "Classifying Things"),
        }

    logger.info(
        "Agent joined room %s (assignment=%s, child=%s)",
        ctx.room.name,
        metadata.get("assignmentId"),
        metadata.get("childName"),
    )

    voice_ctx = await load_voice_context(metadata)

    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=cartesia.TTS(model="sonic-3", voice=CARTESIA_VOICE_ID),
        # Use Deepgram's end-of-turn (endpointing) instead of the local
        # transformer turn-detector. On this machine the local EOU model +
        # AEC saturate the CPU: the logs show "inference is slower than
        # realtime" (delay climbing 0.3s -> 4.5s) and "job executor is
        # unresponsive {delay: 553}", which blocks the asyncio loop that
        # forwards Cartesia audio frames to the LiveKit track -> the child
        # sees the bubble text (reliable DataChannel) but the real-time audio
        # media stalls and is inaudible. "stt" reuses the Deepgram stream that
        # is already running, adding no extra local inference.
        turn_detection="stt",
        # Disable barge-in. The adaptive interruption detector runs inference
        # every 100ms on incoming mic audio *while Zumi is speaking*; on this
        # CPU-bound machine (emulator + Metro + agent) that competes with the
        # TTS audio-forwarding coroutine, stalling the event loop (logs:
        # "job executor is unresponsive {delay: 785}") and making the child
        # hear choppy/broken speech. With interruptions off, Zumi finishes the
        # line then listens, so the loop stays free during playback and audio
        # is smooth. Revert to re-enable barge-in on a stronger host.
        allow_interruptions=False,
        userdata={
            "room": ctx.room,
            "phase": "greeting",
            "assignment_id": voice_ctx.assignment_id,
            "child_uid": metadata.get("childUid", ""),
            "child_name": voice_ctx.child_name,
            "grade": voice_ctx.grade,
            "quiz_questions": voice_ctx.quiz_questions,
            "quiz_index": 0,
            "quiz_evals": [],
            "voice_story": voice_ctx.voice_story,
        },
    )

    agent = Agent(
        instructions=build_instructions(voice_ctx),
        tools=[advance_phase, evaluate_answer, end_session],
    )

    # Mirror every line Zumi speaks to the RN client as a bubble so the child
    # sees the text on screen (independent of client-side transcription).
    @session.on("conversation_item_added")
    def _on_conversation_item(ev) -> None:  # noqa: ANN001
        item = getattr(ev, "item", None)
        if item is None or getattr(item, "role", None) != "assistant":
            return
        text = (getattr(item, "text_content", None) or "").strip()
        if text:
            asyncio.create_task(emit_bubble(ctx.room, text))

    # TTS-stage instrumentation. Proves whether Cartesia actually produced
    # audio for each spoken line: `audio_duration` > 0 means audio frames were
    # generated and handed to the LiveKit track; `ttfb` is time-to-first-byte
    # from Cartesia. If audio_duration is ~0 or these never fire, the failure
    # is upstream (Cartesia); if they look healthy but the child hears nothing,
    # the failure is the client playback/routing path.
    @session.on("metrics_collected")
    def _on_metrics(ev) -> None:  # noqa: ANN001
        m = getattr(ev, "metrics", None)
        cls = type(m).__name__ if m is not None else "None"
        if "TTS" in cls:
            logger.info(
                "TTS metrics: ttfb=%.3fs audio_duration=%.3fs cancelled=%s",
                getattr(m, "ttfb", -1.0),
                getattr(m, "audio_duration", -1.0),
                getattr(m, "cancelled", "?"),
            )

    @session.on("error")
    def _on_error(ev) -> None:  # noqa: ANN001
        logger.error("AgentSession error: %s", getattr(ev, "error", ev))

    await emit_state(ctx.room, "greeting")
    await emit_avatar(ctx.room, "talking")

    # Keep the session alive across brief client disconnects (e.g. the screen
    # sleeping / app backgrounding momentarily) instead of tearing down on the
    # first blip. The RN client fully ends the session on real exit.
    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(close_on_disconnect=False),
    )

    await session.generate_reply(
        instructions=(
            "Greet the child warmly in Hinglish. Ask their name and how they're "
            "doing. Do not mention any lesson yet."
        )
    )

    logger.info(
        "Zumi session started for %s", voice_ctx.child_name or "unknown child"
    )


def main():
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint, agent_name=AGENT_NAME)
    )


if __name__ == "__main__":
    main()
