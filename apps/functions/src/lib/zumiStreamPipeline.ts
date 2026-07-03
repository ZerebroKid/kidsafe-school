/**
 * Zumi Streaming Pipeline — the core of Phase 2 latency optimization.
 *
 * Orchestrates a fully pipelined LLM → sentence-buffer → parallel TTS chain
 * that is consumed by the `zumiStream` SSE endpoint. The client receives
 * audio_chunk events for each sentence as soon as TTS synthesizes it, meaning
 * playback of sentence 1 begins while sentences 2-N are still being synthesized.
 *
 * Pipeline stages (all overlapping):
 *   1. LLM stream starts → tokens accumulate in a sentence buffer.
 *   2. On each sentence boundary (.!?।) or 80-char cap, dispatch TTS for that
 *      sentence immediately (don't wait for the full LLM reply).
 *   3. TTS audio comes back → emit `audio_chunk` SSE event immediately.
 *      Up to MAX_TTS_CONCURRENT sentences are in-flight at once so network
 *      bandwidth is used efficiently without exceeding OpenAI concurrency.
 *   4. Parse control JSON (<<<{...}>>>) from the accumulated text after stream
 *      ends to extract `phase`, `animationHint`, `result`, etc.
 *
 * SSE event schema:
 *   event: text_delta   data: {"text":"..."}
 *   event: audio_chunk  data: {"seq":0,"base64":"...","contentType":"audio/mpeg"}
 *   event: control      data: {"phase":"hook","animationHint":"sparkle"}
 *   event: perf         data: {"llmFirstTokenMs":320,"ttsFirstChunkMs":180}
 *   event: done         data: {}
 *   event: error        data: {"message":"..."}
 */

import type { Response } from 'express';
import { synthesize } from './elevenLabs';
import {
  converseStream,
  teachTurnStream,
  evaluateStream,
  parseTeachControl,
  parseEvalControl,
  type ConverseParams,
  type TeachParams,
  type EvaluateParams,
  type TeachPhase,
  type AnimationHint,
} from './zumiAi';

/** Maximum number of TTS synthesis calls in-flight simultaneously. */
const MAX_TTS_CONCURRENT = 2;

