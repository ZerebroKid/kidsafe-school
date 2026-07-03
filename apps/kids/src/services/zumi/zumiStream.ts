/**
 * Zumi SSE Streaming Client — Phase 2 of the real-time voice pipeline.
 *
 * Connects to the `zumiStream` Firebase `onRequest` endpoint via a plain
 * authenticated `fetch` with a streaming `ReadableStream` body (React Native
 * 0.76+ supports streaming fetch on Android). The client processes SSE events
 * as they arrive and drives the audio queue for overlapping playback.
 *
 * Feature flag: set `ZUMI_STREAMING_ENABLED = false` to fall back to the
 * existing callable-based path (e.g. for emulator debugging). Failures also
 * fall back automatically.
 *
 * SSE events handled:
 *   text_delta   — accumulate spoken text (for bubble display)
 *   audio_chunk  — enqueue base64 MP3 chunk for immediate playback
 *   control      — extract phase / animationHint / result / score
 *   perf         — log TTFA timings via [ZumiPerf]
 *   done         — final payload (say/feedback/fullText + control fields)
 *   error        — server reported a pipeline error → reject stream
 */

import auth from '@react-native-firebase/auth';
import {Platform} from 'react-native';
import {ZumiAudioQueue} from './zumiAudioQueue';
import {mark} from './zumiPerf';

// Re-export ZumiAudioQueue so the session manager can import it from one place.
export {ZumiAudioQueue};
import type {ChatTurn, TeachPhase, AnimationHint} from './zumiApi';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Set to false to force all turns through callables (useful for emulator
 * debugging where SSE requires extra networking setup).
 */
export const ZUMI_STREAMING_ENABLED = true;

const FUNCTIONS_REGION = 'asia-south1';
const PROJECT_ID = 'kidsafe-e5eac';

function getStreamUrl(): string {
  if (__DEV__ && Platform.OS === 'android') {
    // Android emulator routes 10.0.2.2 to the host machine.
    // Firebase emulator serves HTTP functions on port 5001.
    return `http://10.0.2.2:5001/${PROJECT_ID}/${FUNCTIONS_REGION}/zumiStream`;
  }
  return `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/zumiStream`;
}

// ---------------------------------------------------------------------------
// SSE parser (streaming fetch → line-by-line event parsing)
// ---------------------------------------------------------------------------

interface SseEvent {
  event: string;
  data: string;
}

/**
 * Parse a UTF-8 text chunk from the SSE stream into discrete events.
 * Accumulates partial lines across chunks in `lineBuffer`.
 */
function parseChunk(
  chunk: string,
  lineBuffer: { current: string },
  onEvent: (evt: SseEvent) => void,
): void {
  const lines = (lineBuffer.current + chunk).split('\n');
  lineBuffer.current = lines.pop() ?? '';

  let currentEvent = 'message';
  let currentData = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      currentData = line.slice(5).trim();
    } else if (line === '') {
      // Empty line = dispatch the accumulated event.
      if (currentData) {
        onEvent({ event: currentEvent, data: currentData });
      }
      currentEvent = 'message';
      currentData = '';
    }
  }
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface StreamConverseResult {
  reply: string;
  queue: ZumiAudioQueue;
}

export interface StreamTeachResult {
  say: string;
  phase: TeachPhase;
  animationHint: AnimationHint;
  queue: ZumiAudioQueue;
}

export interface StreamEvaluateResult {
  feedback: string;
  result: 'correct' | 'partial' | 'incorrect';
  score: number;
  queue: ZumiAudioQueue;
}

// ---------------------------------------------------------------------------
// Core fetch runner
// ---------------------------------------------------------------------------

interface StreamOptions {
  mode: 'converse' | 'teach' | 'evaluate';
  assignmentId: string;
  stage?: 'greeting' | 'closing';
  phase?: TeachPhase;
  history?: ChatTurn[];
  scorePercent?: number;
  transcript?: string;
  questionId?: string;
  /** Called with accumulated text as each text_delta arrives (for bubble updates). */
  onTextDelta?: (text: string) => void;
  /** Called with each control event payload. */
  onControl?: (ctrl: Record<string, unknown>) => void;
}

/**
 * Open an SSE stream to `zumiStream` and return the audio queue plus a promise
 * for the final `done` event payload. The audio queue begins playing immediately
 * when the first `audio_chunk` arrives — no need to wait for the full response.
 *
 * Rejects if auth fails, the server returns an error event, or the stream
 * disconnects unexpectedly before `done`.
 */
