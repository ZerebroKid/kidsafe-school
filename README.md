# KidSafe

Parental-control app for Android, built with React Native (bare workflow) and Firebase.

- **Parent side** — monitor one or more child devices: see apps, block apps, lock the device remotely, set a screen-time limit, view location, draw geofences, and see the child's contacts.
- **Child side** — runs in the background, shares location / contacts / installed apps with the linked parent, enforces lock and blocking commands.

> **Status:** MVP scaffold complete. You need to do the one-time Firebase / Google / Maps setup in **[SETUP.md](./SETUP.md)** before `npm run android` will succeed.

## Quick start

```bash
npm install                       # ~5-10 min first time
# --- follow SETUP.md to add google-services.json + Google Web client ID + Maps API key ---
npm start                         # terminal 1 — Metro
npm run android                   # terminal 2 — build + install on device
```

## Repo structure

```
KidSafe/
├── android/                      # bare React Native Android project
│   └── app/src/main/java/com/kidsafe/
│       ├── blocker/              # AccessibilityService + blocked-app overlay
│       ├── modules/              # RN ↔ Kotlin bridge modules
│       ├── receivers/            # Boot, Package, ScreenTime, DeviceAdmin, Geofence
│       ├── services/             # Foreground service + headless JS bridges
│       └── store/                # SharedPreferences cache used by native receivers
├── src/                          # React Native TypeScript
│   ├── components/               # Button, TextInput, Screen wrapper
│   ├── config/                   # env, constants
│   ├── firebase/                 # auth, firestore, messaging, pairing, types
│   ├── modules/                  # typed wrappers around the Kotlin native modules
│   ├── navigation/               # Auth / Parent / Child stacks
│   ├── screens/                  # auth · parent · child
│   ├── services/                 # child sync engine, parent listeners
│   ├── state/                    # zustand stores
│   └── App.tsx
├── firestore.rules               # Security rules (parent-child access control)
├── index.js                      # RN entry + headless task + FCM bg handler
├── Application/                  # ⚠ original open-source Java app — REFERENCE ONLY
├── SETUP.md                      # one-time Firebase / Maps / SHA-1 setup
└── docs/FCM_WAKEUP.md            # optional cloud function for cold-start push wake-up
```

## Feature matrix (v1)

| Feature                    | Status         | Implementation                                                                   |
| -------------------------- | -------------- | -------------------------------------------------------------------------------- |
| Email / password login     | ✓              | `@react-native-firebase/auth` + email verification                               |
| Google sign-in             | ✓              | `@react-native-google-signin/google-signin`                                      |
| Pairing (6-digit code)     | ✓              | Firestore `users/{parent}.pairingCode` with 10 min TTL                           |
| Remote device lock         | ✓              | `DevicePolicyManager.lockNow()` via `DeviceAdminModule`                          |
| Screen-time daily limit    | ✓              | `UsageStatsManager` + midnight `AlarmManager` reset                              |
| App blocking               | ✓              | `AccessibilityService` detects foregrounded app → full-screen overlay            |
| Installed-apps sync        | ✓              | `PackageManager.getInstalledApplications` + `PackageReceiver` for deltas         |
| Live location              | ✓              | `FusedLocationProviderClient` @ 60s / 50m filter                                 |
| Geofence                   | ✓              | `GeofencingClient` exit → Firestore event → parent in-app alert                  |
| App usage tracking         | ✓              | `UsageStatsManager` per-app foreground time → `children/{uid}/usageDaily/{date}` |
| **Deferred**               |                |                                                                                  |
| SMS & call-log forwarding  | v1.1           | Blocked by Play Store Permissions Declaration for SMS/Call log                   |
| Cold-start FCM wake-up     | v1.1           | One Cloud Function, see `docs/FCM_WAKEUP.md`                                     |
| iOS parent app             | v1.3           | iOS can't do Device Admin; parent-only iOS is still possible                     |

## Development notes

- **New Arch** is **off** for MVP — `react-native-maps@1.20` still has New-Arch caveats. Flip back on in `android/gradle.properties` in v1.1 once we audit.
- **Firestore listeners**, not polling, drive every parent ↔ child command. The foreground service on the child keeps the JS thread alive so latency is < 1 s end-to-end while the child phone is awake.
- **Native code reuses the ideas from the original Java app** (`Application/`) but is written fresh in Kotlin, targeting Android 14 and using modern APIs (`foregroundServiceType`, `FLAG_IMMUTABLE`, `SCHEDULE_EXACT_ALARM`, `ServiceInfo.FOREGROUND_SERVICE_TYPE_*`). Keep `Application/` around only as reference until v1.1 ships.
- **Cost envelope at 1000 DAU**: Firestore writes are the dominant cost. Location writes are throttled to one every 60 s / 50 m (see `src/config/env.ts`). Expect ~$30–60 / month on Blaze.

## Troubleshooting

| Symptom                                                                    | Fix                                                                                                  |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Native module "DeviceAdmin" not linked`                                   | `cd android && ./gradlew clean && cd .. && npm run android` — re-builds after adding native modules. |
| Google sign-in: `DEVELOPER_ERROR`                                          | Debug SHA-1 missing from Firebase console. Run `cd android && ./gradlew signingReport` and add it.   |
| Map screen stays blank                                                     | Missing `com.google.android.geo.API_KEY` in the manifest, or the Maps SDK is not enabled.            |
| Accessibility Service "disabled" keeps flipping off                        | OEM battery optimisation. Exclude KidSafe from battery optimisation on Samsung / Xiaomi / Oppo.      |
| `AndroidManifest.xml` build error about `foregroundServiceType`            | You're targeting < Android 14 SDK 34 — bump `compileSdk` / `targetSdk` in `android/build.gradle`.    |
