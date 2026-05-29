/**
 * Entry point for the `@zerebro/functions` Firebase Functions project.
 *
 * Phase 3 shipped only the one-time user migration script under `src/scripts/`
 * (not a deployed Function — it runs locally via `pnpm migrate`).
 *
 * Phase 4 starts populating this barrel with deployed callables. The first one
 * is `ping`, a no-auth deployment smoke test (see `./callable/ping.ts`).
 *
 * Upcoming Phase 4 callables (added in later chunks):
 *   export {claimSchool}        from './callable/claimSchool';
 *   export {approvePrincipal}   from './callable/approvePrincipal';
 *   export {rotateInviteCode}   from './callable/rotateInviteCode';
 *   export {requestTeacherJoin} from './callable/requestTeacherJoin';
 *   export {approveTeacher}     from './callable/approveTeacher';
 *   export {joinSchoolAsParent} from './callable/joinSchoolAsParent';
 *   export {joinSchool}         from './callable/joinSchool';
 *   export {assignTopic}        from './callable/assignTopic';
 *   export {submitQuizAttempt}  from './callable/submitQuizAttempt';
 *   ...etc
 *
 * Keep this file as the ONLY `export` surface — Firebase Functions discovers
 * deployable functions by traversing the `index.js` exports tree.
 *
 * Region pinning lives here in code (via setGlobalOptions) rather than in
 * firebase.json — the firebase-tools schema for a `functions` entry does not
 * accept a `region` field, so per-function options or a single global default
 * are the supported mechanisms. Individual callables MAY override the global
 * (e.g. ping.ts pins asia-south1 explicitly for belt-and-suspenders clarity).
 */

import {setGlobalOptions} from 'firebase-functions/v2/options';

setGlobalOptions({
  region: 'asia-south1',
  maxInstances: 10,
  // Cloud Functions Gen 2 deploys a Cloud Run service per function. By
  // default the service has NO `allUsers` invoker binding, so any callable
  // hit by the Firebase Web SDK gets a 403 from the Cloud Run frontend
  // BEFORE the function code (or the v2 onCall envelope) ever runs. Setting
  // `invoker: 'public'` here makes `firebase deploy` add the binding for
  // every function in this barrel. Auth is still enforced INSIDE each
  // callable via `requireAuth()` / `requireRole()`; this only opens the
  // network door so the SDK can reach the function in the first place.
  invoker: 'public',
});

export {ping} from './callable/ping';

// P4.2 -- principal onboarding
export {claimSchool} from './callable/claimSchool';
export {rotateInviteCode} from './callable/rotateInviteCode';
export {approvePrincipal} from './callable/approvePrincipal';
export {rejectPrincipal} from './callable/rejectPrincipal';

// P4.3 -- teacher onboarding
export {rotateTeacherCode} from './callable/rotateTeacherCode';
export {requestTeacherJoin} from './callable/requestTeacherJoin';
export {approveTeacher} from './callable/approveTeacher';
export {rejectTeacher} from './callable/rejectTeacher';

// P4.4 -- parent + child school link (no approval gate; one-shot if code valid)
export {joinSchoolAsParent} from './callable/joinSchoolAsParent';
export {joinSchool} from './callable/joinSchool';

// P4.5 -- teacher assigns a curated topic to a class
export {assignTopic} from './callable/assignTopic';
