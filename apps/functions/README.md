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
    index.ts                # barrel for deployed Functions + global region pin
    scripts/
      oneTimeMigration_v1_to_v2.ts
    callable/               # P4+: ping (P4.1.1), assignTopic, approveTeacher, ...
    triggers/               # P4+: onQuizAttemptWrite, ...
    crons/                  # P5+: aggregateClassReports, ...
```

## Region

All deployed callables target **`asia-south1` (Mumbai)** — lowest latency for the
India-side mobile audience.

The region is set once in [`src/index.ts`](src/index.ts) via
`setGlobalOptions({region: 'asia-south1'})`. Individual callables MAY override
it via per-function options if a different region is ever needed (e.g. a
GPU-only model in `us-central1`); the override wins.

> Note: `firebase.json` does not accept a top-level `region` field for a
> `functions` config entry (firebase-tools schema only supports `region` inside
> hosting rewrites and the frameworks backend). Code-level `setGlobalOptions`
> is the supported single-source pin.

## Secrets (Phase 4+)

Secrets (third-party API keys, signing keys, etc.) are managed by the Firebase
CLI and surfaced to functions via the `defineSecret` params API. They are NOT
checked into git and NOT stored in `firebase.json`.

### Manage secrets via the CLI

```bash
# Create or update a secret (prompts for value, then stores in Google Secret Manager).
firebase functions:secrets:set MY_SECRET --project=kidsafe-e5eac

# Read the latest stored value (requires Secret Manager Secret Accessor IAM role).
firebase functions:secrets:access MY_SECRET --project=kidsafe-e5eac

# List metadata for a secret and its versions.
firebase functions:secrets:get MY_SECRET --project=kidsafe-e5eac

# Destroy a secret version (defaults to latest -- use with care).
firebase functions:secrets:destroy MY_SECRET --project=kidsafe-e5eac

# Garbage-collect secrets no longer referenced by any deployed function.
firebase functions:secrets:prune --project=kidsafe-e5eac
```

### Consume a secret inside a callable

```ts
import {defineSecret} from 'firebase-functions/params';
import {onCall} from 'firebase-functions/v2/https';

const MY_SECRET = defineSecret('MY_SECRET');

export const myCallable = onCall(
  {
    secrets: [MY_SECRET], // MUST be listed here for the function to receive it
  },
  async () => {
    const value = MY_SECRET.value(); // throws if not bound at runtime
    // ... use `value` ...
    return {ok: true};
  },
);
```

`MY_SECRET.value()` only resolves inside the function body (not at module
load) -- it's a lazy params accessor.

> Phase 4 itself does not introduce any secrets. This section is documented
> early so the first ticket that DOES need one (e.g. a YouTube Data API key
> for the reward catalog) does not also have to figure out the workflow.

## Deploy (Phase 4+)

All commands assume you have already run `firebase login` and either
`gcloud auth application-default login` OR exported
`GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`. See the
[Production pass](#2-production-pass) section above for the one-time setup.

```bash
# Deploy every function in the codebase (uses the `predeploy` in firebase.json
# to build TypeScript first).
pnpm --filter @zerebro/functions deploy

# Deploy a single function by name -- iterate fast on one callable without
# touching the others.
firebase deploy --only functions:ping --project=kidsafe-e5eac

# Deploy several specific functions in one shot.
firebase deploy --only functions:ping,functions:claimSchool --project=kidsafe-e5eac

# Validate the deploy config without actually pushing (handy for PR review).
firebase deploy --only functions:ping --project=kidsafe-e5eac --dry-run
```

Region default is `asia-south1` for all of the above (set in
[`src/index.ts`](src/index.ts)).

### Smoke-test the deployed `ping` callable

After a successful first deploy, you can confirm reachability:

```bash
# Public callable URL pattern (Gen2):
#   https://<region>-<project>.cloudfunctions.net/<functionName>
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"data":{}}' \
  https://asia-south1-kidsafe-e5eac.cloudfunctions.net/ping
# Expect: {"result":{"ok":true,"ts":<number>,"region":"asia-south1"}}
```

Same call against the emulator:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"data":{}}' \
  http://127.0.0.1:5001/kidsafe-e5eac/asia-south1/ping
```
