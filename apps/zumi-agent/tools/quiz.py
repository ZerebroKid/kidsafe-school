"""
Quiz evaluation tool — called by the LLM to grade a child's spoken answer.

Mirrors the evaluateAnswer logic from zumiAi.ts: verdict → score mapping,
keyword fallback, and Firestore persistence.
"""

from __future__ import annotations

import logging
from typing import Literal

from livekit.agents import RunContext

from context_loader import write_quiz_eval
from events import emit_quiz_progress, emit_avatar

logger = logging.getLogger("zumi.tools.quiz")

VerdictType = Literal["correct", "partial", "incorrect"]

SCORE_MAP: dict[str, int] = {
    "correct": 25,
    "partial": 12,
    "incorrect": 0,
}


async def evaluate_answer(
    ctx: RunContext,
    verdict: VerdictType,
    reasoning: str,
) -> str:
    """Grade the child's spoken quiz answer.

    Call this after the child answers a quiz question. Judge the IDEA
    not the exact words — be lenient with spelling, Hinglish, and
    child phrasing.

    Args:
        verdict: Your assessment. One of: correct, partial, incorrect.
        reasoning: Brief explanation of why this verdict was chosen.

    Returns:
        Updated score summary. Then give warm Hinglish feedback to the child.
    """
    session_data = ctx.userdata

    if verdict not in SCORE_MAP:
        verdict = "incorrect"

    score = SCORE_MAP[verdict]
    question_idx = session_data.get("quiz_index", 0)
    questions = session_data.get("quiz_questions", [])

    if question_idx < len(questions):
        q = questions[question_idx]
        question_id = q.get("questionId", f"q{question_idx}")
    else:
        question_id = f"q{question_idx}"

    eval_entry = {
        "questionId": question_id,
        "result": verdict,
        "score": score,
        "reasoning": reasoning[:280],
    }
    session_data.setdefault("quiz_evals", []).append(eval_entry)

    total_score = sum(e["score"] for e in session_data["quiz_evals"])
    session_data["quiz_index"] = question_idx + 1

    room = session_data["room"]
    await emit_quiz_progress(
        room,
        current=question_idx + 1,
        total=len(questions),
        score=total_score,
    )

    if verdict == "correct":
        await emit_avatar(room, "celebrating")
    elif verdict == "partial":
        await emit_avatar(room, "encouraging")

    try:
        assignment_id = session_data.get("assignment_id", "")
        child_uid = session_data.get("child_uid", "")
        if assignment_id and child_uid:
            write_quiz_eval(assignment_id, child_uid, session_data["quiz_evals"])
    except Exception:
        logger.exception("Failed to persist quiz eval to Firestore")

    remaining = len(questions) - (question_idx + 1)
    logger.info(
        "Quiz Q%d: %s (score=%d, total=%d, remaining=%d)",
        question_idx + 1, verdict, score, total_score, remaining,
    )

    if remaining <= 0:
        return (
            f"Verdict: {verdict} (score +{score}). "
            f"Quiz complete! Total score: {total_score}/{len(questions) * 25}. "
            "Give warm closing feedback, then call end_session."
        )

    return (
        f"Verdict: {verdict} (score +{score}). "
        f"Total so far: {total_score}. {remaining} questions remaining. "
        "Give warm Hinglish feedback based on the verdict, then ask the next question."
    )