/** Sentence-boundary characters: Latin punct + Devanagari danda. */
const SENTENCE_END = /[.!?।]/;
/** Force-flush after this many characters even without a sentence boundary. */
const FORCE_FLUSH_CHARS = 80;
/** Minimum sentence length before we consider flushing at a boundary. */
const MIN_SENTENCE_CHARS = 20;
/** Prefix/suffix that wraps the trailing control JSON block. */
const CTRL_START = '<<<';
const CTRL_END = '>>>';

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEvent(res: Response, event: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ---------------------------------------------------------------------------
// Sentence buffer
// ---------------------------------------------------------------------------

interface SentenceBuffer {
  /** Characters accumulated since the last flush. */
  pending: string;
  /** Everything accumulated (for final control-block parse). */
  full: string;
  /** Sequence counter for audio chunks. */
  seq: number;
  /** True once we hit the CTRL_START marker — stop flushing new sentences. */
  inControl: boolean;
}

function createBuffer(): SentenceBuffer {
  return { pending: '', full: '', seq: 0, inControl: false };
}

/**
 * Add tokens to the buffer. Returns sentences ready for TTS (already flushed
 * from `pending`). Does NOT perform TTS — the caller decides concurrency.
 */
function pushTokens(buf: SentenceBuffer, token: string): string[] {
  // Once we enter the control block, accumulate but don't flush as sentences.
  if (buf.inControl || buf.full.includes(CTRL_START)) {
    buf.inControl = true;
    buf.full += token;
    return [];
  }

  buf.full += token;
  buf.pending += token;

  const sentences: string[] = [];

  // Check if the control block just started mid-token.
  const ctrlIdx = buf.pending.indexOf(CTRL_START);
  if (ctrlIdx !== -1) {
    // Flush whatever is before the control marker as a final sentence.
    const before = buf.pending.slice(0, ctrlIdx).trim();
    if (before.length >= MIN_SENTENCE_CHARS) {
      sentences.push(before);
    }
    buf.pending = '';
    buf.inControl = true;
    return sentences;
  }

  // Extract complete sentences from pending.
  let consumed = 0;
  for (let i = 0; i < buf.pending.length; i++) {
    if (SENTENCE_END.test(buf.pending[i])) {
      const candidate = buf.pending.slice(consumed, i + 1).trim();
      if (candidate.length >= MIN_SENTENCE_CHARS) {
        sentences.push(candidate);
        consumed = i + 1;
      }
    }
  }

  // Force-flush if pending is too long (no sentence boundary found yet).
  if (buf.pending.length - consumed >= FORCE_FLUSH_CHARS) {
    const chunk = buf.pending.slice(consumed).trim();
    if (chunk.length >= MIN_SENTENCE_CHARS) {
      sentences.push(chunk);
      consumed = buf.pending.length;
    }
  }

  buf.pending = buf.pending.slice(consumed);
  return sentences;
}

/** Flush any remaining pending text (call after the LLM stream ends). */
function flushBuffer(buf: SentenceBuffer): string[] {
  const leftover = buf.pending.trim();
  buf.pending = '';
  if (leftover.length >= 2) return [leftover];
  return [];
}

// ---------------------------------------------------------------------------
// Control JSON parsers
// ---------------------------------------------------------------------------

function extractControl(full: string): string | null {
  const start = full.indexOf(CTRL_START);
  const end = full.lastIndexOf(CTRL_END);
  if (start === -1 || end === -1 || end <= start) return null;
  return full.slice(start + CTRL_START.length, end);
}

// ---------------------------------------------------------------------------
// TTS concurrency pool
// ---------------------------------------------------------------------------

interface TtsJob {
  seq: number;
  text: string;
  promise: Promise<void>;
}

/**
 * Dispatch TTS for `text` at sequence `seq`. Emits an `audio_chunk` SSE event
 * when the synthesis completes. Returns a promise that resolves when the chunk
 * has been sent (or silently swallowed on error — one bad chunk should not kill
 * the whole stream).
 */
function dispatchTts(
  res: Response,
  seq: number,
  text: string,
  perfState: { ttsFirstChunkMs?: number; streamStart: number },
): Promise<void> {
  return synthesize(text)
    .then(buf => {
      if (perfState.ttsFirstChunkMs === undefined) {
        perfState.ttsFirstChunkMs = Date.now() - perfState.streamStart;
      }
      sseEvent(res, 'audio_chunk', {
        seq,
        base64: buf.toString('base64'),
        contentType: 'audio/mpeg',
      });
    })
    .catch(err => {
      console.error('[zumiStream] TTS failed for seq', seq, err?.message);
      // Don't re-throw: a missing audio chunk degrades gracefully to the
      // client's on-device TTS fallback.
    });
}

// ---------------------------------------------------------------------------
// Main pipeline runner
// ---------------------------------------------------------------------------

interface PipelineResult {
  fullText: string;
  controlJson: string | null;
}

async function runPipeline(
  res: Response,
  generator: AsyncGenerator<string>,
  perfState: { ttsFirstChunkMs?: number; llmFirstTokenMs?: number; streamStart: number },
): Promise<PipelineResult> {
  const buf = createBuffer();
  // In-flight TTS jobs; capped at MAX_TTS_CONCURRENT.
  const inflight: TtsJob[] = [];

  const drainCompleted = async () => {
    for (let i = inflight.length - 1; i >= 0; i--) {
      // Promise.race doesn't give us completion-without-throw, so track via
      // a simple settled flag injected into each job.
    }
    // Remove settled jobs by checking if length > cap.
    // Simpler approach: await the oldest job if we're at capacity.
    if (inflight.length >= MAX_TTS_CONCURRENT) {
      await inflight[0].promise;
      inflight.shift();
    }
  };

  const dispatchSentence = async (text: string) => {
    await drainCompleted();
    const seq = buf.seq++;
    sseEvent(res, 'text_delta', { text });
    const job: TtsJob = {
      seq,
      text,
      promise: dispatchTts(res, seq, text, perfState),
    };
    inflight.push(job);
  };

  for await (const token of generator) {
    if (res.writableEnded) break;
    if (perfState.llmFirstTokenMs === undefined) {
      perfState.llmFirstTokenMs = Date.now() - perfState.streamStart;
    }
    const sentences = pushTokens(buf, token);
    for (const sentence of sentences) {
      await dispatchSentence(sentence);
    }
  }

  // Flush remaining pending text.
  for (const sentence of flushBuffer(buf)) {
    await dispatchSentence(sentence);
  }

  // Wait for all in-flight TTS jobs to complete.
  await Promise.allSettled(inflight.map(j => j.promise));

  return { fullText: buf.full, controlJson: extractControl(buf.full) };
}

// ---------------------------------------------------------------------------
// Public entry points — one per session mode
// ---------------------------------------------------------------------------

export async function streamConverse(
  res: Response,
  params: ConverseParams,
): Promise<void> {
  const streamStart = Date.now();
  const perfState: { ttsFirstChunkMs?: number; llmFirstTokenMs?: number; streamStart: number } =
    { streamStart };

  try {
    const gen = converseStream(params);
    const { fullText } = await runPipeline(res, gen, perfState);

    sseEvent(res, 'perf', {
      llmFirstTokenMs: perfState.llmFirstTokenMs ?? -1,
      ttsFirstChunkMs: perfState.ttsFirstChunkMs ?? -1,
      totalMs: Date.now() - streamStart,
    });
    sseEvent(res, 'done', { fullText });
  } catch (err) {
    console.error('[zumiStream/converse] pipeline error', err);
    sseEvent(res, 'error', { message: (err as Error)?.message ?? 'stream error' });
  }
}

export async function streamTeachTurn(
  res: Response,
  params: TeachParams,
): Promise<void> {
  const streamStart = Date.now();
  const perfState: { ttsFirstChunkMs?: number; llmFirstTokenMs?: number; streamStart: number } =
    { streamStart };

  try {
    const gen = teachTurnStream(params);
    const { fullText, controlJson } = await runPipeline(res, gen, perfState);

    // Parse the trailing control block to extract phase and animationHint.
    const control = parseTeachControl(controlJson, params.phase);
    sseEvent(res, 'control', control);
    sseEvent(res, 'perf', {
      llmFirstTokenMs: perfState.llmFirstTokenMs ?? -1,
      ttsFirstChunkMs: perfState.ttsFirstChunkMs ?? -1,
      totalMs: Date.now() - streamStart,
    });
    // fullText includes the control marker; strip it for the log.
    const sayText = controlJson
      ? fullText.slice(0, fullText.indexOf(CTRL_START)).trim()
      : fullText.trim();
    sseEvent(res, 'done', { say: sayText, ...control });
  } catch (err) {
    console.error('[zumiStream/teach] pipeline error', err);
    sseEvent(res, 'error', { message: (err as Error)?.message ?? 'stream error' });
  }
}

export async function streamEvaluate(
  res: Response,
  params: EvaluateParams,
): Promise<void> {
  const streamStart = Date.now();
  const perfState: { ttsFirstChunkMs?: number; llmFirstTokenMs?: number; streamStart: number } =
    { streamStart };

  try {
    const gen = evaluateStream(params);
    const { fullText, controlJson } = await runPipeline(res, gen, perfState);

    const control = parseEvalControl(controlJson);
    sseEvent(res, 'control', control);
    sseEvent(res, 'perf', {
      llmFirstTokenMs: perfState.llmFirstTokenMs ?? -1,
      ttsFirstChunkMs: perfState.ttsFirstChunkMs ?? -1,
      totalMs: Date.now() - streamStart,
    });
    const feedbackText = controlJson
      ? fullText.slice(0, fullText.indexOf(CTRL_START)).trim()
      : fullText.trim();
    sseEvent(res, 'done', { feedback: feedbackText, ...control });
  } catch (err) {
    console.error('[zumiStream/evaluate] pipeline error', err);
    sseEvent(res, 'error', { message: (err as Error)?.message ?? 'stream error' });
  }
}
