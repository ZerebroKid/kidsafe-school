# KidSafe

KidSafe is an Android parental-control app built with React Native + Kotlin native modules + Firebase.

- Parent side: monitor and control child devices (apps, schedule, usage, location, PIN/admin safety).
- Child side: runs a resilient background stack (foreground service + native writers) to keep enforcement and telemetry reliable on aggressive OEMs.

## KT / Onboarding Start Here

For knowledge transfer to a new developer, read in this order:

1. [SETUP.md](./SETUP.md) - one-time Firebase/Google/Maps setup.
2. [docs/FIRESTORE_SCHEMA_EXPLAINED.md](./docs/FIRESTORE_SCHEMA_EXPLAINED.md) - super-easy Firestore schema, parent/child connection, data-flow examples.
3. [docs/SYSTEM_DESIGN_KT.md](./docs/SYSTEM_DESIGN_KT.md) - full system design, wireframes, flows, runbook.
4. [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) - QA + release gates.
5. [docs/FCM_WAKEUP.md](./docs/FCM_WAKEUP.md) - optional v1.1 wake-up architecture.

## Quick Start

```bash
npm install
npm start
npm run android
```

For release APK:

```bash
cd android
./gradlew assembleRelease
```

APK output:

`android/app/build/outputs/apk/release/app-release.apk`

## Runtime Model

KidSafe supports two modes:

- `two_device` (default): separate parent and child phones.
- `shared`: one-phone family mode with child profile id `${parentUid}_shared`.

Primary mode contracts are defined in:

- `src/firebase/types.ts`
- `src/firebase/firestore.ts`
- `firestore.rules`

## Current Build Highlights

- Parent child-details tab order: `Apps`, `Schedule`, `Location`, `Usage`, `PIN`.
- Apps tab shows only the latest uninstall/tamper attempt.
- Location tab is live-location focused:
  - full-height map region
  - diagnostics banner with actionable reason
  - stale marker dimming for severe failures
- Child onboarding enforces:
  - foreground + background location grant
  - explicit "Allow all the time" recovery step
  - system GPS/location master switch ON (`locationServicesStep`)
- Location reliability pipeline is native-first (`KidSafeForegroundService` + `LocationWriter`), with Firestore diagnostics surfaced in parent UI.

## Code Map (By Responsibility)

- Navigation and role/mode routing:
  - `src/navigation/ParentNavigator.tsx`
  - `src/navigation/types.ts`
- Parent child details and tabs:
  - `src/screens/parent/ChildDetailsScreen.tsx`
  - `src/screens/parent/LocationTab.tsx`
  - `src/screens/parent/CurrentAppPill.tsx`
- Child orchestration:
  - `src/services/childSyncEngine.ts`
- Native Android core:
  - `android/app/src/main/java/com/kidsafe/services/KidSafeForegroundService.kt`
  - `android/app/src/main/java/com/kidsafe/services/LocationWriter.kt`
  - `android/app/src/main/java/com/kidsafe/receivers/LocationToggleReceiver.kt`
- Native bridge API:
  - `src/modules/native.ts`
- Data contracts and rules:
  - `src/firebase/types.ts`
  - `src/firebase/firestore.ts`
  - `firestore.rules`

## Parent + Child Dev Setup (Recommended)

Use two targets for realistic testing:

- child app on real Android phone
- parent app on emulator

Check connected devices:

```bash
adb devices
```

Install release APK on each target:

```bash
adb -s <childSerial> install -r android/app/build/outputs/apk/release/app-release.apk
adb -s <parentSerial> install -r android/app/build/outputs/apk/release/app-release.apk
```

## Debug Commands

Child native location/service logs:

```bash
adb -s <childSerial> logcat -v time -s KidSafe.Location KidSafe.LocationWriter KidSafeFgService KidSafe.LocToggleRecv
```

Parent UI logs:

```bash
adb -s <parentSerial> logcat -v time ReactNativeJS:* *:S
```

## Notes

- Firestore listeners drive parent-child synchronization; the child foreground service keeps reliability under OEM background constraints.
- Geofence native/event plumbing still exists, but parent location UX is intentionally focused on live location + diagnostics in the current build.
