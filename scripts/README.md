# scripts/

Operational scripts that run **outside** the deployed Functions runtime.
Compiled TypeScript sources live under [`apps/functions/src/scripts/`](../apps/functions/src/scripts/);
this folder hosts the one shell wrapper (`dev-emulator.sh`) and is the entry
point users discover via `ls scripts/`.

Quick reference:

| Command | What it does | Idempotent? | Use case |
|---|---|---|---|
| `pnpm dev:emulator` | Boot Firebase emulators (auth + firestore + functions when callables exist) | Yes | Day-to-day local dev |
| `pnpm --filter @zerebro/functions migrate` | v1 -> v2 user-doc shape migration | Yes | One-shot per environment during Phase 3 cutover |
| `pnpm seed:staging` | Demo School + Demo Admin + Demo Principal + classes + subjects (P4.2.9) | Yes | Fresh emulator / staging without going through full onboarding |
| `pnpm grant-role` | Add or remove a role on `users/{uid}.roles[]` (P4.2.9) | Yes | Bootstrap first admin, or quick test-account role flips |

All three commands default to **dry-run** + `--target=emulator`. Pass
`--apply` to commit and `--target=prod` to point at the live project.

## Bootstrap the FIRST admin (production)

Before anybody can use the Zerebro Admin web in production we have to seed at
least one `users/{uid}.roles=['admin']` doc. There is no UI for this (chicken
+ egg: only admins can grant roles). Use `grant-role`:

```bash
# 1. Sign in once via the Zerebro Admin OTP flow with the admin's phone.
#    This creates the Firebase Auth user + an empty users/{uid} doc.
#
# 2. Set up service-account credentials (one-time per machine):
export GOOGLE_APPLICATION_CREDENTIALS=~/.zerebro/kidsafe-admin.json

# 3. Dry-run to confirm the script can find the user and shows the plan:
pnpm grant-role -- \
  --phone=+918791234849 \
  --role=admin \
  --target=prod

# 4. Commit:
pnpm grant-role -- \
  --phone=+918791234849 \
  --role=admin \
  --target=prod \
  --apply
```

The same flow works for any role:

```bash
pnpm grant-role -- --phone=+91... --role=teacher --apply       # emulator
pnpm grant-role -- --phone=+91... --role=teacher --remove --apply
```

## Seed a fresh staging environment

```bash
# emulator (default):
pnpm seed:staging               # dry-run
pnpm seed:staging -- --apply    # commit

# production (careful -- creates real auth users):
pnpm seed:staging -- --target=prod --apply
```

What lands:

- `users/<demoAdminUid>` -- `roles=['admin']`, `primaryRole='admin'`,
  phone `+919999900001`
- `users/<demoPrincipalUid>` -- `roles=['principal']`, `primaryRole='principal'`,
  phone `+919999900002`
- `schools/demo_school_001` -- "Demo Public School", Mumbai, inviteCode
  `DEMO2026`, principalUid pre-stamped to the demo principal
- `schools/demo_school_001/classes/{8a,8b}` -- two classes for grade 8
- `schools/demo_school_001/classes/{8a,8b}/subjects/{science,maths,english}`
  -- three subjects per class with placeholder `curriculumId`

Existing docs are skipped on re-run.

## Why scripts live in `apps/functions/src/scripts/`

We chose this layout (rather than top-level `scripts/*.ts`) so the scripts
inherit `apps/functions`'s `tsconfig.json`, can `import` from
`firebase-admin/*`, and reuse the Admin SDK init helpers from
`oneTimeMigration_v1_to_v2.ts`. The trade-off is that every script command
takes an extra `pnpm --filter @zerebro/functions build` step before
running, which root-level convenience scripts (`pnpm grant-role`,
`pnpm seed:staging`) hide.
