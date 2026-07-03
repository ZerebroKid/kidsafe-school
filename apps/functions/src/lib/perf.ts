/**
 * Lightweight per-request step logger for the Zumi callables.
 *
 * Every Zumi function creates one logger per request and logs:
 *   - request start with a summary of the input it received,
 *   - each pipeline step with its duration (`[zumiTeach] openai 842ms ...`),
 *   - request end with a summary of the output + the total elapsed time.
 *
 * All output goes through console.log/error so it lands in Cloud Logging and
 * `firebase functions:log`, making latency hotspots and bad inputs diagnosable
 * in production without a debugger.
 */

export interface StepLogger {
  /** Log the input the function received (call once at the top). */
  start(inputSummary: Record<string, unknown>): void;
  /**
   * Time one async step. Logs `[fn] label <ms>` plus an optional detail
   * describing the step's own input/output.
   */
  step<T>(label: string, fn: () => Promise<T>, describe?: (result: T) => string): Promise<T>;
  /** Log an instant message (no timing) tagged to this request. */
  info(message: string, extra?: Record<string, unknown>): void;
  /** Log the output summary + total request time (call once before return). */
  end(outputSummary: Record<string, unknown>): void;
  /** Log a failure with the total elapsed time. */
  fail(err: unknown): void;
}

export function stepLogger(fnName: string): StepLogger {
  const t0 = Date.now();
  const tag = `[${fnName}]`;

  return {
    start(inputSummary) {
      console.log(`${tag} ▶ start`, JSON.stringify(inputSummary));
    },

    async step<T>(
      label: string,
      fn: () => Promise<T>,
      describe?: (result: T) => string,
    ): Promise<T> {
      const s0 = Date.now();
      try {
        const result = await fn();
        const detail = describe ? ` — ${describe(result)}` : '';
        console.log(`${tag} ${label} ${Date.now() - s0}ms${detail}`);
        return result;
      } catch (err) {
        console.error(
          `${tag} ${label} FAILED after ${Date.now() - s0}ms:`,
          err instanceof Error ? err.message : err,
        );
        throw err;
      }
    },

    info(message, extra) {
      if (extra) console.log(`${tag} ${message}`, JSON.stringify(extra));
      else console.log(`${tag} ${message}`);
    },

    end(outputSummary) {
      console.log(
        `${tag} ✔ done in ${Date.now() - t0}ms`,
        JSON.stringify(outputSummary),
      );
    },

    fail(err) {
      console.error(
        `${tag} ✗ failed after ${Date.now() - t0}ms:`,
        err instanceof Error ? err.message : err,
      );
    },
  };
}
