# V2 Build Phases — Detailed Execution Plan

> Companion to [EDUCATION_AI_TECH_SPEC.md](./EDUCATION_AI_TECH_SPEC.md).
> **Every task is sized 0.5 to 1 day** so any developer can pick one ticket and finish it in a single sitting.
> Each task includes: what you build, files touched, Firestore paths, dependencies, what feature it unlocks, and acceptance criteria.

---

## 0) How To Read This Doc

Each micro-task uses this format:

```text
### P<phase>.<group>.<task> — Title (Xh / Xd)

What you build:        one paragraph, plain English
Files / paths touched: which files this task creates or edits
Firestore paths:       which collections this reads or writes
Functions:             which Cloud Functions this defines or calls
Depends on:            which earlier tasks must be done
Unlocks:               which later tasks become possible
Interacts with:        how this connects to other parts of the system
Steps:                 numbered step-by-step
Acceptance:            testable checklist
```

Naming: `P<phase>.<group>.<task>`
- `P4.2.3` = Phase 4, group 2, task 3.
- Groups roughly map to the old single-letter sub-phases (P4.2 was "schools schema" — now it's a group of 5 tasks).

---

## 1) High-Level Timeline

```mermaid
gantt
  title Zerebro v2 Phased Delivery (detailed)
  dateFormat YYYY-MM-DD
  axisFormat %b %d

  section Phase 0 (Monorepo)
  Bootstrap + emulator     :p0, 2026-05-22, 7d

  section Phase 1 (v1 split)
  Code migration v1->v2    :p1, after p0, 12d

  section Phase 2 (Web shell)
  Web apps scaffolding     :p2, after p0, 7d

  section Phase 3 (Auth+Roles)
  Roles + role switcher    :p3, after p1, 6d

  section Phase 4 (Education MVP)
  Curriculum + study loop  :p4, after p3, 22d

  section Phase 5 (Dashboards)
  Principal + weak topics  :p5, after p4, 12d

  section Phase 6 (Pilot)
  Pilot + launch           :p6, after p5, 12d
```

| Phase | Micro-tasks | Days | Devs | Critical path |
|---|---|---|---|---|
| Phase 0 — Monorepo Bootstrap | 10 | 5–7 | 1 | yes |
| Phase 1 — Code Migration | 18 | 10–14 | 1–2 | yes |
| Phase 2 — Web Apps Scaffolding | 11 | 5–7 | 1 | parallel with P1 |
| Phase 3 — Auth + Multi-Role | 11 | 5–7 | 1 | yes |
| Phase 4 — Education MVP | 38 | 20–25 | 2 | yes |
| Phase 5 — Dashboards + Reports | 14 | 10–14 | 1–2 | yes |
| Phase 6 — Pilot + Launch | 14 | 10–14 | all hands | yes |
| **Total** | **~116 tickets** | **~70–90 days** | 1–2 | — |

That's roughly **10–13 calendar weeks** at 1.5 devs.

---

## 2) Feature Interaction Map (Read This First)

Before diving into tickets, here's how the **major features** chain together once Phase 4 ships. Knowing this makes each task make sense in context.

```mermaid
flowchart TD
  subgraph SetupFlow ["Setup (one-time per school)"]
    Admin["Admin creates School + invite"] --> Principal
    Principal["Principal claims School"] --> Class["Principal creates Class + Subject"]
    Class --> CurriculumLink["Subject -> curriculumId link"]
    ContentTeam["Content team curates JSON"] --> ImportScript["Import script writes curriculum/*"]
    ImportScript --> Topics["topics published"]
    Principal --> TeacherCode["Generate teacher code"]
    TeacherCode --> Teacher["Teacher signs up + principal approves"]
    Parent["Parent signs up + pairs"] --> ChildLink
    Child["Child completes ZKid onboarding"] --> SchoolCode["enters school+grade+section"]
    SchoolCode --> ChildLink["children/{uid}.classId set"]
  end

  subgraph DailyFlow ["Daily learning loop"]
    Teacher2["Teacher opens ZConnect (teacher mode)"] --> AssignTopic["assignTopic callable"]
    AssignTopic --> StudyAssign["studyAssignments/{id} created"]
    StudyAssign --> ChildSee["ZKid Study Mission shows new card"]
    ChildSee --> ReadTopic["Topic learn screen loads curriculum doc"]
    ReadTopic --> Quiz["Student takes quiz"]
    Quiz --> SubmitAttempt["submitQuizAttempt callable"]
    SubmitAttempt --> AttemptDoc["quizAttempts/{id} written"]
    AttemptDoc --> RewardTrigger["onQuizAttemptWrite trigger"]
    RewardTrigger --> Unlock["rewardUnlocks/{id} written if passed"]
    AttemptDoc --> ParentReport["ZConnect parent Study tab"]
    AttemptDoc --> TeacherReport["ZConnect teacher class report"]
  end

  subgraph PrincipalFlow ["Aggregation"]
    Nightly["aggregateClassReports cron"] --> Dashboards["classReports/{classId}/daily/{date}"]
    Dashboards --> PrincipalDash["Zerebro Campus dashboard"]
  end
```

### Data ownership

| Collection | Written by | Read by |
|---|---|---|
| `users/{uid}` | All apps on signup; Functions on role grant | All apps |
| `schools/{id}` | Admin web; Functions (claim/teacher approve) | Principal, ZConnect, ZKid |
| `schools/{id}/classes/{classId}` | Principal web | ZConnect, ZKid, Functions |
| `schools/{id}/teachers/{teacherId}` | Functions (`requestTeacherJoin`, `approveTeacher`) | Principal, ZConnect |
| `children/{uid}` | ZKid on onboarding; native services | ZConnect parent UI, Functions |
| `curriculum/{cId}/chapters/.../topics/{tId}` | Import script (admin only) | ZKid, ZConnect, Principal |
| `studyAssignments/{id}` | Function `assignTopic` (teacher only) | ZKid, ZConnect, Functions |
| `quizAttempts/{id}` | Function `submitQuizAttempt` (server-only) | ZConnect, Principal, Functions |
| `rewardCatalog/{id}` | Admin web | Functions (reward picker) |
| `rewardUnlocks/{id}` | Function trigger `onQuizAttemptWrite` | ZKid, ZConnect |
| `classReports/{classId}/daily/{date}` | Cron `aggregateClassReports` | Principal web |

### Who can write what (security rules summary)

```text
ZKid  (child role):
  WRITE  children/{ownUid}.currentLocation, locationDiagnostics
  WRITE  events/{ownUid}/*
  CALL   submitQuizAttempt
  READ   own assignment + curriculum + reward

ZConnect (parent role):
  READ   children where parentUid == self
  WRITE  apps, schedule on linked child
  READ   quizAttempts, rewardUnlocks for linked child

ZConnect (teacher role):
  READ   class members + curriculum
  CALL   assignTopic, requestTeacherJoin
  READ   quizAttempts for own class

Zerebro Campus (principal role):
  CRUD   schools/{ownSchoolId}/classes, subjects, teachers
  CALL   approveTeacher, rotateTeacherCode
  READ   classReports + all class quizAttempts in own school

Zerebro Admin (admin role):
  CRUD   schools, curriculum (via import), rewardCatalog
  READ   everything
```

---

## 3) Pre-Flight (Block until done)

These must be locked before any code is written.

### PF.1 — Lock open decisions (0.5 day)

Decide and write down (in a private team note):

- [ ] Web hosting: Vercel or Firebase Hosting (recommended: Vercel)
- [ ] Teacher code rotation cadence (recommended: manual by principal)
- [ ] Tablet-only child mode in v2: yes or defer
- [ ] iOS in v2: defer
- [ ] Pilot school name + contact

### PF.2 — Domains + DNS (0.5 day)

- [ ] Register `zerebrokid.com`
- [ ] DNS records ready for: `admin.zerebrokid.com`, `campus.zerebrokid.com`, plus `admin-staging.*`, `campus-staging.*`
- [ ] Wildcard SSL or Vercel-managed certs

### PF.3 — Brand assets (1 day)

- [ ] App icons + adaptive icons for **ZConnect** and **ZKid** (mipmap-anydpi-v26)
- [ ] Splash screens
- [ ] Favicons for **Zerebro Campus** and **Zerebro Admin**
- [ ] Color palette doc (reuse v1 if possible)

### PF.4 — Content team handshake (1 day)

- [ ] Lock JSON schema for one topic (see tech spec §8.3)
- [ ] Receive Class 8 Science full bundle (all chapters/topics) as JSON files
- [ ] Validate one topic by hand
- [ ] Decide hosting path for source JSON (private GitHub repo, Drive folder, etc.)

### PF.5 — Issue tracker (0.5 day)

- [ ] Linear/Jira project created
- [ ] Labels: `phase-0` through `phase-6`, `blocked`, `critical-path`
- [ ] Each task in this doc becomes one ticket using IDs `P0.1.1` etc.

**Definition of done:** All 5 checkboxes ✅, content JSON sample stored somewhere safe (not in this repo if large).

---

## Phase 0 — Monorepo Bootstrap (1 week)

**Goal:** Empty monorepo skeleton. No app code yet, no CI. Just enough scaffolding that Phase 1 can move v1 code in.

```mermaid
flowchart LR
  P011[P0.1.1 Repo skeleton] --> P012[P0.1.2 pnpm workspace]
  P012 --> P013[P0.1.3 Turborepo]
  P013 --> P014[P0.1.4 TS base]
  P014 --> P021[P0.2.x Shared packages]
  P021 --> P031[P0.3.x Firebase emulator]
```

### Group P0.1 — Repo + tooling

#### P0.1.1 — Repo skeleton (3h)

**What you build:** Branch + empty folder tree + root `package.json`.

**Files touched:**
- `package.json` (root) — `"private": true`, name `zerebro`
- `.gitignore` — node_modules, .turbo, build, .next, dist, android `.gradle`, build outputs
- `apps/`, `packages/`, `android-modules/`, `firestore/`, `scripts/` (empty `.gitkeep`)

**Depends on:** PF.1–PF.5
**Unlocks:** All of P0.

**Steps:**
1. `git checkout -b v2/monorepo-bootstrap`
2. `mkdir apps packages android-modules firestore scripts`
3. Add `.gitkeep` to each empty folder
4. Write minimal root `package.json`

**Acceptance:** `git status` is clean after a commit; folder tree exists.

#### P0.1.2 — pnpm workspace (3h)

**What you build:** pnpm workspace config + hoisted node-linker so React Native Metro can find native modules later.

**Files touched:**
- `pnpm-workspace.yaml`
- `.npmrc` (root) — `node-linker=hoisted`, `shamefully-hoist=true`, `public-hoist-pattern[]=*`
- `package.json` (root) — add `"packageManager": "pnpm@9.x.x"`

**Depends on:** P0.1.1
**Unlocks:** P0.2.x

**Steps:**
1. Add the configs above
2. `pnpm install` at root (no packages yet, validates config)

**Acceptance:** `pnpm install` exits 0, creates `pnpm-lock.yaml`.

#### P0.1.3 — Turborepo install + pipelines (3h)

**What you build:** Cached parallel build runner.

**Files touched:**
- `turbo.json` — `build`, `typecheck`, `test` pipelines (no `lint` — deferred)
- `package.json` — add `turbo` devDependency + scripts `build`, `typecheck`, `test`

**Depends on:** P0.1.2
**Unlocks:** P0.2.x

**Acceptance:** `pnpm turbo run typecheck` runs, exits 0 with "no targets".

#### P0.1.4 — TypeScript base config (3h)

**What you build:** Strict TS base config that every package extends.

**Files touched:**
- `tsconfig.base.json` — strict mode, target ES2022, module preserve, declarations on
- `tsconfig.json` (root) — project references stub

**Depends on:** P0.1.3
**Unlocks:** P0.2.x

**Acceptance:** `tsc --noEmit -p tsconfig.json` exits 0.

### Group P0.2 — Shared packages skeleton

> Each package is a one-file shell so later phases can fill it in.

#### P0.2.1 — `packages/shared-types/` shell (3h)

**What you build:** Empty types package.

**Files touched:**
- `packages/shared-types/package.json` — name `@zerebro/shared-types`
- `packages/shared-types/tsconfig.json` — extends base
- `packages/shared-types/src/index.ts` — `export {};`
- `packages/shared-types/src/firestore.ts` — placeholder
- `packages/shared-types/src/education.ts` — placeholder

**Acceptance:** `pnpm --filter @zerebro/shared-types build` succeeds.

#### P0.2.2 — `packages/shared-firebase/` shell (3h)

**What you build:** Empty Firebase helpers package with web + native entry points.

**Files touched:**
- `packages/shared-firebase/package.json`
- `packages/shared-firebase/src/index.web.ts` — placeholder
- `packages/shared-firebase/src/index.native.ts` — placeholder
- `packages/shared-firebase/src/auth.ts` — placeholder
- `packages/shared-firebase/src/firestore.ts` — placeholder
- Conditional exports in `package.json` (`browser` vs `react-native`)

**Acceptance:** Both entry points typecheck.

#### P0.2.3 — `packages/shared-utils/` shell (2h)

**What you build:** Platform-agnostic utilities.

**Files touched:**
- `packages/shared-utils/package.json`
- `packages/shared-utils/src/dates.ts` — stub
- `packages/shared-utils/src/validators.ts` — stub

**Acceptance:** `pnpm -r typecheck` exits 0.

### Group P0.3 — Firestore + emulator

#### P0.3.1 — Firestore rules + indexes seed (3h)

**What you build:** Copy v1 rules into monorepo as a starting point.

**Files touched:**
- `firestore/rules` — copied from v1 `firestore.rules`
- `firestore/indexes.json` — copied from v1

**Acceptance:** Rules file lints with `firebase deploy --only firestore:rules --dry-run` (run from CLI).

#### P0.3.2 — Firebase config + emulator script (3h)

**What you build:** Emulator wiring so any dev can run `pnpm dev:emulator`.

**Files touched:**
- `firebase.json` — emulators block (auth 9099, firestore 8080, functions 5001, hosting 5000, ui 4000)
- `scripts/dev-emulator.sh` — `firebase emulators:start --import=./.emulator-data --export-on-exit`
- `package.json` — script `"dev:emulator": "bash scripts/dev-emulator.sh"`

**Depends on:** P0.3.1
**Unlocks:** All later phases use emulator for local dev.

**Acceptance:** `pnpm dev:emulator` boots, UI accessible at `localhost:4000`.

### Phase 0 Definition Of Done

```text
✅ monorepo installs cleanly with pnpm
✅ 3 shared packages typecheck
✅ Firebase emulator boots
✅ Branch merged to v2/main
```

---

## Phase 1 — Code Migration v1 → v2 (2 weeks)

**Goal:** v1 KidSafe code lives split across `apps/guardian/` (ZConnect) and `apps/kids/` (ZKid). Both produce working APKs identical in behavior to v1.

```mermaid
flowchart TD
  P11[P1.1.x Bootstrap apps/kids/] --> P12[P1.2.x Bootstrap apps/guardian/]
  P12 --> P13[P1.3.x Extract child code -> ZKid]
  P13 --> P14[P1.4.x Extract parent code -> ZConnect]
  P14 --> P15[P1.5.x Split native modules]
  P15 --> P16[P1.6.x Drop shared mode]
  P16 --> P17[P1.7.x Delete v1 root]
```

### Group P1.1 — Bootstrap ZKid app

#### P1.1.1 — Init RN project (3h)

**What you build:** Fresh RN project at `apps/kids/`.

**Files touched:**
- `apps/kids/*` (RN init scaffold)
- `apps/kids/package.json` — name `@zerebro/zkid`

**Steps:**
1. `pnpm dlx @react-native-community/cli@latest init kids --pm pnpm`
2. Move into `apps/kids/`
3. Delete extra files we don't need

**Acceptance:** `pnpm --filter @zerebro/zkid android` builds and launches empty RN app.

#### P1.1.2 — Monorepo Metro config (3h)

**What you build:** Metro config that resolves modules from workspace root.

**Files touched:**
- `apps/kids/metro.config.js` — workspace `watchFolders`, hoisted `nodeModulesPaths`, `disableHierarchicalLookup`

**Depends on:** P1.1.1
**Unlocks:** P1.3.x (so shared packages resolve)

**Acceptance:** `import {} from '@zerebro/shared-types'` works in a test file.

#### P1.1.3 — Android applicationId + launcher name (3h)

**What you build:** Brand ZKid on the Android home screen.

**Files touched:**
- `apps/kids/android/app/build.gradle` — `applicationId "com.kidsafe.kids"`
- `apps/kids/android/app/src/main/AndroidManifest.xml` — `android:label`
- `apps/kids/android/app/src/main/res/values/strings.xml` — `app_name = "ZKid"`
- Adaptive icon assets in `mipmap-*` (placeholder from PF.3)

**Acceptance:** App installs as "ZKid" on launcher.

#### P1.1.4 — NativeWind + Tailwind config (3h)

**What you build:** Tailwind CSS for React Native.

**Files touched:**
- `apps/kids/package.json` — `nativewind`, `tailwindcss` deps
- `apps/kids/tailwind.config.js`
- `apps/kids/babel.config.js` — `nativewind/babel`
- `apps/kids/app/global.css` (or wherever NativeWind expects)

**Acceptance:** `<View className="bg-red-500" />` renders red.

### Group P1.2 — Bootstrap ZConnect app

#### P1.2.1 — Init RN + Metro (4h)

Same as P1.1.1 + P1.1.2 combined, but for `apps/guardian/`.

**Acceptance:** Both ZKid and ZConnect can build and run side-by-side on one device (different package ids).

#### P1.2.2 — Android brand (3h)

**Files touched:**
- `apps/guardian/android/app/build.gradle` — `applicationId "com.kidsafe.guardian"`
- `apps/guardian/android/app/src/main/res/values/strings.xml` — `app_name = "ZConnect"`
- Icon assets

**Acceptance:** App installs as "ZConnect".

#### P1.2.3 — NativeWind config (2h)

Same as P1.1.4 but for guardian.

### Group P1.3 — Migrate child code → ZKid

#### P1.3.1 — Move screens (4h)

**What you build:** v1 child screens live in ZKid.

**Files touched:**
- `src/screens/child/*` → `apps/kids/src/screens/child/`
- Update import paths

**Interacts with:** Existing v1 Firestore data — ZKid reads/writes the same `children/{uid}` collection.

**Acceptance:** ZKid launches v1 onboarding wizard.

#### P1.3.2 — Move child sync engine (4h)

**Files touched:**
- `src/services/childSyncEngine.ts` → `apps/kids/src/services/`
- `src/modules/native.ts` → `apps/kids/src/modules/`
- All native bridge calls (Location, ForegroundService, etc.)

**Acceptance:** Child can pair with v1 Guardian APK still installed elsewhere.

#### P1.3.3 — Extract types to `shared-types` (4h)

**What you build:** Pull Firestore contracts out of app code so ZConnect can reuse them.

**Files touched:**
- `src/firebase/types.ts` → `packages/shared-types/src/firestore.ts`
- Update imports in `apps/kids/`

**Interacts with:** Phase 4 will add `education.ts` here.

**Acceptance:** `import { ChildDoc, UserDoc } from '@zerebro/shared-types'` compiles.

#### P1.3.4 — Extract Firestore client to `shared-firebase` (4h)

**Files touched:**
- `src/firebase/firestore.ts` → `packages/shared-firebase/src/firestore.ts`
- `src/firebase/auth.ts` → `packages/shared-firebase/src/auth.ts`
- Native-side entry point exports

**Acceptance:** Both apps import from `@zerebro/shared-firebase`.

### Group P1.4 — Migrate parent code → ZConnect

#### P1.4.1 — Move parent screens (4h)

**Files touched:**
- `src/screens/parent/*` → `apps/guardian/src/screens/parent/`
- `src/navigation/ParentNavigator.tsx` → `apps/guardian/src/navigation/`

**Acceptance:** ZConnect shows parent home using v1 Firestore data.

#### P1.4.2 — Move map + child details + tabs (4h)

**Files touched:**
- `LocationTab.tsx`, `ChildDetailsScreen.tsx`, `CurrentAppPill.tsx`, etc.

**Acceptance:** Parent map + Apps/Schedule/Location/Usage/PIN tabs functional.

### Group P1.5 — Split native modules

Each native module becomes its own Gradle library that **only ZKid** consumes.

#### P1.5.1 — Skeleton Gradle library template (3h)

**What you build:** Template for one android-module that the next 4 tickets reuse.

**Files touched:**
- `android-modules/_template/build.gradle`
- `android-modules/_template/src/main/AndroidManifest.xml`

**Acceptance:** A copy-paste of `_template` builds as an empty AAR.

#### P1.5.2 — `android-modules/location-writer/` (4h)

**Files touched:**
- LocationWriter.kt
- LocationToggleReceiver.kt
- KidSafeForegroundService.kt (location bits)
- `android-modules/location-writer/build.gradle`

**Interacts with:**
- ZKid → registers this module via Gradle.
- ZConnect → does **not** register (smaller APK).
- Writes to `children/{uid}.currentLocation` and `.locationDiagnostics`.

**Acceptance:** Builds standalone; ZKid debug APK still tracks location.

#### P1.5.3 — `android-modules/app-blocker/` (3h)

App accessibility service.

**Acceptance:** Blocked apps overlay still works on ZKid.

#### P1.5.4 — `android-modules/screen-time/` (3h)

UsageStats writer.

#### P1.5.5 — `android-modules/pin/` + `device-admin/` (3h)

#### P1.5.6 — Wire ZKid Gradle to all 5 modules (3h)

**Files touched:**
- `apps/kids/android/settings.gradle` — `include ':android-modules:location-writer'` etc.
- `apps/kids/android/app/build.gradle` — `implementation project(':android-modules:location-writer')`

**Acceptance:**
- ZKid release APK builds and behaves identical to v1 child mode.
- ZConnect release APK is ~40% smaller (no heavy native modules).

### Group P1.6 — Drop shared mode

#### P1.6.1 — Delete shared screens + types (3h)

**Files touched:**
- Delete `src/screens/shared/*` references
- Delete `ChildModeState` shared-mode fields from `shared-types`
- Remove mode selection from onboarding

**Acceptance:** Shared mode unreachable from UI; typecheck passes.

#### P1.6.2 — Update Firestore rules to drop `_shared` (2h)

**Files touched:**
- `firestore/rules` — remove `${parentUid}_shared` child id pattern

**Acceptance:** Rules tests pass.

### Group P1.7 — Clean up v1 root

#### P1.7.1 — Delete root `src/` + `android/` (3h)

**Files touched:** Delete root `src/`, `android/`, root `package.json` mobile deps.

**Acceptance:** `git grep "src/screens/parent"` returns only paths under `apps/`.

#### P1.7.2 — Update README to point at new app folders (2h)

### Phase 1 DoD

```text
✅ apps/kids release APK behaves like v1 child install
✅ apps/guardian release APK behaves like v1 parent install
✅ v1 Firestore data is untouched
✅ both apps coexist on one phone (different package ids)
```

---

## Phase 2 — Web Apps Scaffolding (1 week, parallel with P1)

**Goal:** Empty **Zerebro Campus** and **Zerebro Admin** deployed to staging, with phone OTP login.

```mermaid
flowchart LR
  P211[P2.1.1 Next.js init Campus] --> P221[P2.2.x Phone Auth]
  P212[P2.1.2 Next.js init Admin] --> P221
  P221 --> P231[P2.3.x Dashboards stub]
  P231 --> P241[P2.4.x Deploy staging]
```

### Group P2.1 — Next.js scaffolding

#### P2.1.1 — Init Zerebro Campus (3h)

**Files touched:**
- `apps/principal-web/*` — `pnpm create next-app@latest` with App Router + Tailwind + TS

**Acceptance:** `pnpm --filter @zerebro/campus dev` runs on `localhost:3001`.

#### P2.1.2 — Init Zerebro Admin (3h)

Same for `apps/admin-web/`, runs on `localhost:3002`.

#### P2.1.3 — Tailwind shared theme (2h)

**What you build:** Same color tokens on both web apps (no shared-ui package — utility classes only).

**Files touched:**
- `apps/principal-web/tailwind.config.ts` — colors
- `apps/admin-web/tailwind.config.ts` — same colors

**Acceptance:** Brand colors render identically on both apps.

### Group P2.2 — Phone OTP login

#### P2.2.1 — Firebase client SDK wiring (3h)

**Files touched:**
- `packages/shared-firebase/src/index.web.ts` — `initializeApp`, `getAuth`, `getFirestore` for web
- Both web apps consume this

**Acceptance:** Firebase initializes on page load without errors.

#### P2.2.2 — Login page with reCAPTCHA + OTP send (4h)

**Files touched:**
- `apps/principal-web/app/login/page.tsx` — phone input, reCAPTCHA v2, "Send OTP"
- Same in admin-web
- `signInWithPhoneNumber` from `firebase/auth`

**Firestore paths:** Reads nothing yet; writes `users/{uid}` on confirm.

**Acceptance:** SMS OTP arrives on phone; user can submit code.

#### P2.2.3 — OTP confirm + user doc upsert (3h)

**Files touched:**
- `apps/principal-web/app/login/confirm/page.tsx`
- Server action that upserts `users/{uid}` with `phone`, `roles: []`, `createdAt`

**Firestore paths:** writes `users/{uid}` (create if missing)

**Interacts with:** Phase 3 fills `roles[]` on this same doc.

**Acceptance:** After login, `users/{uid}` exists in Firestore.

### Group P2.3 — Dashboard stub + nav

#### P2.3.1 — Sidebar nav for Campus (3h)

**Files touched:**
- `apps/principal-web/app/layout.tsx` — sidebar with `/dashboard`, `/teachers`, `/syllabus`
- All tailwind utility classes

**Acceptance:** Click each link → "Coming soon" page.

#### P2.3.2 — Sidebar nav for Admin (3h)

Same for admin-web: `/schools`, `/syllabus-sources`, `/rewards`, `/users`, `/audit`.

#### P2.3.3 — Logout button (1h)

**Acceptance:** Logout clears Firebase session, redirects to `/login`.

### Group P2.4 — Staging deployment

#### P2.4.1 — Deploy Campus to Vercel (3h)

**Files touched:**
- `apps/principal-web/.env.example` — Firebase config keys
- Vercel project linked to monorepo, root = `apps/principal-web`
- Domain: `campus-staging.zerebrokid.com`

**Acceptance:** Public URL loads login page.

#### P2.4.2 — Deploy Admin to Vercel (2h)

Domain: `admin-staging.zerebrokid.com`.

### Phase 2 DoD

```text
✅ Both web apps deployed and reachable
✅ Phone OTP login creates users/{uid}
✅ Empty dashboards with sidebar nav
```

---

## Phase 3 — Auth + Roles + Multi-Role (1 week)

**Goal:** `users.roles[]` array everywhere; role switcher in ZConnect; Firestore rules enforce roles.

```mermaid
flowchart TD
  P311[P3.1.x Migrate users to roles array] --> P321[P3.2.x Update types]
  P321 --> P331[P3.3.x Role switcher UI]
  P331 --> P341[P3.4.x Rules helpers]
  P341 --> P342[P3.4.x Rules per collection]
  P342 --> P343[P3.4.x Rules unit tests]
```

### Group P3.1 — User migration

#### P3.1.1 — Scaffold `apps/functions/` (3h)

**What you build:** Firebase Functions project so we can host the migration script + later Education callables.

**Files touched:**
- `apps/functions/package.json`
- `apps/functions/src/index.ts` — exports nothing yet
- `apps/functions/tsconfig.json`
- `firebase.json` — add `functions` block

**Acceptance:** `firebase deploy --only functions --dry-run` validates project.

#### P3.1.2 — One-time migration script (3h)

**Files touched:**
- `apps/functions/src/crons/oneTimeMigration_v1_to_v2.ts`
- Reads every `users/*`, if `role: string` → write `roles: [role]`, `primaryRole: role`
- Idempotent: skip docs that already have `roles[]`

**Firestore paths:** Read/write `users/*`

**Acceptance:** Dry-run on staging — all docs have `roles[]` after; re-running is a no-op.

#### P3.1.3 — Run on staging + verify (1h)

**Acceptance:** Manual spot-check 5 user docs.

### Group P3.2 — Type updates

#### P3.2.1 — `UserDoc` type update (3h)

**Files touched:**
- `packages/shared-types/src/firestore.ts` — `roles: Role[]`, `primaryRole: Role`, deprecate `role: string`
- Re-export `type Role = 'admin' | 'principal' | 'teacher' | 'parent' | 'child'`

#### P3.2.2 — `shared-firebase/auth.ts` returns roles (3h)

**Files touched:**
- `getCurrentUserDoc()` returns the new shape
- Backwards-compat fallback: if `roles` missing, derive from old `role`

**Interacts with:** Used by all 4 apps + functions.

**Acceptance:** Apps compile against new shape; un-migrated users still load.

#### P3.2.3 — Update reads in ZConnect, ZKid, web apps (4h)

**Files touched:** Every place that reads `.role` switches to `.roles[]`.

**Acceptance:** All 4 apps run against staging data.

### Group P3.3 — Role switcher UI (ZConnect only)

#### P3.3.1 — `RoleSwitcher` component (3h)

**What you build:** Pill switcher at top of ZConnect home when user has 2+ roles.

**Files touched:**
- `apps/guardian/src/components/RoleSwitcher.tsx` — NativeWind styles
- Pill UI: `[ Parent ] [ Teacher ]`

**Interacts with:**
- Reads `users/{uid}.roles[]` and `.primaryRole`
- Persists selection to `users/{uid}.primaryRole`

**Acceptance:** User with `["parent","teacher"]` sees switcher; tap persists.

#### P3.3.2 — Wire switcher into home navigator (3h)

**Files touched:**
- `apps/guardian/src/navigation/` — switch root navigator based on `primaryRole`
- Defense-in-depth: if `roles` includes `child`, do **not** render ZKid screens

**Acceptance:** Switching role swaps the home stack instantly.

#### P3.3.3 — Default-role logic on first login (2h)

**Files touched:**
- If `roles.length === 1`, no switcher; `primaryRole = that role`
- If `roles.length === 0` (brand new user), navigate to onboarding gate

**Acceptance:** New users land on onboarding; single-role users skip switcher.

### Group P3.4 — Firestore rules

#### P3.4.1 — Rules helper functions (3h)

**Files touched:**
- `firestore/rules` — add `isAdmin()`, `isPrincipal()`, `isTeacher()`, `isParent()`, `belongsToSchool(schoolId)`, `isOwnChild(childUid)`

**Acceptance:** Helpers compile.

#### P3.4.2 — Gate education collections (3h)

**Files touched:**
- Rules for `schools/*`, `studyAssignments/*`, `quizAttempts/*` (collections will be created in Phase 4, rules ready now)
- Defense-in-depth: ZKid cannot read `studyAssignments` for classes other than own

**Acceptance:** Manual review by 1 dev + rules compile.

#### P3.4.3 — Rules unit tests (4h)

**Files touched:**
- `firestore/__tests__/rules.test.ts` — `@firebase/rules-unit-testing`
- 10 allow cases + 10 deny cases minimum

**Acceptance:** `pnpm test --filter firestore-rules` passes.

### Phase 3 DoD

```text
✅ users have roles[] in production
✅ role switcher live in ZConnect
✅ rules enforce role on every collection
✅ migration ran on staging successfully
```

---

## Phase 4 — Education MVP (3–4 weeks)

**Goal:** Teacher assigns a topic → child reads curated lesson → takes quiz → reward unlocks → parent + teacher see the score.

This is the **biggest phase**. Broken into 7 groups, 38 micro-tasks.

```mermaid
flowchart TD
  P41[Group 4.1 Functions scaffold] --> P42[Group 4.2 Schools + curriculum schema]
  P42 --> P43[Group 4.3 Teacher onboarding]
  P42 --> P44[Group 4.4 Child + school link]
  P43 --> P45[Group 4.5 Assign topic]
  P44 --> P45
  P42 --> P46[Group 4.6 Curated content import]
  P46 --> P47[Group 4.7 Topic learn screen]
  P45 --> P48[Group 4.8 Study Mission UI]
  P47 --> P49[Group 4.9 Quiz + scoring]
  P49 --> P410[Group 4.10 Reward unlock]
  P49 --> P411[Group 4.11 Parent + teacher reports]
```

### Group P4.1 — Cloud Functions scaffold

#### P4.1.1 — Functions deploy + ping callable (3h)

**Files touched:**
- `apps/functions/src/index.ts` — `export { ping } from './callable/ping'`
- `apps/functions/src/callable/ping.ts` — returns `{ ok: true, ts: Date.now() }`

**Acceptance:** Calling `ping` from emulator + staging both return ok.

#### P4.1.2 — Functions env + secrets wiring (2h)

**Files touched:**
- `firebase.json` — secrets block
- README addendum on `firebase functions:secrets:set`

**Acceptance:** Empty secret can be set and read.

### Group P4.2 — Schools + curriculum schema

#### P4.2.1 — Types: school / class / subject (3h)

**Files touched:**
- `packages/shared-types/src/education.ts`:
  - `SchoolDoc` — `name`, `city`, `principalUid`, `teacherCode`
  - `ClassDoc` — `grade`, `section`, `className`, `academicYear`, `teacherIds[]`, `studentChildUids[]`
  - `SubjectDoc` — `name`, `code`, `curriculumId`, `teacherIds[]`

**Interacts with:** All apps + functions import these.

**Acceptance:** Types compile in all 4 apps.

#### P4.2.2 — Types: curriculum / chapter / topic (3h)

**Files touched:**
- `CurriculumDoc` — `id`, `board`, `grade`, `subject`
- `ChapterDoc` — `chapterName`, `chapterNo`, `status`
- `TopicContent` — full curated shape from tech spec §8.3:
  - `explanation`, `examples[]`, `videoUrl`
  - `brainstorming[{question, answer, videoUrl}]`
  - `quiz[{questionId, type, question, options[], correctIndex, explanation}]`
  - `status: 'draft' | 'published'`

**Acceptance:** Types compile.

#### P4.2.3 — Admin-web: create school UI (4h)

**Files touched:**
- `apps/admin-web/app/schools/page.tsx` — list
- `apps/admin-web/app/schools/new/page.tsx` — form
- Server action writes `schools/{id}`

**Firestore paths:** `schools/{id}` write

**Interacts with:** Phase 4.3 (principal claim flow) uses this school doc.

**Acceptance:** Admin can create a school + see it in list.

#### P4.2.4 — Principal-web: create class + subject UI (4h)

**Files touched:**
- `apps/principal-web/app/classes/page.tsx` — list classes for own school
- `apps/principal-web/app/classes/new/page.tsx` — form (grade, section)
- Subject sub-form: name + `curriculumId` dropdown (curriculum list seeded in P4.6)

**Firestore paths:**
- `schools/{schoolId}/classes/{classId}` write
- `schools/{schoolId}/classes/{classId}/subjects/{subjectId}` write

**Interacts with:** Teacher (P4.3) gets assigned to classes; child onboarding (P4.4) joins a class.

**Acceptance:** Principal creates 2 classes + 3 subjects per class.

#### P4.2.5 — Seed script (sample school + classes) (2h)

**Files touched:**
- `scripts/seed-staging.ts` — creates `Demo School`, Class 8A, Class 8B, Science + Maths

**Acceptance:** Running on emulator populates staging.

### Group P4.3 — Teacher onboarding

#### P4.3.1 — `rotateTeacherCode` callable (3h)

**What it does:** Principal-only callable that writes a fresh 6-char code to `schools/{id}.teacherCode`.

**Files touched:**
- `apps/functions/src/callable/rotateTeacherCode.ts`

**Interacts with:**
- Reads: caller must be principal of the school
- Writes: `schools/{id}.teacherCode`, `teacherCodeRotatedAt`

**Acceptance:** Returns new code; non-principal call rejected.

#### P4.3.2 — Principal-web: teacher code button (3h)

**Files touched:**
- `apps/principal-web/app/teachers/code/page.tsx` — shows current code + "Rotate" button
- Calls `rotateTeacherCode`

**Acceptance:** Click rotate → new code displayed.

#### P4.3.3 — `requestTeacherJoin` callable (3h)

**Files touched:**
- `apps/functions/src/callable/requestTeacherJoin.ts` — input `{ teacherCode, displayName }`
- Looks up school by `teacherCode`
- Writes `schools/{schoolId}/teachers/{teacherId}` with `status: 'pending'`, `userId: caller.uid`

**Firestore paths:**
- Read: `schools/*` query where `teacherCode == X`
- Write: `schools/{id}/teachers/{teacherId}`

**Acceptance:** Wrong code rejected; valid code creates pending record.

#### P4.3.4 — ZConnect: "I am a teacher" entry (3h)

**Files touched:**
- `apps/guardian/src/screens/teacher/JoinScreen.tsx`
- Form: teacher code + display name
- Calls `requestTeacherJoin`
- Polls own pending status

**Acceptance:** Pending state shows "Waiting for principal approval".

#### P4.3.5 — Principal-web: approve/reject teachers (3h)

**Files touched:**
- `apps/principal-web/app/teachers/page.tsx` — list `status: 'pending'`
- Approve button calls `approveTeacher`

#### P4.3.6 — `approveTeacher` callable (3h)

**Files touched:**
- `apps/functions/src/callable/approveTeacher.ts`
- Updates `schools/{id}/teachers/{teacherId}.status = 'active'`
- Adds `'teacher'` to `users/{teacherUid}.roles`

**Firestore paths:**
- Write: `users/{uid}.roles += 'teacher'`
- Write: teacher doc status

**Interacts with:** Triggers ZConnect role switcher to show teacher mode (P3.3).

**Acceptance:** After approval, teacher's ZConnect home unlocks teacher tab.

### Group P4.4 — Child + school link

#### P4.4.1 — ZKid: school code + grade + section step (4h)

**Files touched:**
- `apps/kids/src/screens/child/onboarding/SchoolStep.tsx` — new step after pairing
- Inputs: school code, grade, section
- Calls `joinSchool` callable

**Acceptance:** Step shown after pairing; cannot skip.

#### P4.4.2 — `joinSchool` callable (3h)

**Files touched:**
- `apps/functions/src/callable/joinSchool.ts`
- Validates school exists, finds class by grade+section
- Writes `children/{childUid}.classId = {schoolId, classId}`
- Adds `childUid` to `classes/{classId}.studentChildUids[]`

**Firestore paths:**
- Read: `schools/{id}/classes/*` query
- Write: `children/{uid}.classId`, `classes/*.studentChildUids[]`

**Interacts with:** Teacher (P4.3) can now see this child in class.

**Acceptance:** Class roster updates with child name.

#### P4.4.3 — Principal-web: class roster view (3h)

**Files touched:**
- `apps/principal-web/app/classes/[id]/page.tsx` — show child list

**Acceptance:** Principal sees 1 child after onboarding completes.

### Group P4.5 — Assign topic

#### P4.5.1 — `assignTopic` callable (4h)

**Files touched:**
- `apps/functions/src/callable/assignTopic.ts`
- Inputs: `{ schoolId, classId, subjectId, chapterId, topicId, dueAt }`
- Validates caller is teacher of class
- Writes `studyAssignments/{id}` with `assignedDate`, `dueAt`, `status: 'active'`

**Firestore paths:**
- Read: caller's teacher status
- Write: `studyAssignments/{id}`

**Interacts with:**
- ZKid Study Mission (P4.8) listens to `studyAssignments` filtered by own `classId`
- Teacher dashboard (P4.11) lists own assignments

**Acceptance:** Returns assignment id; second teacher cannot assign to another class.

#### P4.5.2 — ZConnect (teacher mode): assign topic UI (4h)

**Files touched:**
- `apps/guardian/src/screens/teacher/AssignScreen.tsx`
- Dropdowns: class → subject → chapter → topic
- "Assign Today" button

**Firestore paths:**
- Reads: teacher's classes, subjects, `curriculum/.../topics` where `status = 'published'`
- Calls `assignTopic`

**Acceptance:** Teacher picks a topic from real Class 8 Science curriculum, assigns it.

#### P4.5.3 — Teacher "today's assignments" list (3h)

**Files touched:**
- `apps/guardian/src/screens/teacher/HomeScreen.tsx` — list today's `studyAssignments` by teacher

**Acceptance:** Just-assigned topic appears.

### Group P4.6 — Curated content import

#### P4.6.1 — JSON schema for topic (3h)

**What you build:** Strict JSON schema for `TopicContent`.

**Files touched:**
- `packages/shared-types/src/schemas/topicContent.schema.json` (JSON Schema)
- Validator function `validateTopicContent(json)` using `ajv` or `zod`

**Acceptance:** Sample JSON from content team passes; intentionally-broken JSON fails with clear message.

#### P4.6.2 — `scripts/import-curriculum.ts` (4h)

**What you build:** CLI script that reads a folder of JSON files and bulk-writes to Firestore.

**Files touched:**
- `scripts/import-curriculum.ts`:
  - Walks folder e.g. `content/cbse_8_science/`
  - For each topic JSON: validate → write to `curriculum/cbse_8_science/chapters/{chId}/topics/{tId}`
  - Uses Firebase Admin SDK (server credentials)
  - `--dry-run` flag

**Firestore paths:**
- Write: `curriculum/*/chapters/*/topics/*`

**Interacts with:** Topic learn screen (P4.7) reads from these docs.

**Acceptance:** Import full Class 8 Science → all chapters/topics in Firestore with `status: 'published'`.

#### P4.6.3 — Admin-web: curriculum preview (4h)

**Files touched:**
- `apps/admin-web/app/curriculum/page.tsx` — list curricula
- `apps/admin-web/app/curriculum/[id]/page.tsx` — chapters + topics
- Click topic → JSON viewer + rendered preview

**Acceptance:** Admin team can QA imported topics without opening Firestore console.

#### P4.6.4 — Re-run import idempotency (2h)

**What you build:** Make import script safe to re-run (no duplicate writes, update existing docs).

**Acceptance:** Running import twice = same Firestore state.

### Group P4.7 — Topic learn screen (ZKid)

#### P4.7.1 — Fetch + render explanation + examples (3h)

**Files touched:**
- `apps/kids/src/screens/learn/TopicScreen.tsx` — reads `curriculum/.../topics/{topicId}`
- Renders `explanation` (formatted) + `examples` as bulleted list

**Firestore paths:** Read `curriculum/.../topics/{id}`

**Acceptance:** Real Class 8 Science topic renders.

#### P4.7.2 — Intro video player (3h)

**Files touched:**
- YouTube safe webview component (no related videos, no comments)
- Renders `videoUrl`

**Acceptance:** Video plays inline; back button returns to topic screen.

#### P4.7.3 — Brainstorming expandable cards (4h)

**Files touched:**
- `BrainstormingSection.tsx` — accordion of `brainstorming[]` items
- Each card: question, answer (collapsed), embedded video link

**Acceptance:** All 3 brainstorming items expand/collapse smoothly.

#### P4.7.4 — "Start Quiz" CTA (1h)

**Files touched:**
- Bottom button navigates to `QuizScreen.tsx` with `topicId` + `assignmentId`

**Acceptance:** Tap → quiz screen.

### Group P4.8 — Study Mission UI (ZKid)

#### P4.8.1 — Study Mission card list (3h)

**Files touched:**
- `apps/kids/src/screens/learn/StudyMissionScreen.tsx`
- Subscribes to `studyAssignments` where `classId == childClassId` and `assignedDate == today`
- Card per assignment: topic name, status, "Start Learning", "Take Quiz"

**Firestore paths:** Read `studyAssignments/*`

**Interacts with:**
- "Start Learning" → opens `TopicScreen` (P4.7)
- "Take Quiz" → opens `QuizScreen` (P4.9)

**Acceptance:** When teacher assigns, ZKid card appears within seconds.

#### P4.8.2 — Empty state + study window check (2h)

**What you build:** Show "No assignments today" empty state; only show during study window from existing schedule.

**Acceptance:** Empty list renders with friendly message.

### Group P4.9 — Quiz + scoring

#### P4.9.1 — Quiz one-question-at-a-time UI (4h)

**Files touched:**
- `apps/kids/src/screens/learn/QuizScreen.tsx`
- Loads `quiz[]` from topic doc
- Question + 4 options, one per screen, "Next"
- Local state for selected answers

**Acceptance:** All 10 questions presented sequentially.

#### P4.9.2 — `submitQuizAttempt` callable (4h)

**Files touched:**
- `apps/functions/src/callable/submitQuizAttempt.ts`
- Inputs: `{ assignmentId, answers: [{questionId, selectedIndex}] }`
- **Server fetches** topic doc, validates answers against `quiz[].correctIndex`
- Computes score, writes `quizAttempts/{id}`

**Firestore paths:**
- Read: assignment, child class, topic
- Write: `quizAttempts/{id}` with `score`, `total`, `percentage`, `answers[]`, `childUid`, `parentUid`, `classId`, `topicId`

**Interacts with:**
- Triggers `onQuizAttemptWrite` (P4.10) for reward
- Read by parent + teacher reports (P4.11)

**Acceptance:** Client-tampered answers cannot inflate score (server is source of truth).

#### P4.9.3 — Quiz submit + result screen (3h)

**Files touched:**
- `QuizResultScreen.tsx` — shows score, correct/wrong breakdown

**Acceptance:** Result matches server score; reward CTA appears on pass.

### Group P4.10 — Reward unlock

#### P4.10.1 — `rewardCatalog` schema + admin CRUD (4h)

**Files touched:**
- `packages/shared-types/src/education.ts` — `RewardDoc` (type, title, url, ageMin, ageMax, subjectTags[], moderationStatus)
- `apps/admin-web/app/rewards/page.tsx` — CRUD + moderation flag

**Firestore paths:** `rewardCatalog/{id}` CRUD

**Acceptance:** Admin adds 10 sample rewards.

#### P4.10.2 — `onQuizAttemptWrite` trigger (4h)

**Files touched:**
- `apps/functions/src/triggers/onQuizAttemptWrite.ts`
- On create: if `percentage >= 60`, query `rewardCatalog` for matching subject + age + `moderationStatus = approved`
- Pick random eligible reward
- Write `rewardUnlocks/{id}` with `childUid`, `rewardId`, `attemptId`, `unlockedAt`

**Firestore paths:**
- Read: `rewardCatalog/*` query
- Write: `rewardUnlocks/{id}`

**Interacts with:**
- ZKid reward screen (P4.10.3) listens to own `rewardUnlocks`
- ZConnect parent Study tab (P4.11) shows reward

**Acceptance:** Pass quiz → reward doc created within 5 seconds.

#### P4.10.3 — ZKid: reward unlock screen (3h)

**Files touched:**
- `RewardUnlockScreen.tsx` — congrats + reward title + "Play / Watch" button
- Opens reward `url` in safe webview

**Acceptance:** Child sees reward immediately after passing quiz.

#### P4.10.4 — Fail path: "Try again tomorrow" (1h)

**Files touched:**
- If `percentage < 60`, show fail screen + encouragement; no reward

**Acceptance:** Failed quiz shows correct UI.

### Group P4.11 — Parent + Teacher reports

#### P4.11.1 — Parent Study tab in ZConnect (3h)

**Files touched:**
- `apps/guardian/src/screens/parent/StudyTab.tsx` — new tab in child details
- Lists today's assignments + score + reward for linked children

**Firestore paths:**
- Read: `studyAssignments` (today), `quizAttempts` (today, by child), `rewardUnlocks` (today)

**Acceptance:** Parent sees data immediately after child submits.

#### P4.11.2 — Teacher class report screen (4h)

**Files touched:**
- `apps/guardian/src/screens/teacher/ClassReportScreen.tsx`
- Per class: list of children, latest attempt score, attempted vs not attempted

**Firestore paths:**
- Read: `quizAttempts` filtered by `classId` (needs index)

**Acceptance:** Teacher sees class summary updated in seconds.

#### P4.11.3 — Firestore composite indexes (1h)

**Files touched:**
- `firestore/indexes.json` — add indexes for `quizAttempts` (`classId`, `submittedAt`) etc.

**Acceptance:** No "missing index" console errors.

#### P4.11.4 — End-to-end demo on real device pair (2h)

Run full loop on staging:
1. Admin imports curriculum
2. Principal creates class
3. Teacher signs up + approved
4. Child onboarded
5. Teacher assigns topic
6. Child reads + quizzes + unlocks reward
7. Parent + teacher see report

**Acceptance:** Loop works in < 10 minutes on real Android device pair.

### Phase 4 DoD

```text
✅ Full loop end-to-end on staging
✅ Class 8 Science curriculum imported and visible in ZKid
✅ Quiz scored server-side against curated quiz[]
✅ Rewards unlock automatically on pass
✅ Parent + teacher see reports in seconds
✅ No AI lesson generation
✅ No payment/subscription gating
```

---

## Phase 5 — Principal Dashboards + Reports (2–3 weeks)

**Goal:** Principal sees school-wide coverage; weak topics surface for re-teaching; optional syllabus tools.

```mermaid
flowchart TD
  P51[Group 5.1 Aggregator cron] --> P52[Group 5.2 Coverage dashboard]
  P51 --> P53[Group 5.3 Teacher activity view]
  P51 --> P54[Group 5.4 Weak topic detection]
  P55[Group 5.5 Optional syllabus adapter] -.optional.-> P52
```

### Group P5.1 — Aggregator cron

#### P5.1.1 — `aggregateClassReports` cron (4h)

**Files touched:**
- `apps/functions/src/crons/aggregateClassReports.ts`
- Runs nightly at 02:00 IST
- For each class: aggregate today's `quizAttempts` → avg score, attempted count, weakest topics
- Writes `classReports/{classId}/daily/{YYYY-MM-DD}`

**Firestore paths:**
- Read: `quizAttempts` for the day
- Write: `classReports/{classId}/daily/{date}`

**Interacts with:** Principal dashboard reads pre-computed `classReports` (fast).

**Acceptance:** After manual trigger, today's reports exist.

#### P5.1.2 — Cloud Scheduler wiring (1h)

**Files touched:**
- `apps/functions/src/crons/aggregateClassReports.ts` — `onSchedule('every day 02:00')`

**Acceptance:** Visible in GCP Scheduler console.

### Group P5.2 — Coverage dashboard

#### P5.2.1 — Coverage card UI (4h)

**Files touched:**
- `apps/principal-web/app/dashboard/page.tsx`
- Card per class: total topics, assigned topics, completed-by-70%-students count

**Firestore paths:** Read `classReports/{classId}/daily/{today}`

**Acceptance:** Dashboard loads in < 1 second.

#### P5.2.2 — Class detail drill-down (3h)

**Files touched:**
- `apps/principal-web/app/dashboard/classes/[classId]/page.tsx`
- Topic-by-topic coverage table

**Acceptance:** Click card → detail page shows per-topic stats.

### Group P5.3 — Teacher activity view

#### P5.3.1 — Teacher activity card (3h)

**Files touched:**
- `apps/principal-web/app/teachers/page.tsx` — add columns: last-assigned-date, total-this-month

**Firestore paths:** Read `studyAssignments` by `assignedByTeacherId`

**Acceptance:** Principal can spot inactive teachers.

### Group P5.4 — Weak topic detection

#### P5.4.1 — Weak topic flagging in cron (3h)

**Files touched:**
- In `aggregateClassReports`: mark topic `weak: true` when class avg < 60%
- Write `classReports/{classId}/weakTopics`

**Acceptance:** A class with mock low scores gets weak-topics list.

#### P5.4.2 — Teacher dashboard: "Re-teach" callout (2h)

**Files touched:**
- `apps/guardian/src/screens/teacher/HomeScreen.tsx` — "Re-teach: Topic A, Topic B"

**Acceptance:** Teacher sees weak topics tagged.

### Group P5.5 — Optional syllabus adapter (DEFER unless needed)

> Skip these unless content team needs auto-discovered topic names.

#### P5.5.1 — Adapter interface (1d)
#### P5.5.2 — NCERT scrape adapter (3d)
#### P5.5.3 — Topic name skeleton write (1d)
#### P5.5.4 — Weekly refresh cron (0.5d)

### Phase 5 DoD

```text
✅ Principal dashboards show real aggregates
✅ Teacher activity visible per principal
✅ Weak topics surface
✅ (Optional) NCERT metadata adapter live
```

---

## Phase 6 — Pilot + Polish + Launch (2 weeks)

**Goal:** 1 real pilot school live in production. All 4 apps on Play Store + production web.

### Group P6.1 — Pilot onboarding

#### P6.1.1 — Sign pilot school (1d)

External — schedule kickoff with principal.

#### P6.1.2 — Production schema seed (3h)

Admin creates real school in production Firestore.

#### P6.1.3 — Onboard principal + 2 teachers + 10 parents + 10 children (1d)

Walkthrough sessions; document any UX friction.

### Group P6.2 — Real-device QA matrix

#### P6.2.1 — Realme + Xiaomi (1d)

OEM-specific tests: onboarding, location, app blocking, study mission, quiz, reward.

#### P6.2.2 — Samsung + OPPO + Vivo + Pixel (1d)

Same matrix.

#### P6.2.3 — Fix top 5 bugs (1d)

### Group P6.3 — Crash + analytics

#### P6.3.1 — Crashlytics on all 4 apps (3h)
#### P6.3.2 — Firebase Analytics events (3h)

Events: `onboarding_complete`, `quiz_submitted`, `reward_unlocked`.

#### P6.3.3 — Sentry on Functions (2h)

### Group P6.4 — Docs refresh

#### P6.4.1 — Update BEGINNER_APP_FLOW.md with v2 split (3h)
#### P6.4.2 — Update FIRESTORE_SCHEMA_EXPLAINED.md with new collections (3h)
#### P6.4.3 — Update RELEASE_CHECKLIST.md (2h)
#### P6.4.4 — Add `RUNBOOK.md` for on-call (3h)

### Group P6.5 — Public launch

#### P6.5.1 — Play Store internal track (4h)
#### P6.5.2 — Promote to production (closed → open → live) (4h)
#### P6.5.3 — Web apps on production domains (2h)
#### P6.5.4 — v1 sunset banner on last v1 build (3h)

### Group P6.6 — Buffer

#### P6.6.1 — Hotfix slot (3d) — keep reserved
#### P6.6.2 — First retro (2h)

### Phase 6 DoD

```text
✅ 1 pilot school live in production
✅ Crash-free rate > 99%
✅ 4 apps published / deployed
✅ Retro held
✅ v1 sunset announced
```

---

## 4) Critical Path & Parallel Work

```mermaid
flowchart LR
  P0[Phase 0] --> P1[Phase 1]
  P0 --> P2[Phase 2 - can run in parallel]
  P1 --> P3[Phase 3]
  P2 --> P3
  P3 --> P4[Phase 4]
  P4 --> P5[Phase 5]
  P5 --> P6[Phase 6]
```

**Things that can be parallelized inside a phase:**

| Phase | Can run in parallel | Why |
|---|---|---|
| P1 | P1.5 (native split) parallel with P1.3/P1.4 (RN screens) | Two devs split |
| P4 | P4.6 (curriculum import) parallel with P4.3 (teacher onboarding) | Different code paths |
| P4 | P4.10 (reward catalog) parallel with P4.9 (quiz UI) | Quiz writes a doc; trigger fires asynchronously |
| P5 | P5.5 (NCERT adapter) parallel with P5.2 (dashboards) | Optional, isolated |
| P6 | P6.3 (analytics) parallel with P6.2 (QA matrix) | Different scope |

---

## 5) Risk Buffers Per Phase

| Phase | Known risk | Buffer |
|---|---|---|
| P0 | pnpm + Metro path edge cases on Windows | +1 day |
| P1 | Native module Gradle migration | +2 days |
| P3 | Firestore rules complexity | +1 day |
| P4 | Curated JSON schema drift from content team | +2 days |
| P4 | Quiz scoring edge cases (timeouts, partial answers) | +1 day |
| P5 | NCERT scrape brittleness (if attempted) | +3 days |
| P6 | Real-device OEM bugs | +3 days |

Total ~10% schedule buffer.

---

## 6) Ticket Template

Every task in this doc maps to one ticket. Copy this template:

```text
ID: P4.5.1
Title: assignTopic callable
Phase: Phase 4 — Education MVP
Group: P4.5 — Assign topic
Owner: <dev>
Estimate: 4h
Depends on: P4.2.4, P4.3.6, P3.4.2

Scope:
- Function `assignTopic` in apps/functions/src/callable/
- Validates caller is teacher of class
- Writes studyAssignments/{id}
- Returns assignment id

Firestore touched:
- Read: schools/{id}/teachers/* (caller status)
- Write: studyAssignments/{id}

Interacts with:
- P4.8.1 (Study Mission UI listens to studyAssignments)
- P4.11.2 (Teacher class report reads studyAssignments)

Acceptance:
- Valid call returns id
- Non-teacher rejected with permission-denied
- Non-class-teacher rejected
- Unit test for both happy + sad paths

References:
- docs/EDUCATION_AI_TECH_SPEC.md §9 (function inventory)
- docs/V2_BUILD_PHASES.md §Phase 4 (this doc)
```

---

## 7) Tracking Cheat Sheet

| Phase | Done when |
|---|---|
| P0 | Monorepo installs, packages typecheck, emulator boots |
| P1 | v1 feature parity on split APKs (ZKid + ZConnect) |
| P2 | Both web apps deployed, phone OTP works |
| P3 | `users.roles[]` everywhere + role switcher live |
| P4 | Full education loop works end-to-end on staging |
| P5 | Principal dashboard shows real aggregates |
| P6 | 1 pilot school live in production, retro done |

---

## 8) What To Do Right Now (Today)

1. Open Pre-Flight (§3); lock all 5 PF.* items.
2. Create one Linear/Jira ticket per micro-task using these IDs as labels.
3. Create branch `v2/monorepo-bootstrap`.
4. Start **P0.1.1**.

One ticket per day. Don't skip dependencies. Don't merge a ticket without its acceptance criteria.

That's it.
