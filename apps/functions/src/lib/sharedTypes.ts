/**
 * Local copies of the few shared types this Functions package needs.
 *
 * WHY DUPLICATE INSTEAD OF IMPORTING from `@zerebro/shared-types`:
 *   Firebase Functions deploys upload only this directory (`apps/functions/`)
 *   to Cloud Build, which then runs `npm install` against the uploaded
 *   `package.json`. npm cannot resolve pnpm workspace specifiers like
 *   `workspace:*`, so even a type-only `import` forces us to keep the dep
 *   in `package.json`, which breaks Cloud Build. A `paths` mapping to
 *   `../../packages/shared-types` is rejected by tsc because the file
 *   ends up outside `rootDir`. The path of least resistance is to keep a
 *   small, well-fenced duplicate here -- this file is the ONLY allowed
 *   place to do so. Drift policy: any change to `Role` MUST be mirrored
 *   in [packages/shared-types/src/firestore.ts](../../../../packages/shared-types/src/firestore.ts).
 */

export type Role = 'admin' | 'principal' | 'teacher' | 'parent' | 'child';
