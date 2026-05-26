# @zerebro/functions

Firebase Cloud Functions for the Zerebro stack. Hosts:

- One-time migration scripts (`src/scripts/`) -- run locally, not deployed.
- Phase 4+ deployed callables (`src/callable/`) -- ship with `firebase deploy`.
- Phase 4+ Firestore triggers (`src/triggers/`).
- Phase 5+ scheduled crons (`src/crons/`).

Node 20 runtime, TypeScript, firebase-functions v6, firebase-admin v12.

## Setup

From the monorepo root:

```bash
pnpm install
```

Then for any Functions work:

```bash
pnpm --filter @zerebro/functions build         # tsc to dist/
pnpm --filter @zerebro/functions typecheck     # tsc --noEmit
pnpm --filter @zerebro/functions serve         # firebase emulators:start --only functions
pnpm --filter @zerebro/functions deploy        # firebase deploy --only functions
```

## P3.1.3 -- run the user-doc v1 -> v2 migration

The migration script normalizes every `users/{uid}` doc:

- `role: 'parent'`        -> `roles: ['parent'],  primaryRole: 'parent'`
- `role: 'child'`         -> `roles: ['child'],   primaryRole: 'child'`
- `roles: []` (web OTP)   -> `roles: ['parent'],  primaryRole: 'parent'`
- already migrated        -> skipped (no-op)

It is idempotent -- safe to re-run during the cutover.

### 1. Emulator pass

In one terminal:

```bash
pnpm dev:emulator
```

In a second terminal (defaults are safe -- dry-run + emulator):

```bash
pnpm --filter @zerebro/functions migrate                # dry-run, prints plan
pnpm --filter @zerebro/functions migrate -- --apply     # commits to emulator
```

Verify in the Emulator UI (http://localhost:4000/firestore/data/users):
inspect 5 random user docs -- each must now have `roles[]` and `primaryRole`.

### 2. Production pass

Production reads write to the live `kidsafe-e5eac` project.

**Auth options** (pick one):

A) Application-default credentials (one-time setup):

```bash
gcloud auth application-default login
gcloud config set project kidsafe-e5eac
```

B) Service account JSON (preferred for CI / repeatable runs):

1. Firebase Console -> Project settings -> Service accounts -> Generate
   new private key. Save as `~/.zerebro/kidsafe-admin.json` (anywhere
   outside the repo).
2. Export the path:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=~/.zerebro/kidsafe-admin.json
   ```

**Then run:**

```bash
pnpm --filter @zerebro/functions migrate -- --target=prod                # dry-run
pnpm --filter @zerebro/functions migrate -- --apply --target=prod        # commits
```

The `--apply --target=prod` path waits 5 seconds before any write so an
accidental run is recoverable with Ctrl-C.

Verify in the Firebase Console (Firestore -> users):
spot-check 5 docs for `roles[]` + `primaryRole` + a `migratedAt` timestamp.

### Re-running

The script is idempotent. Running it again after a successful pass
should print:

```text
[plan] 0 need migration, N already on v2 shape
[done] dry-run -- no writes performed. Re-run with --apply to commit.
```

## Layout

```text
apps/functions/
  package.json
  tsconfig.json
  src/
    index.ts                # barrel for deployed Functions (empty in P3)
    scripts/
      oneTimeMigration_v1_to_v2.ts
    callable/               # P4+: assignTopic, approveTeacher, ...
    triggers/               # P4+: onQuizAttemptWrite, ...
    crons/                  # P5+: aggregateClassReports, ...
```