export async function openZumiStream(opts: StreamOptions): Promise<{
  queue: ZumiAudioQueue;
  donePaylod: Promise<Record<string, unknown>>;
  controlPayload: Promise<Record<string, unknown>>;
}> {
  const user = auth().currentUser;
  if (!user) throw new Error('Not signed in');

  const token = await user.getIdToken();
  const stopFetch = mark('  stream.fetch');

  const response = await fetch(getStreamUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mode: opts.mode,
      assignmentId: opts.assignmentId,
      stage: opts.stage,
      phase: opts.phase,
      history: opts.history ?? [],
      scorePercent: opts.scorePercent,
      transcript: opts.transcript,
      questionId: opts.questionId,
    }),
    // React Native streaming fetch: read body as a stream.
    // @ts-expect-error — RN 0.76 supports this but TS types lag behind.
    reactNative: {textStreaming: true},
  });

  stopFetch(`${response.status}`);

  if (!response.ok) {
    throw new Error(`zumiStream HTTP ${response.status}`);
  }

  // RN 0.76+ supports streaming fetch but the TypeScript types lag behind.
  // Cast to access `.body` as a ReadableStream; runtime behavior is correct.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseBody = (response as any).body as {
    getReader(): {
      read(): Promise<{done: boolean; value: Uint8Array | undefined}>;
    };
  } | null;
  if (!responseBody) {
    throw new Error('zumiStream: no response body (streaming not supported)');
  }

  const queue = new ZumiAudioQueue();
  let accText = '';
  let resolveControl!: (v: Record<string, unknown>) => void;
  let resolveDone!: (v: Record<string, unknown>) => void;
  let rejectDone!: (e: unknown) => void;

  const controlPayload = new Promise<Record<string, unknown>>(r => { resolveControl = r; });
  const donePaylod = new Promise<Record<string, unknown>>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  const lineBuffer = { current: '' };

  const handleEvent = (evt: SseEvent) => {
    try {
      const payload = JSON.parse(evt.data) as Record<string, unknown>;
      switch (evt.event) {
        case 'text_delta': {
          const text = String(payload.text ?? '');
          accText += text;
          opts.onTextDelta?.(accText);
          break;
        }
        case 'audio_chunk': {
          const seq = Number(payload.seq);
          const base64 = String(payload.base64 ?? '');
          if (base64) queue.enqueue(seq, base64);
          break;
        }
        case 'control': {
          resolveControl(payload);
          opts.onControl?.(payload);
          break;
        }
        case 'perf': {
          // eslint-disable-next-line no-console
          if (__DEV__) console.log('[ZumiPerf] stream.server', payload);
          break;
        }
        case 'done': {
          queue.seal();
          resolveDone({ ...payload, accText });
          break;
        }
        case 'error': {
          queue.cancel();
          rejectDone(new Error(String(payload.message ?? 'stream error')));
          break;
        }
      }
    } catch {
      // Malformed SSE data — skip.
    }
  };

  // Consume the ReadableStream asynchronously.
  void (async () => {
    const reader = responseBody.getReader();
    // TextDecoder is available in RN 0.73+ but may not be in TS lib targets.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoder = new (globalThis as any).TextDecoder('utf-8') as {
      decode(value?: Uint8Array, options?: {stream?: boolean}): string;
    };
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) {
          // Stream ended — if `done` event wasn't fired, treat as error.
          if (!accText) rejectDone(new Error('stream ended without done event'));
          break;
        }
        const chunk = decoder.decode(value, {stream: true});
        parseChunk(chunk, lineBuffer, handleEvent);
      }
    } catch (err) {
      queue.cancel();
      rejectDone(err);
    }
  })();

  return {queue, donePaylod, controlPayload};
}

// ---------------------------------------------------------------------------
// High-level convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Stream a converse turn. Returns the audio queue (play immediately) and
 * a promise for the full reply text (resolves on `done`).
 *
 * Falls back to the callable-based path on any error so the session is never
 * blocked by a streaming failure.
 */
export async function streamConverse(
  opts: Omit<StreamOptions, 'mode'>,
): Promise<StreamConverseResult | null> {
  if (!ZUMI_STREAMING_ENABLED) return null;
  try {
    const {queue, donePaylod} = await openZumiStream({...opts, mode: 'converse'});
    const done = await donePaylod;
    const reply = String(done.fullText ?? done.accText ?? '');
    return {reply, queue};
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[zumiStream] converse failed, falling back to callable', err);
    return null;
  }
}

/**
 * Stream a teach turn. Returns the audio queue, phase, and animationHint
 * (via `controlPayload` which resolves as soon as the control block arrives).
 */
export async function streamTeach(
  opts: Omit<StreamOptions, 'mode'>,
): Promise<StreamTeachResult | null> {
  if (!ZUMI_STREAMING_ENABLED) return null;
  try {
    const {queue, donePaylod, controlPayload} = await openZumiStream({...opts, mode: 'teach'});
    const [done] = await Promise.all([donePaylod, controlPayload]);
    const phase = (done.phase ?? 'warmup') as TeachPhase;
    const animationHint = (done.animationHint ?? 'none') as AnimationHint;
    const say = String(done.say ?? done.accText ?? '');
    return {say, phase, animationHint, queue};
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[zumiStream] teach failed, falling back to callable', err);
    return null;
  }
}

/**
 * Stream an evaluate turn. Returns the audio queue and grading result.
 */
export async function streamEvaluateAnswer(
  opts: Omit<StreamOptions, 'mode'>,
): Promise<StreamEvaluateResult | null> {
  if (!ZUMI_STREAMING_ENABLED) return null;
  try {
    const {queue, donePaylod} = await openZumiStream({...opts, mode: 'evaluate'});
    const done = await donePaylod;
    const result = (done.result ?? 'incorrect') as 'correct' | 'partial' | 'incorrect';
    const score = typeof done.score === 'number' ? done.score : 0;
    const feedback = String(done.feedback ?? done.accText ?? '');
    return {feedback, result, score, queue};
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[zumiStream] evaluate failed, falling back to callable', err);
    return null;
  }
}
