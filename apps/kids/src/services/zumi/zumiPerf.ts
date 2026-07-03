/**
 * zumiPerf — lightweight timing instrumentation for the Zumi voice pipeline.
 *
 * All output is __DEV__-only and costs zero in release builds. Every log line
 * is prefixed `[ZumiPerf]` so Metro can be filtered to `ZumiPerf` for a clean
 * latency trace. Structured `{stage, ms, meta}` objects are also emitted via
 * the session manager's `debug` event for the in-app dev panel.
 *
 * API:
 *   timed(label, fn, describe?)  — time an async call, log + return its result
 *   mark(label)                  — start a manual span, returns a stop function
 *   turn(label)                  — bracket a full session turn
 *   perfSummary()                — collect all spans since last reset
 *   resetPerf()                  — clear accumulated spans
 *
 * For a complete turn trace:
 *   const t = turn('teach turn #0 [warmup]');
 *   const result = await timed('net zumiTeach[warmup]', () => zumiTeach(input),
 *                              out => `${out.say.length} chars`);
 *   const stop = mark('  speak.resolveUrl[synth]');
 *   // ...async work...
 *   stop('ok');
 *   t.end('AI->spoken');
 */

export interface PerfSpan {
  label: string;
  ms: number;
  meta?: string;
  ts: number;
}

const spans: PerfSpan[] = [];
let turnDepth = 0;

function nowMs(): number {
  return Date.now();
}

function log(label: string, ms: number, meta?: string): void {
  if (!__DEV__) return;
  const metaSuffix = meta ? ` — ${meta}` : '';
  // eslint-disable-next-line no-console
  console.log(`[ZumiPerf] ${label} — ${ms}ms${metaSuffix}`);
  spans.push({ label, ms, meta, ts: Date.now() });
}

/**
 * Time an async operation, log the result, and return the operation's value.
 * The optional `describe` function extracts a short summary from the result for
 * the log line (e.g. character count or phase name).
 */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  describe?: (result: T) => string,
): Promise<T> {
  if (!__DEV__) return fn();
  const start = nowMs();
  try {
    const result = await fn();
    const ms = nowMs() - start;
    const meta = describe ? describe(result) : undefined;
    log(label, ms, meta);
    return result;
  } catch (err) {
    const ms = nowMs() - start;
    log(`${label} ✗`, ms, (err as Error)?.message?.slice(0, 60));
    throw err;
  }
}

/**
 * Start a manual span. Returns a `stop(meta?)` function that logs the elapsed
 * time when called. Use for multi-step operations where `timed` is awkward.
 */
export function mark(label: string): (meta?: string) => void {
  if (!__DEV__) return () => {};
  const start = nowMs();
  return (meta?: string) => {
    log(label, nowMs() - start, meta);
  };
}

/**
 * Bracket a full session turn. The returned object has an `end(phase)` method
 * that logs the total elapsed time for the turn. Logs a start marker too.
 */
export function turn(label: string): { end: (phase?: string) => void } {
  if (!__DEV__) return { end: () => {} };
  const indent = '  '.repeat(turnDepth);
  // eslint-disable-next-line no-console
  console.log(`[ZumiPerf] ${indent}▶ ${label} start`);
  turnDepth++;
  const start = nowMs();
  return {
    end: (phase?: string) => {
      turnDepth = Math.max(0, turnDepth - 1);
      const ms = nowMs() - start;
      const meta = phase ? `AI->spoken via ${phase}` : undefined;
      // eslint-disable-next-line no-console
      console.log(`[ZumiPerf] ${indent}■ ${label} TOTAL — ${ms}ms${meta ? ` (${meta})` : ''}`);
      spans.push({ label: `TOTAL ${label}`, ms, meta, ts: Date.now() });
    },
  };
}

/** Return all collected spans since the last `resetPerf()`. */
export function perfSummary(): readonly PerfSpan[] {
  return spans;
}

/** Clear the accumulated span list (call at session start). */
export function resetPerf(): void {
  spans.length = 0;
  turnDepth = 0;
}
