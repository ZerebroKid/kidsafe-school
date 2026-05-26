/**
 * Entry point for the `@zerebro/functions` Firebase Functions project.
 *
 * Phase 3 only ships the one-time user migration script under `src/scripts/`
 * (not a deployed Function — it runs locally via `pnpm migrate`).
 *
 * Phase 4 will populate this barrel with deployed callables:
 *   export {assignTopic}        from './callable/assignTopic';
 *   export {approveTeacher}     from './callable/approveTeacher';
 *   export {submitQuizAttempt}  from './callable/submitQuizAttempt';
 *   ...etc
 *
 * Keep this file as the ONLY `export` surface — Firebase Functions discovers
 * deployable functions by traversing the `index.js` exports tree.
 */

export {};
