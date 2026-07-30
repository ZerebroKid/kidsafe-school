"""Firestore access for the Zumi live agent.

Mirrors the server-side guarantees of the Firebase callables:
  - the teaching material (voiceStory) is loaded server-side from the topic doc
    (the client never supplies it), and
  - quiz verdicts are persisted to `quizVoiceEvals/{assignmentId}_{childUid}`
    in the exact schema `submitQuizAttempt` reads, so final scoring stays
    server-authoritative.

Uses Application Default Credentials (or GOOGLE_APPLICATION_CREDENTIALS).
firebase-admin is synchronous; call these via asyncio.to_thread from the agent.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

_app: firebase_admin.App | None = None


def _db() -> Any:
    global _app
    if _app is None:
        project_id = os.environ.get("FIREBASE_PROJECT_ID", "kidsafe-e5eac")
        _app = firebase_admin.initialize_app(
            credentials.ApplicationDefault(), {"projectId": project_id}
        )
    return firestore.client()


def warm_up() -> None:
    """Initialize the Firebase app + credential handshake ahead of the first
    real read (called from the worker's prewarm hook)."""
    _db()


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
