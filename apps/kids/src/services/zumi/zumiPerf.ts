/**
 * Lightweight timing instrumentation for the Zumi voice pipeline.
 *
 * Every step of a turn (network call, TTS synth, audio load, playback, STT
 * listen, ...) logs a single `[ZumiPerf]` line with its duration so the Metro
 * console shows exactly where the time goes:
 *
 *   [ZumiPerf] net zumiTeach 1240ms — phase=hook audio=yes say=87 chars
 *   [ZumiPerf] audio.load 310ms
 *   [ZumiPerf] audio.playback 5490ms
 *   [ZumiPerf] listen.voice 3200ms — "mera naam aryan hai"
 *   [ZumiPerf] TURN teaching#2 total 10240ms
 *
 * Logging is always on for now (demo/debug build); flip `ENABLED` to `__DEV__`
 * for release builds.
 */

const ENABLED = true;

const TAG = '[ZumiPerf]';

export function nowMs(): number {
  return Date.now();
}

/** Log one completed step with its duration and optional detail. */
export function logStep(label: string, ms: number, extra?: string): void {
  if (!ENABLED) return;
  console.log(`${TAG} ${label} ${Math.round(ms)}ms${extra ? ` — ${extra}` : ''}`);
}

/** Log an instant informational message (no timing). */
export function logInfo(message: string): void {
  if (!ENABLED) return;
  console.log(`${TAG} ${message}`);
}

/**
 * Time an async step. On success logs `label <ms>` (+ optional describe(result));
 * on failure logs `label ✗ <ms> — <error>` and rethrows.
 */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  describe?: (result: T) => string,
): Promise<T> {
  if (!ENABLED) return fn();
  const t0 = Date.now();
  try {
    const result = await fn();
    logStep(label, Date.now() - t0, describe ? describe(result) : undefined);
    return result;
  } catch (err) {
    console.log(
      `${TAG} ${label} ✗ ${Date.now() - t0}ms — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    throw err;
  }
}

/**
 * Manual mark: `const end = mark('audio.load'); ... end('detail')`. Returns
 * the elapsed ms.
 */
export function mark(label: string): (extra?: string) => number {
  const t0 = Date.now();
  return (extra?: string) => {
    const ms = Date.now() - t0;
    logStep(label, ms, extra);
    return ms;
  };
}

/**
 * Turn-level timer for the session manager:
 * `const t = turn('teaching#3'); ...; t.end('phase=hook')`.
 */
export function turn(label: string): {end: (extra?: string) => number} {
  const t0 = Date.now();
  return {
    end: (extra?: string) => {
      const ms = Date.now() - t0;
      if (ENABLED) {
        console.log(
          `${TAG} TURN ${label} total ${Math.round(ms)}ms${extra ? ` — ${extra}` : ''}`,
        );
      }
      return ms;
    },
  };
}
