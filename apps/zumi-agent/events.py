"""
DataChannel event publisher — sends structured JSON events to the RN client.

Event types mirror the ZumiAgentEvent schema in packages/shared-types/src/zumiEvents.ts.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from livekit import rtc

logger = logging.getLogger("zumi.events")


async def publish_event(room: rtc.Room, event: dict[str, Any]) -> None:
    payload = json.dumps(event).encode("utf-8")
    await room.local_participant.publish_data(payload, reliable=True)
    logger.debug("Published event: %s", event.get("type"))


async def emit_state(room: rtc.Room, state: str) -> None:
    await publish_event(room, {"type": "state", "state": state})


async def emit_avatar(room: rtc.Room, avatar: str) -> None:
    await publish_event(room, {"type": "avatar", "avatar": avatar})


async def emit_bubble(room: rtc.Room, text: str) -> None:
    await publish_event(room, {"type": "bubble", "text": text})


async def emit_cue(room: rtc.Room, cue: dict[str, Any] | None) -> None:
    await publish_event(room, {"type": "cue", "cue": cue})


async def emit_quiz_progress(
    room: rtc.Room, current: int, total: int, score: int
) -> None:
    await publish_event(
        room,
        {"type": "quiz", "current": current, "total": total, "score": score},
    )


async def emit_listening(room: rtc.Room, on: bool) -> None:
    await publish_event(room, {"type": "listening", "on": on})


async def emit_done(
    room: rtc.Room,
    percentage: float,
    passed: bool,
    score: int,
    max_score: int,
) -> None:
    await publish_event(
        room,
        {
            "type": "done",
            "percentage": percentage,
            "passed": passed,
            "score": score,
            "maxScore": max_score,
        },
    )


async def emit_error(room: rtc.Room, message: str) -> None:
    await publish_event(room, {"type": "error", "message": message})
