# `apps/kids/android/` — ZKid native side

This directory hosts ZKid's complete Android app: the React Native scaffold
plus the full v1 KidSafe Kotlin codebase migrated wholesale during P1.5.

## Layout

```
android/
├── build.gradle               # Project-wide ext.{kotlinVersion, ...} + plugin classpath
├── settings.gradle            # pnpm-aware paths to @react-native/gradle-plugin
├── gradle.properties          # newArchEnabled=true, hermesEnabled=true
└── app/
    ├── build.gradle           # Application module: Firebase BoM, Play Services, AndroidX
    ├── google-services.json   # Firebase config (gitignored; copied from v1 root)
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/kidsafe/
        │   ├── kids/          # ZKid-only: MainActivity, MainApplication
        │   ├── blocker/       # AppBlockerService, BlockedAppActivity
        │   ├── modules/       # 12 React Native module classes + KidSafePackage
        │   ├── receivers/     # Boot, Geofence, LocationToggle, Package, ScreenTime,
        │   │                  # KidSafeDeviceAdmin (+ GeofenceHeadlessTaskService)
        │   ├── security/      # AccessibilityWatchdog, PinGateActivity, TamperWatcher
        │   ├── services/      # CurrentAppWriter, KidSafeForegroundService,
        │   │                  # LocationWriter, PackageSyncHeadlessTaskService
        │   └── store/         # KidSafeStore (SharedPreferences wrapper)
        └── res/               # layouts, drawables, strings (ZKid-branded), icons,
                               # plus the v1 device_admin_policies.xml and
                               # app_blocker_accessibility_service.xml
```

## Package namespace vs Java packages

The Android manifest namespace is `com.kidsafe.kids` so:

- `.MainActivity` and `.MainApplication` resolve to
  `com.kidsafe.kids.{MainActivity, MainApplication}` (the kids-specific files in
  `java/com/kidsafe/kids/`).
- Every other class declared in the manifest -- services, receivers, the kiosk
  `BlockedAppActivity`, the `PinGateActivity`, the accessibility service, the
  device admin receiver -- uses the **fully-qualified** v1 package name
  (`com.kidsafe.blocker.BlockedAppActivity`, etc.) because they live in their
  original `com.kidsafe.{blocker, modules, ...}` packages.

We deliberately did NOT bulk-rename the v1 Kotlin packages to `com.kidsafe.kids.*`
because the change would (a) churn ~25 source files for no functional gain and
(b) potentially break SharedPreferences keys / file paths that already reference
the v1 package strings.

`applicationId` is `com.kidsafe.kids` so ZKid coexists on a phone with
ZConnect (`com.kidsafe.guardian`) and any leftover v1 install (`com.kidsafe`).

## Firebase configuration

`apps/kids/android/app/google-services.json` is copied verbatim from the v1
`android/app/google-services.json`. That file MUST contain a client entry for
`com.kidsafe.kids` (and ideally `com.kidsafe.guardian` for ZConnect too).

If the v1 file only registered `com.kidsafe`, register the two new
applicationIds in the Firebase console:

  Project settings → General → "Add app" → Android → use `com.kidsafe.kids`
  and `com.kidsafe.guardian` as the package names → download fresh
  google-services.json files into `apps/kids/android/app/` and
  `apps/guardian/android/app/`.

Until that's done, the ZKid debug APK will fail at `FirebaseApp.initialize`
with `No matching client found for package name`.

## Deferred: 5-library Gradle split (was P1.5.1–1.5.6)

The original Phase 1.5 plan in `docs/V2_BUILD_PHASES.md` carved the Kotlin
into 5 separate Gradle libraries under `android-modules/` (`location-writer`,
`app-blocker`, `screen-time`, `pin`, `device-admin`). That split is deferred
to a later phase -- it's a build-system improvement (faster incremental
builds, cleaner ZConnect = no native modules), but it doesn't change runtime
behavior. The single-module move executed here is the lowest-risk path to a
buildable ZKid APK that matches v1 behavior.

When the library split is picked back up, this README's "Layout" section is
the authoritative source for which classes belong in which library.

## Building locally

```bash
pnpm install
pnpm --filter @zerebro/zkid android   # debug build + install on attached device
```

Common gotchas:
- Gradle plugin path is resolved from the workspace root `node_modules/`
  (see `settings.gradle`). pnpm's `node-linker=hoisted` plus `.npmrc`'s
  `shamefully-hoist=true` make this work.
- `react-native-worklets` MUST NOT be installed -- it pulls in a babel plugin
  that requires RN 0.78+. Pinning `nativewind@4.1.23` avoids the transitive.
- New Architecture (`newArchEnabled=true`) is on; the v1 Kotlin modules run
  through RN's legacy-interop layer.
