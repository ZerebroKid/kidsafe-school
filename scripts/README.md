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
| `pnpm seed:staging` | Demo School + Demo Admin + Demo Principal + classes + subjects + curriculum + approved demo teacher (P4.2.9, P4.5) | Yes | Fresh emulator / staging without going through full onboarding |
| `pnpm grant-role` | Add or remove a role on `users/{uid}.roles[]` (P4.2.9) | Yes | Bootstrap first admin, or quick test-account role flips |
| `pnpm import:curriculum` | Walk `content/{curriculumId}/` and write the bundles to Firestore (P4.6.2) | Yes | Land new curated chapters / topics on emulator or prod |

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
- `users/<demoTeacherUid>` -- `roles=[]` (intentionally unroled), phone
  `+919999900003` (P4.3 -- ZConnect treats this as a fresh phone-OTP signup
  that needs to pick parent / teacher intent)
- `users/<demoParentUid>` -- `roles=[]` (intentionally unroled), phone
  `+919999900004` (P4.4 -- ZConnect treats this as a fresh phone-OTP signup
  so the user lands on the parent-vs-teacher intent picker, then can submit
  the school inviteCode to JoinSchoolAsParent)
- `users/<demoChildUid>` -- `roles=['child']`, `parentUid=<demoParentUid>`,
  `schoolIds` MISSING. Email `zkidchild_demo@kidsafe.test`, password
  `DemoChild#2026`. P4.4 -- pre-paired but not yet school-linked so ZKid
  lands directly on the new SchoolStep when signed in.
- `schools/demo_school_001` -- "Demo Public School", Mumbai, inviteCode
  `DEMO2026`, teacherCode `TEACH7`, principalUid pre-stamped to the demo
  principal
- `schools/demo_school_001/teachers/<demoTeacherUid>` -- `status='pending'`
  (P4.3 -- ready to be Approved from Campus /teachers)
- `schools/demo_school_001/classes/{8a,8b}` -- two classes for grade 8
- `schools/demo_school_001/classes/{8a,8b}/subjects/{science,maths,english}`
  -- three subjects per class with placeholder `curriculumId`

Existing docs are skipped on re-run.

## Manual QA — P4.5 Assign Topic

Run end-to-end on a fresh emulator to confirm the assign flow:

1. Boot:
   ```bash
   pnpm dev:emulator             # one terminal
   pnpm seed:staging -- --apply  # another terminal (idempotent)
   ```
2. Optionally re-import the curriculum bundle in isolation:
   ```bash
   pnpm import:curriculum -- --apply
   ```
   `seed:staging` already runs the importer internally; re-run only when
   you've edited `content/cbse_8_science/**/*.json`.
3. Sign in to Zerebro Campus (principal-web, port 3001) as the demo
   principal (phone `+919999900002`, OTP `123456` on emulator). Open
   Classes -> 8A and confirm the demo teacher (`+919999900003`) is in
   the teachers list.
4. Sign in to ZConnect on a device or emulator as the demo teacher
   (phone `+919999900003`, OTP `123456` on emulator). You should land
   directly on the Teacher home (RoleOnboardingGate is bypassed because
   the seed already flipped roles to `['teacher']`).
5. Tap **Assign a topic** -> pick Class 8A -> Science -> Ch 11. Force
   & Pressure -> Types of Forces. Tap **Assign**.
   - Expected: success toast, navigation pops back to Teacher home,
     the new card shows under today's assignments within ~2s.
6. Re-open Assign and try the same topic again.
   - Expected: red error toast "This topic is already assigned to
     this class today." (hard-block per the P4.5 plan).
7. Go to the Firebase emulator UI, find the new doc under
   `studyAssignments/`, and set `status='cancelled'`. Retry step 5 --
   the assignment should now succeed because the deterministic doc id
   was a stale cancelled record.
8. (Cross-role check) Sign into Zerebro Admin (admin-web, port 3002) as
   the demo admin (`+919999900001`). Navigate to **Curriculum** -> the
   `cbse_8_science` row -> Chapter 11 -> Topics. Click **View JSON** on
   any topic to confirm the import landed correctly; the green "schema ok"
   badge should be visible on every published row.

Failure modes worth checking: (a) sign in as a different teacher who
isn't in `class 8A.teacherIds` and assign -- expect `permission-denied`;
(b) tweak a topic JSON to set `status: 'draft'`, re-import, then try to
assign -- expect `failed-precondition` ("topic not published").

## Why scripts live in `apps/functions/src/scripts/`

We chose this layout (rather than top-level `scripts/*.ts`) so the scripts
inherit `apps/functions`'s `tsconfig.json`, can `import` from
`firebase-admin/*`, and reuse the Admin SDK init helpers from
`oneTimeMigration_v1_to_v2.ts`. The trade-off is that every script command
takes an extra `pnpm --filter @zerebro/functions build` step before
running, which root-level convenience scripts (`pnpm grant-role`,
`pnpm seed:staging`) hide.
