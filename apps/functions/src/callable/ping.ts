/**
 * P4.1.1 -- Functions deploy smoke test.
 *
 * The smallest possible deployable callable. Returns a tiny structured payload
 * that proves end-to-end:
 *   - the v2 onCall API import path resolves
 *   - the asia-south1 region pinning works
 *   - the apps/functions/src/index.ts barrel correctly forwards exports
 *   - the Firebase Functions emulator hosts the function at the expected URL
 *
 * Deliberately NOT auth-gated -- this is a deployment health check, not a real
 * feature. Every Phase 4 business callable that follows MUST gate on auth and
 * (typically) on roles[] in users/{uid}; see docs/V2_BUILD_PHASES.md Group P4.3
 * and onward for the pattern those will use.
 *
 * Region pinning: asia-south1 (Mumbai) matches the latency profile we want for
 * Indian audience writes from ZKid/ZConnect/Campus. If we ever migrate the
 * Firebase project to a different region, update both this file AND the
 * `firebase.json` functions.region default so the deploy + invoke path agree.
 */

import {onCall} from 'firebase-functions/v2/https';

export const ping = onCall(
  {
    region: 'asia-south1',
  },
  () => {
    return {
      ok: true,
      ts: Date.now(),
      region: 'asia-south1',
    };
  },
);
