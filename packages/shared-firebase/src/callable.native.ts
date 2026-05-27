/**
 * Native (React Native) twin of `callable.web.ts`.
 *
 * Wraps `@react-native-firebase/functions` so ZConnect can call the Phase 4+
 * callables (`requestTeacherJoin`, future `joinSchool`, etc) with the same
 * `callFn(name, payload)` shape used by the Next.js webs. Region (`asia-south1`)
 * MUST match `apps/functions/src/index.ts` `setGlobalOptions({region: ...})`
 * so the URL the SDK constructs hits the right Cloud Run service.
 *
 * Emulator wiring is intentionally NOT included here today -- ZConnect runs
 * exclusively against deployed functions in Phase 4 (the device + emulator
 * networking ergonomics aren't worth solving until we have an emulator
 * smoke harness that the RN test loop actually uses).
 *
 * Errors bubble up as `FirebaseError`-shaped objects with `.code` like
 * `'functions/permission-denied'`; consumers should switch on `err.code`
 * for user-facing copy and let everything else fall through to a generic
 * "Something went wrong" toast.
 */

import functions from '@react-native-firebase/functions';

const FUNCTIONS_REGION = 'asia-south1';

export async function callFn<TIn, TOut>(
  name: string,
  payload: TIn,
): Promise<TOut> {
  const result = await functions()
    .app.functions(FUNCTIONS_REGION)
    .httpsCallable(name)(payload);
  return result.data as TOut;
}
