"""
Session lifecycle tool — called by the LLM to end the voice session.
"""

from __future__ import annotations

import logging

from livekit.agents import RunContext

from events import emit_done

logger = logging.getLogger("zumi.tools.session")


async def end_session(ctx: RunContext) -> str:
    """End the Zumi voice session.

    Call this after the closing phase is complete. Sends final results
    to the client and disconnects.

    Returns:
        Confirmation that the session ended.
    """
    session_data = ctx.userdata

    quiz_questions = session_data.get("quiz_questions", [])
    quiz_evals = session_data.get("quiz_evals", [])
    total_score = sum(e["score"] for e in quiz_evals)
    max_score = len(quiz_questions) * 25
    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    passed = percentage >= 50

    room = session_data["room"]
    await emit_done(room, percentage, passed, total_score, max_score)

    logger.info(
        "Session ended: score=%d/%d (%.0f%%), passed=%s",
        total_score, max_score, percentage, passed,
    )

    return (
        f"Session ended. Score: {total_score}/{max_score} ({percentage:.0f}%). "
        f"{'Passed' if passed else 'Not passed'}. "
        "Say a final warm goodbye — the child will see the results screen."
    )
