/**
 * Shared Firebase Functions (v2 onCall) client wrapper for the Next.js webs.
 *
 * Centralised here so:
 *   - Region (`asia-south1`) is pinned in one place (must match
 *     `apps/functions/src/index.ts` `setGlobalOptions({region: ...})`).
 *   - Emulator wiring is opt-in via `NEXT_PUBLIC_USE_EMULATOR=true` and
 *     handled exactly once per Functions singleton -- otherwise repeat calls
 *     to `connectFunctionsEmulator` throw "functions already connected".
 *   - Typed callsites: `callFn<{x: number}, {ok: boolean}>('foo', {x: 1})`.
 *
 * Phase 4 first user is `claimSchool` (P4.2.4); future callers (approveTeacher,
 * assignTopic, ...) all go through this same wrapper.
 */

import {
  type Functions,
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

import {initFirebase} from './index.web';

const FUNCTIONS_REGION = 'asia-south1';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 5001;

let cached: Functions | null = null;
let emulatorConnected = false;

function getFunctionsInstance(): Functions {
  if (cached) return cached;
  const fns = getFunctions(initFirebase(), FUNCTIONS_REGION);
  // Connect to the emulator at most once per process; subsequent attempts
  // throw. Gate on a public env so production builds never accidentally
  // hit localhost (e.g. a stray .env.local on a deploy machine).
  if (
    !emulatorConnected &&
    process.env.NEXT_PUBLIC_USE_EMULATOR === 'true' &&
    isBrowser()
  ) {
    connectFunctionsEmulator(fns, EMULATOR_HOST, EMULATOR_PORT);
    emulatorConnected = true;
  }
  cached = fns;
  return fns;
}

/**
 * Invoke a deployed callable and return its `.data` payload (unwrapped from
 * the `HttpsCallableResult` envelope). Errors bubble up as
 * `FirebaseError` with a `.code` like `'functions/invalid-argument'` --
 * callers should switch on `err.code` for user-facing messages and let
 * everything else fall through to a generic "Something went wrong" toast.
 */
export async function callFn<TIn, TOut>(
  name: string,
  payload: TIn,
): Promise<TOut> {
  const fn = httpsCallable<TIn, TOut>(getFunctionsInstance(), name);
  const result = await fn(payload);
  return result.data;
}

/**
 * Browser-only guard. `shared-firebase` is consumed by RN and Next.js builds
 * that target both client and SSR; the emulator wiring only makes sense in
 * the browser tab (SSR would try to talk to localhost from a Vercel edge
 * worker and silently 0-byte the call).
 */
function isBrowser(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as {document?: unknown}).document !== 'undefined'
  );
}
