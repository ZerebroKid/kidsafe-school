# `apps/kids/src/modules/`

JS side of the bridge to ZKid's native Android code.

## `native.ts`

Pure typed wrapper around `NativeModules.{AppBlocker, ChildMode, DeviceAdmin,
ForegroundService, Geofence, InstalledApps, KidSafeLocationModule, OemSettings,
Pin, Schedule, ScreenTime, Supervision}`. Every method throws a descriptive
error if its module isn't linked, so missing-package mistakes surface as a
loud, actionable runtime crash instead of an `undefined is not a function`.

## Where the Kotlin lives

For the duration of Phase 1 the Kotlin source still lives at the v1 root:

    android/app/src/main/java/com/kidsafe/
      ├── blocker/      (AppBlockerService, BlockedAppActivity)
      ├── modules/      (the React Native module classes themselves)
      ├── receivers/    (Boot, Geofence, Location, Package, ScreenTime)
      ├── security/     (AccessibilityWatchdog, PinGateActivity, TamperWatcher)
      ├── services/     (CurrentAppWriter, KidSafeForegroundService,
      │                   LocationWriter, PackageSyncHeadlessTaskService)
      └── store/        (KidSafeStore)

That tree is **not** wired into `apps/kids/android/app/build.gradle` yet, so a
freshly-built ZKid debug APK launches but every `native.ts` call will throw.
That is the expected interim state.

## P1.5.x — Gradle library split

`docs/V2_BUILD_PHASES.md` § P1.5 carves the Kotlin code into five Gradle
libraries under `android-modules/`:

| Module                      | Owns                                         |
|-----------------------------|----------------------------------------------|
| `android-modules/location-writer` | `LocationWriter`, `LocationToggleReceiver`, `KidSafeForegroundService` |
| `android-modules/app-blocker`     | `AppBlockerService`, `BlockedAppActivity`, `AppBlockerModule`          |
| `android-modules/screen-time`     | `ScreenTimeModule` + `ScreenTimeReceiver`                              |
| `android-modules/pin`             | `PinModule` + `PinGateActivity` + `KidSafeStore`                       |
| `android-modules/device-admin`    | `DeviceAdminModule` + `KidSafeDeviceAdminReceiver`                     |

After P1.5.6 `apps/kids/android/app/build.gradle` picks up all five via
`project(...)` dependencies. `apps/guardian/android/` stays free of native
modules entirely — the parent dashboard is pure JS + Firestore.
