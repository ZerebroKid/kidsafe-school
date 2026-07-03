"""
Firebase context loader — reads voiceStory + child metadata from Firestore.

Mirrors the resolveVoiceContext logic from apps/functions/src/lib/zumiSession.ts
but runs inside the Python agent via firebase-admin.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger("zumi.context")

_app: firebase_admin.App | None = None

# GCP project the agent reads Firestore from. Overridable via env for staging.
_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "kidsafe-e5eac")


def _resolve_credential() -> credentials.Base:
    """
    Pick a credential for firebase-admin, in priority order:

      1. A service account key file — set FIREBASE_SERVICE_ACCOUNT (or the
         standard GOOGLE_APPLICATION_CREDENTIALS) to its path. This is the
         path used for local development.
      2. Application Default Credentials — used automatically when the agent
         runs on GCP / LiveKit Cloud with a bound service account, or after
         `gcloud auth application-default login`.
    """
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT") or os.getenv(
        "GOOGLE_APPLICATION_CREDENTIALS"
    )
    if sa_path and os.path.isfile(sa_path):
        logger.info("Using service account key: %s", sa_path)
        return credentials.Certificate(sa_path)
    logger.info("Using Application Default Credentials")
    return credentials.ApplicationDefault()


def _ensure_firebase() -> None:
    global _app
    if _app is not None:
        return
    try:
        _app = firebase_admin.get_app()
    except ValueError:
        _app = firebase_admin.initialize_app(
            _resolve_credential(),
            {"projectId": _PROJECT_ID},
        )


def _db() -> Any:
    _ensure_firebase()
    return firestore.client()


@dataclass
class VoiceContext:
    assignment_id: str
    school_id: str
    class_id: str
    curriculum_id: str
    chapter_id: str
    topic_id: str
    topic_name: str
    grade: int
    child_name: str
    voice_story: dict[str, Any] = field(default_factory=dict)

    @property
    def material(self) -> dict[str, Any]:
        """Teaching material dict expected by prompts.py."""
        vs = self.voice_story
        return {
            "topicName": self.topic_name,
            "hookContext": vs.get("hookContext", ""),
            "predictContext": vs.get("predictContext", ""),
            "experimentInstruction": vs.get("experimentInstruction", ""),
            "conceptRevealScript": vs.get("conceptRevealScript", ""),
            "ncertDefinition": vs.get("ncertDefinition", ""),
            "keyPoints": vs.get("keyPoints", []),
            "keywords": vs.get("keywords", []),
            "memoryTrick": vs.get("memoryTrick", ""),
        }

    @property
    def quiz_questions(self) -> list[dict[str, Any]]:
        return self.voice_story.get("voiceQuiz", [])


async def load_voice_context(metadata: dict[str, Any]) -> VoiceContext:
    """
    Load VoiceContext from Firestore using room metadata.

    metadata must contain:
      - assignmentId
      - childUid (for auth / name lookup)
      - childName, grade (denormalised by the token callable)
      - topicName
    """
    assignment_id = metadata["assignmentId"]

    db = _db()

    assignment_ref = db.collection("studyAssignments").document(assignment_id)
    assignment_snap = assignment_ref.get()

    if not assignment_snap.exists:
        raise ValueError(f"Assignment {assignment_id} not found")

    assignment = assignment_snap.to_dict() or {}

    curriculum_id = str(assignment.get("curriculumId", ""))
    chapter_id = str(assignment.get("chapterId", ""))
    topic_id = str(assignment.get("topicId", ""))

    topic_ref = (
        db.collection("curriculum")
        .document(curriculum_id)
        .collection("chapters")
        .document(chapter_id)
        .collection("topics")
        .document(topic_id)
    )
    topic_snap = topic_ref.get()

    if not topic_snap.exists:
        raise ValueError(f"Topic {topic_id} not found")

    topic = topic_snap.to_dict() or {}
    voice_story = topic.get("voiceStory", {})

    if not voice_story or not isinstance(voice_story.get("voiceQuiz"), list):
        raise ValueError(f"Topic {topic_id} has no voiceStory")

    grade = topic.get("grade", metadata.get("grade", 3))
    if not isinstance(grade, (int, float)):
        grade = 3

    return VoiceContext(
        assignment_id=assignment_id,
        school_id=str(assignment.get("schoolId", "")),
        class_id=str(assignment.get("classId", "")),
        curriculum_id=curriculum_id,
        chapter_id=chapter_id,
        topic_id=topic_id,
        topic_name=metadata.get("topicName", topic_id),
        grade=int(grade),
        child_name=metadata.get("childName", ""),
        voice_story=voice_story,
    )


def write_quiz_eval(
    assignment_id: str,
    child_uid: str,
    evals: list[dict[str, Any]],
) -> None:
    """Write per-question evaluation results to Firestore."""
    db = _db()
    doc_id = f"{assignment_id}_{child_uid}"
    eval_data: dict[str, Any] = {}
    for ev in evals:
        qid = ev.get("questionId", "")
        if qid:
            eval_data[qid] = {
                "result": ev.get("result", "incorrect"),
                "score": ev.get("score", 0),
                "reasoning": ev.get("reasoning", ""),
            }

    db.collection("quizVoiceEvals").document(doc_id).set(
        {"evals": eval_data, "assignmentId": assignment_id, "childUid": child_uid},
        merge=True,
    )
    logger.info("Wrote quizVoiceEvals/%s (%d questions)", doc_id, len(eval_data))
