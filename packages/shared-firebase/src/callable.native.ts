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
import { Platform } from 'react-native';

const FUNCTIONS_REGION = 'asia-south1';
// Android emulator reaches the host machine via 10.0.2.2, not 127.0.0.1.
const EMULATOR_HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const EMULATOR_PORT = 5001;

let emulatorConnected = false;

function getFunctionsInstance() {
  const fn = functions().app.functions(FUNCTIONS_REGION);
  if (!emulatorConnected && __DEV__) {
    fn.useEmulator(EMULATOR_HOST, EMULATOR_PORT);
    emulatorConnected = true;
  }
  return fn;
}

export async function callFn<TIn, TOut>(
  name: string,
  payload: TIn,
): Promise<TOut> {
  const result = await getFunctionsInstance().httpsCallable(name)(payload);
  return result.data as TOut;
}