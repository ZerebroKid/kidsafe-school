# Zerebro (formerly KidSafe)

Zerebro is an Android-first ecosystem for safe-and-focused screen time on
kids' phones, with a parallel education/AI track. The v2 codebase is a
pnpm + Turborepo monorepo with two React Native apps and (later) two
Next.js webs sharing one Firebase backend.

| App | What it is | Audience | Tech |
| --- | --- | --- | --- |
| **ZKid** (`apps/kids/`) | Child phone agent: app blocking, schedule, location, usage, PIN. Hosts every Kotlin native module. | Kids | RN 0.76 + Kotlin |
| **ZConnect** (`apps/guardian/`) | Parent + teacher dashboard: pairing, lock, schedule, location map, usage charts. Zero native modules. | Parents / teachers | RN 0.76 |
| Zerebro Campus *(later)* | Principal / school admin console. | Schools | Next.js (not started) |
| Zerebro Admin *(later)* | Internal ops console for content + tenants. | Zerebro staff | Next.js (not started) |

> The v1 "single shared phone" mode was removed in Phase 1.6. Zerebro is
> now two-device only: ZKid on the kid's phone, ZConnect on the parent's.

## KT / Onboarding Start Here

For knowledge transfer to a new developer, read in this order:

1. [SETUP.md](./SETUP.md) - one-time Firebase / Google / Maps setup.
2. [docs/BEGINNER_APP_FLOW.md](./docs/BEGINNER_APP_FLOW.md) - full walkthrough with analogy + diagrams (best first KT doc).
3. [docs/FIRESTORE_SCHEMA_EXPLAINED.md](./docs/FIRESTORE_SCHEMA_EXPLAINED.md) - Firestore schema, parent/child connection, data-flow examples.
4. [docs/SYSTEM_DESIGN_KT.md](./docs/SYSTEM_DESIGN_KT.md) - full technical system design deep-dive.
5. [docs/EDUCATION_AI_ECOSYSTEM_PLAN.md](./docs/EDUCATION_AI_ECOSYSTEM_PLAN.md) - product narrative for the education/AI track.
6. [docs/EDUCATION_AI_TECH_SPEC.md](./docs/EDUCATION_AI_TECH_SPEC.md) - **locked v2 tech spec**: ZConnect + ZKid + Zerebro Campus + Zerebro Admin, monorepo, curated curriculum JSON.
7. [docs/V2_BUILD_PHASES.md](./docs/V2_BUILD_PHASES.md) - **v2 execution plan**: tech spec sliced into ~100 micro-tasks (0.5-1 day each), each with files, Firestore paths, interactions, deps, acceptance criteria.
8. [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) - QA + release gates.
9. [docs/FCM_WAKEUP.md](./docs/FCM_WAKEUP.md) - optional wake-up architecture.

## Monorepo Layout

```
.
├── apps/
│   ├── kids/                    ZKid -- child phone agent (RN + Kotlin)
│   │   ├── src/                 RN source (screens, navigation, services, firebase)
│   │   └── android/             native Android module (all v1 Kotlin lives here)
│   └── guardian/                ZConnect -- parent/teacher app (RN, no natives)
│       ├── src/
│       └── android/
├── packages/
│   ├── shared-types/            Platform-agnostic TS types for every doc
│   └── shared-firebase/         RN-Firebase auth + firestore client (web port later)
├── firestore/                   rules + indexes -- source of truth (firebase.json
│                                points here)
├── docs/                        KT docs + v2 spec + build phases
├── scripts/                     Local dev helpers (e.g. dev-emulator.sh)
├── firebase.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Quick Start

```bash
pnpm install

# ZKid (child phone)
pnpm --filter @zerebro/zkid start                # Metro on :8081
pnpm --filter @zerebro/zkid android              # build + install on attached device

# ZConnect (parent phone)
pnpm --filter @zerebro/zconnect start --port 8082
pnpm --filter @zerebro/zconnect android --port 8082
```

To run release builds:

```bash
cd apps/kids/android      && ./gradlew assembleRelease
cd apps/guardian/android  && ./gradlew assembleRelease
```

APK output:

```
apps/kids/android/app/build/outputs/apk/release/app-release.apk
apps/guardian/android/app/build/outputs/apk/release/app-release.apk
```

## Firebase emulator (local dev)

```bash
pnpm dev:emulator        # auth + firestore + UI (no functions yet)
```

The emulator UI runs at <http://localhost:4000>. Rules live in
`firestore/rules`. JDK 21+ is required (the script will error out otherwise).

## Code Map (by responsibility)

- **Navigation / role gating**
  - `apps/guardian/src/navigation/RootNavigator.tsx` -- parent auth → ParentNavigator
  - `apps/kids/src/navigation/RootNavigator.tsx` -- child auth → ChildNavigator
- **Parent dashboard**
  - `apps/guardian/src/screens/parent/ChildrenListScreen.tsx`
  - `apps/guardian/src/screens/parent/ChildDetailsScreen.tsx` (tabs: Apps, Schedule, Location, Usage, PIN)
  - `apps/guardian/src/screens/parent/LocationTab.tsx`
- **Child agent + sync**
  - `apps/kids/src/services/childSyncEngine.ts`
  - `apps/kids/src/firebase/messaging.ts`
- **Native Android core (ZKid only)**
  - `apps/kids/android/app/src/main/java/com/kidsafe/services/KidSafeForegroundService.kt`
  - `apps/kids/android/app/src/main/java/com/kidsafe/services/LocationWriter.kt`
  - `apps/kids/android/app/src/main/java/com/kidsafe/blocker/AppBlockerService.kt`
  - `apps/kids/android/app/src/main/java/com/kidsafe/modules/` -- 12 RN bridge classes
- **Shared data contracts**
  - `packages/shared-types/src/firestore.ts` (UserDoc, ChildDoc, Geofence, ...)
  - `packages/shared-firebase/src/{auth,firestore}.ts`
  - `firestore/rules`

## Parent + Child Dev Setup (recommended)

Use two targets for realistic testing:

- ZKid on a real Android phone
- ZConnect on a second phone or emulator

```bash
adb devices                                                          # list serials
adb -s <kidSerial>    install -r apps/kids/android/app/build/outputs/apk/release/app-release.apk
adb -s <parentSerial> install -r apps/guardian/android/app/build/outputs/apk/release/app-release.apk
```

If both apps are debug builds connected to dev Metro instances, point
each device at the right Metro port:

```bash
adb -s <kidSerial>    reverse tcp:8081 tcp:8081     # ZKid -> :8081
adb -s <parentSerial> reverse tcp:8082 tcp:8082     # ZConnect -> :8082
```

(or change "Debug server host & port for device" inside the Dev Menu of
each app to `<laptop-ip>:8081` / `:8082`.)

## Debug Commands

Child native location / service logs:

```bash
adb -s <kidSerial> logcat -v time -s \
  KidSafe.Location KidSafe.LocationWriter KidSafeFgService KidSafe.LocToggleRecv
```

Parent UI logs:

```bash
adb -s <parentSerial> logcat -v time ReactNativeJS:* '*:S'
```

## Notes

- Firestore listeners drive parent ↔ child synchronization; the child
  foreground service keeps reliability up under OEM background constraints.
- Geofence native + event plumbing still exists, but the parent location UX
  intentionally focuses on live location + diagnostics in the current build.
- The pre-RN native Android era artifacts (`Application/`, `JavaDocs/`,
  `graphics/`, `reports/`, `kidsafe.apk`) are kept at the repo root for now
  but aren't part of any build path.
