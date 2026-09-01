"""Firestore access for the Zumi live agent.

Mirrors the server-side guarantees of the Firebase callables:
  - the teaching material (voiceStory) is loaded server-side from the topic doc
    (the client never supplies it),
  - quiz verdicts are persisted to `quizVoiceEvals/{assignmentId}_{childUid}`
    in the exact schema `submitQuizAttempt` reads, so final scoring stays
    server-authoritative, and
  - session summaries / usage / memory (Phase 3) are written in ONE batch at
    session end -- never per turn (cost rule from the plan):
      zumiSessions/{assignmentId}_{childUid}_{startedAtMs}  audit + dashboards
      zumiMemory/{childUid}                                 last-session recall
      children/{childUid}/zumiUsage/{YYYY-MM-DD}            quota counters
    `zumiMemory` is a fixed per-child doc (overwritten each session) so the
    session-start read needs no query/index; `zumiSessions` is append-only.

Uses Application Default Credentials (or GOOGLE_APPLICATION_CREDENTIALS).
firebase-admin is synchronous; call these via asyncio.to_thread from the agent.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any
from zoneinfo import ZoneInfo
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore

# Same school-day anchor as the Functions side (lib/schoolTime.ts).
SCHOOL_TIMEZONE = ZoneInfo("Asia/Kolkata")


def school_day(ts_ms: int | None = None) -> str:
    """`YYYY-MM-DD` in the school timezone (matches todayYmdInTz on server)."""
    ts = (ts_ms / 1000) if ts_ms else time.time()
    return datetime.fromtimestamp(ts, SCHOOL_TIMEZONE).strftime("%Y-%m-%d")

_app: firebase_admin.App | None = None


def _db() -> Any:
    global _app
    if _app is None:
        project_id = os.environ.get("FIREBASE_PROJECT_ID", "kidsafe-e5eac")
        cred_path = (
            os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            or os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
        )
        if not cred_path:
            for candidate in ("serviceAccountKey.json", "firebase-service-account.json", "service-account.json"):
                if os.path.exists(candidate):
                    cred_path = candidate
                    break

        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
        else:
            cred = credentials.ApplicationDefault()

        _app = firebase_admin.initialize_app(cred, {"projectId": project_id})
    return firestore.client()


def warm_up() -> None:
    """Initialize the Firebase app + credential handshake ahead of the first
    real read (called from the worker's prewarm hook)."""
    try:
        _db()
    except Exception as e:
        import logging
        logging.getLogger("zumi-firebase").warning(
            f"Firebase warm_up skipped (credentials not found: {e}). "
            "To enable Firestore sync, add serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS."
        )


@dataclass
class ZumiConfig:
    """Remote flags from `appConfig/zumi` (Phase 0 kill switch + later stages).

    Phase 0 only logs these. Phases 2/5/6 will act on moderation / STT / TTS.
    Missing doc or read failure returns safe defaults (today's behavior).
    """

    pipeline: str = "live"  # "live" | "legacy" (kids app chooses; agent is live)
    stt_provider: str = "sarvam"  # Phase 5: whisper | deepgram | sarvam
    tts_provider: str = "kokoro-cpu"  # Phase 6: kokoro-cpu | kokoro-gpu
    moderation_enabled: bool = False  # Phase 2
    # Phase 3: inject last-session recall into the intro. Remote-killable in
    # case a bad memory makes intros weird; the write side always runs.
    memory_enabled: bool = True


def load_zumi_config() -> ZumiConfig:
    """Read `appConfig/zumi`. Never raises -- defaults on missing/error."""
    try:
        snap = _db().collection("appConfig").document("zumi").get()
        data = snap.to_dict() if snap.exists else None
    except Exception:
        return ZumiConfig()
    if not isinstance(data, dict):
        return ZumiConfig()
    pipeline = data.get("pipeline")
    return ZumiConfig(
        pipeline="legacy" if pipeline == "legacy" else "live",
        stt_provider=str(data.get("sttProvider") or "sarvam"),
        tts_provider=str(data.get("ttsProvider") or "kokoro-cpu"),
        moderation_enabled=data.get("moderationEnabled") is True,
        memory_enabled=data.get("memoryEnabled") is not False,
    )


@dataclass
class QuizQuestion:
    question_id: str
    question_text: str
    expected_concepts: list[str]
    correct_indicator: str
    response_correct: str = ""
    response_partial: str = ""
    response_incorrect: str = ""


@dataclass
class VoiceStory:
    topic_name: str
    hook_context: str = ""
    predict_context: str = ""
    experiment_instruction: str = ""
    concept_reveal_script: str = ""
    ncert_definition: str = ""
    key_points: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    memory_trick: str = ""
    closing_high: str = ""
    closing_mid: str = ""
    closing_low: str = ""
    quiz: list[QuizQuestion] = field(default_factory=list)


def load_voice_story(
    curriculum_id: str, chapter_id: str, topic_id: str, topic_name: str
) -> VoiceStory:
    """Load the topic's voiceStory. Raises if the topic has no story."""
    snap = (
        _db()
        .collection("curriculum")
        .document(curriculum_id)
        .collection("chapters")
        .document(chapter_id)
        .collection("topics")
        .document(topic_id)
        .get()
    )
    if not snap.exists:
        raise RuntimeError(f"topic not found: {curriculum_id}/{chapter_id}/{topic_id}")
    vs = (snap.to_dict() or {}).get("voiceStory")
    if not isinstance(vs, dict):
        raise RuntimeError("topic has no voiceStory")

    quiz = [
        QuizQuestion(
            question_id=str(q.get("questionId", "")),
            question_text=str(q.get("questionText", "")),
            expected_concepts=[str(c) for c in (q.get("expectedConcepts") or [])],
            correct_indicator=str(q.get("correctIndicator", "")),
            response_correct=str(q.get("responseCorrect", "")),
            response_partial=str(q.get("responsePartial", "")),
            response_incorrect=str(q.get("responseIncorrect", "")),
        )
        for q in (vs.get("voiceQuiz") or [])
        if q.get("questionId")
    ]

    return VoiceStory(
        topic_name=topic_name,
        hook_context=str(vs.get("hookContext", "")),
        predict_context=str(vs.get("predictContext", "")),
        experiment_instruction=str(vs.get("experimentInstruction", "")),
        concept_reveal_script=str(vs.get("conceptRevealScript", "")),
        ncert_definition=str(vs.get("ncertDefinition", "")),
        key_points=[str(k) for k in (vs.get("keyPoints") or [])],
        keywords=[str(k) for k in (vs.get("keywords") or [])],
        memory_trick=str(vs.get("memoryTrick", "")),
        closing_high=str(vs.get("closingHighScoreContext", "")),
        closing_mid=str(vs.get("closingMidScoreContext", "")),
        closing_low=str(vs.get("closingLowScoreContext", "")),
        quiz=quiz,
    )


def persist_quiz_eval(
    *,
    assignment_id: str,
    child_uid: str,
    class_id: str,
    question_id: str,
    result: str,
    score: int,
    transcript: str,
    reasoning: str,
) -> None:
    """Write one verdict in the exact shape zumiEvaluateAnswer used to write."""
    doc_id = f"{assignment_id}_{child_uid}"
    _db().collection("quizVoiceEvals").document(doc_id).set(
        {
            "assignmentId": assignment_id,
            "childUid": child_uid,
            "classId": class_id,
            "answers": {
                question_id: {
                    "result": result,
                    "score": score,
                    "transcript": transcript[:1000],
                    "reasoning": reasoning[:280],
                    "evaluatedAt": int(time.time() * 1000),
                }
            },
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )


# ---------------------------------------------------------------------------
# Phase 3: session summary + usage metering + conversation memory
# ---------------------------------------------------------------------------


@dataclass
class SessionMemory:
    """What Zumi remembers about the child from their previous session."""

    topic_name: str = ""
    ended_at_ms: int = 0
    turns: list[dict[str, str]] = field(default_factory=list)  # {role, text}


def load_memory(child_uid: str) -> SessionMemory | None:
    """Read `zumiMemory/{childUid}` (single doc, no query). None if absent."""
    if not child_uid:
        return None
    snap = _db().collection("zumiMemory").document(child_uid).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    turns = [
        {"role": str(t.get("role", "")), "text": str(t.get("text", ""))}
        for t in (data.get("turns") or [])
        if isinstance(t, dict) and t.get("text")
    ]
    return SessionMemory(
        topic_name=str(data.get("topicName", "")),
        ended_at_ms=int(data.get("endedAtMs", 0) or 0),
        turns=turns,
    )


def persist_session_summary(
    *,
    assignment_id: str,
    child_uid: str,
    class_id: str,
    topic_name: str,
    started_at_ms: int,
    ended_at_ms: int,
    turns: list[dict[str, str]],
    safety_events: int,
    latency: dict[str, Any] | None,
    completed: bool,
    score: int,
    max_score: int,
) -> None:
    """One atomic batch at session end: audit doc + memory doc + usage counter.

    Deliberately the ONLY Firestore write of the whole conversation (quiz
    verdicts aside) -- per-turn writes are the Firebase cost trap the plan
    calls out.
    """
    duration_minutes = round(max(0, ended_at_ms - started_at_ms) / 60000, 2)
    day = school_day(ended_at_ms)
    last_turns = turns[-12:]

    db = _db()
    batch = db.batch()

    batch.set(
        db.collection("zumiSessions").document(
            f"{assignment_id}_{child_uid}_{started_at_ms}"
        ),
        {
            "assignmentId": assignment_id,
            "childUid": child_uid,
            "classId": class_id,
            "topicName": topic_name,
            "day": day,
            "startedAtMs": started_at_ms,
            "endedAtMs": ended_at_ms,
            "durationMinutes": duration_minutes,
            "turnCount": len(turns),
            "lastTurns": last_turns,
            "safetyEvents": safety_events,
            "latency": latency or {},
            "completed": completed,
            "score": score,
            "maxScore": max_score,
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
    )

    batch.set(
        db.collection("zumiMemory").document(child_uid),
        {
            "childUid": child_uid,
            "topicName": topic_name,
            "endedAtMs": ended_at_ms,
            "turns": last_turns,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    )

    batch.set(
        db.collection("children")
        .document(child_uid)
        .collection("zumiUsage")
        .document(day),
        {
            "date": day,
            "minutes": firestore.Increment(duration_minutes),
            "sessions": firestore.Increment(1),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )

    batch.commit()
