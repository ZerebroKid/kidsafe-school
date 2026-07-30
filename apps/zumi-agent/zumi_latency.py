"""Per-turn latency tracking for the Zumi voice pipeline.

LiveKit emits one metrics object per stage (EOU, LLM, TTS), each tagged with the
`speech_id` of the turn it belongs to. Individually they answer "was the LLM
slow?"; what we actually need to defend is the number the plan targets:

    child stops speaking  ->  first audio of Zumi's reply   (target < 1.5s)

which is `end_of_utterance_delay + llm.ttft + tts.ttfb`. This module joins the
stage metrics by speech_id, logs ONE line per completed turn, and keeps the
totals so the session can print a p50/p95 summary when it closes -- the baseline
every later pipeline swap (Whisper STT, GPU streaming TTS) is measured against.

Notes on the joins:
  - Preemptive generation can start an LLM/TTS request that is later cancelled;
    cancelled requests are ignored so they can't pollute the baseline.
  - A reply is synthesized in several TTS segments (sentence by sentence); only
    the FIRST ttfb of a turn matters, since that is when the child hears audio.
  - Scripted `session.say()` lines have no user turn, so they never get an EOU
    metric and are counted separately as "scripted" instead of turns.
"""

from __future__ import annotations

import logging
import math
from collections import OrderedDict
from dataclasses import dataclass

from livekit.agents.metrics import EOUMetrics, LLMMetrics, TTSMetrics

# Turns waiting on a stage that never arrived (e.g. a scripted line's TTS, or a
# reply the child interrupted) are evicted oldest-first so a long session can't
# grow this map without bound.
_MAX_PENDING = 32

DEFAULT_TARGET_S = 1.5


@dataclass
class _Turn:
    eou_delay: float | None = None
    transcription_delay: float | None = None
    llm_ttft: float | None = None
    tts_ttfb: float | None = None
    logged: bool = False

    @property
    def total(self) -> float | None:
        if self.eou_delay is None or self.llm_ttft is None or self.tts_ttfb is None:
            return None
        return self.eou_delay + self.llm_ttft + self.tts_ttfb


def _percentile(values: list[float], q: float) -> float:
    """Nearest-rank percentile (q in 0..1). Empty -> 0.0."""
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = math.ceil(q * len(ordered)) - 1
    return ordered[min(len(ordered) - 1, max(0, idx))]


class TurnLatencyTracker:
    """Joins per-stage metrics into one per-turn latency number.

    Feed every `metrics_collected` event to `on_metrics`, then call
    `log_summary()` when the session closes.
    """

    def __init__(
        self,
        logger: logging.Logger,
        *,
        target_s: float = DEFAULT_TARGET_S,
    ) -> None:
        self._logger = logger
        self._target_s = target_s
        self._pending: OrderedDict[str, _Turn] = OrderedDict()
        self._totals: list[float] = []
        self._scripted_ttfb: list[float] = []

    # ---- ingest -----------------------------------------------------------

    def on_metrics(self, m: object) -> None:
        if isinstance(m, EOUMetrics):
            turn = self._turn(m.speech_id)
            if turn is None:
                return
            # 0.0 means VAD never saw the end of speech (e.g. the turn was ended
            # by code), so there is no "child stopped speaking" anchor to
            # measure from -- leave it unset and the turn counts as scripted.
            if m.end_of_utterance_delay > 0:
                turn.eou_delay = m.end_of_utterance_delay
                turn.transcription_delay = m.transcription_delay
        elif isinstance(m, LLMMetrics):
            if m.cancelled:
                return
            turn = self._turn(m.speech_id)
            if turn is None:
                return
            if turn.llm_ttft is None:
                turn.llm_ttft = m.ttft
        elif isinstance(m, TTSMetrics):
            if m.cancelled:
                return
            turn = self._turn(m.speech_id)
            if turn is None:
                return
            if turn.tts_ttfb is None:
                turn.tts_ttfb = m.ttfb
        else:
            return
        self._classify(m.speech_id, turn)

    # ---- internals --------------------------------------------------------

    def _turn(self, speech_id: str | None) -> _Turn | None:
        if not speech_id:
            return None
        turn = self._pending.get(speech_id)
        if turn is None:
            turn = _Turn()
            self._pending[speech_id] = turn
            while len(self._pending) > _MAX_PENDING:
                self._pending.popitem(last=False)
        return turn

    def _classify(self, speech_id: str, turn: _Turn) -> None:
        """Decide, once audio is on the way, what this speech actually was.

        Stage order for a real turn is EOU -> LLM -> TTS, so by the time the
        first ttfb lands we already know whether the child's end of speech
        anchored it. No anchor means a scripted line (`session.say()` or an
        intro `generate_reply` with the mic muted), which is not a turn latency.
        """
        if turn.logged or turn.tts_ttfb is None:
            return
        if turn.eou_delay is None:
            turn.logged = True
            self._scripted_ttfb.append(turn.tts_ttfb)
            return
        total = turn.total
        if total is None:
            return
        turn.logged = True
        self._totals.append(total)
        self._logger.info(
            "[perf] turn %s: eou %.0fms (transcript %.0fms) + llm ttft %.0fms "
            "+ tts ttfb %.0fms = %.0fms to first audio%s",
            speech_id,
            turn.eou_delay * 1000,
            (turn.transcription_delay or 0) * 1000,
            turn.llm_ttft * 1000,
            turn.tts_ttfb * 1000,
            total * 1000,
            "" if total <= self._target_s else f"  OVER {self._target_s:.1f}s TARGET",
        )

    # ---- summary ----------------------------------------------------------

    def log_summary(self) -> None:
        """One line with the session's latency distribution (the baseline)."""
        if not self._totals:
            self._logger.info(
                "[perf] no complete turns measured (%d scripted lines)",
                len(self._scripted_ttfb),
            )
            return
        over = sum(1 for t in self._totals if t > self._target_s)
        self._logger.info(
            "[perf] session latency: turns=%d p50=%.0fms p95=%.0fms max=%.0fms "
            "over-%.1fs=%d scripted_tts_p50=%.0fms",
            len(self._totals),
            _percentile(self._totals, 0.50) * 1000,
            _percentile(self._totals, 0.95) * 1000,
            max(self._totals) * 1000,
            self._target_s,
            over,
            _percentile(self._scripted_ttfb, 0.50) * 1000,
        )
