"""
Teaching phase tools — called by the LLM to advance the lesson phase
and trigger UI animations on the client.
"""

from __future__ import annotations

import logging
from typing import Literal

from livekit.agents import RunContext

from events import emit_state, emit_avatar, emit_cue

logger = logging.getLogger("zumi.tools.teaching")

VALID_PHASES = ("warmup", "hook", "explore", "explain", "check", "ready_for_quiz")
VALID_HINTS = ("none", "experiment", "visualize", "reveal", "celebrate", "trap")

PhaseType = Literal["warmup", "hook", "explore", "explain", "check", "ready_for_quiz"]
HintType = Literal["none", "experiment", "visualize", "reveal", "celebrate", "trap"]


async def advance_phase(
    ctx: RunContext,
    phase: PhaseType,
    animation_hint: HintType = "none",
) -> str:
    """Advance the teaching phase and optionally trigger a UI animation.

    Call this whenever the lesson moves to a new phase or when a visual
    animation should play on the child's screen.

    Args:
        phase: The teaching phase to move to. One of: warmup, hook, explore, explain, check, ready_for_quiz.
        animation_hint: Optional animation to play. One of: none, experiment, visualize, reveal, celebrate, trap.

    Returns:
        Confirmation of the phase change.
    """
    session_data = ctx.userdata
    old_phase = session_data.get("phase", "warmup")

    if phase not in VALID_PHASES:
        return f"Invalid phase '{phase}'. Use one of: {', '.join(VALID_PHASES)}"
    if animation_hint not in VALID_HINTS:
        animation_hint = "none"

    session_data["phase"] = phase
    room = session_data["room"]

    # Map the granular teaching phase to the high-level UI state the RN client
    # expects (ZumiAgentEvent.state = greeting|teaching|quiz|closing|done).
    ui_state = "quiz" if phase == "ready_for_quiz" else "teaching"
    await emit_state(room, ui_state)

    if animation_hint != "none":
        await emit_cue(room, {"type": animation_hint})

    if phase == "ready_for_quiz":
        await emit_avatar(room, "celebrating")

    logger.info("Phase: %s -> %s (hint=%s)", old_phase, phase, animation_hint)
    return f"Phase advanced to '{phase}'. Animation: {animation_hint}."
