# KidSafe MVP — Setup Guide

This guide walks you through the one-time manual steps required before you can build and run the app. Everything code-wise is already wired; these are the external accounts and config files you have to create yourself.

Total time: **~30 minutes**.

---

## 1. Firebase project

1. Go to https://console.firebase.google.com/ and **Create a project** called `KidSafe` (or reuse an existing one).
2. In the project, click **Add app → Android**.
   - Package name: `com.kidsafe`
   - App nickname: `KidSafe Android`
   - **Debug signing certificate SHA-1**: get it from your dev machine with:
     ```bash
     cd android && ./gradlew signingReport
     ```
     Copy the `SHA1` value under `Variant: debug` and paste it into the Firebase console. (You can add the release SHA-1 later when you generate a real upload keystore.)
3. Download **`google-services.json`** for Android and place it at `apps/kids/android/app/google-services.json` (and `apps/guardian/android/app/google-services.json`).
4. For **iOS**: Click **Add app → iOS** in Firebase Console:
   - iOS Bundle ID: `com.kidsafe` (for ZKid) / `com.kidsafe.guardian` (for ZConnect).
   - Download **`GoogleService-Info.plist`** and add it inside Xcode under `apps/kids/ios/kids/` and `apps/guardian/ios/guardian/`.

### Enable Firebase products

In the Firebase console left nav:

| Product | How to enable |
|---|---|
| **Authentication** | Build → Authentication → Get started. Enable **Email/Password** and **Google** sign-in methods. |
| **Firestore** | Build → Firestore Database → Create database → Start in **production mode** → pick a region close to your users. |
| **Storage** | Build → Storage → Get started → Start in production mode. |
| **Cloud Messaging** | Build → Cloud Messaging — nothing to configure, just confirm it is enabled. |

### Upload Firestore security rules

From the workspace root:

```bash
# One-time install
npm install -g firebase-tools
firebase login
firebase init firestore   # choose the existing KidSafe project; keep firestore.rules
firebase deploy --only firestore:rules
```

Or copy-paste the contents of [`firestore.rules`](./firestore.rules) into the Firestore **Rules** tab of the console and publish.

### Upgrade to Blaze (pay-as-you-go)

Required once you move past a handful of test devices. Expected cost at ~1000 active users with the throttling already built-in: **$30–60 / month**.

---

## 2. Google Sign-in Web client ID

Firebase auto-creates an OAuth client for you. Grab its ID:

1. Firebase console → **Project settings → General → Your apps → Android**, scroll to **Web SDK configuration**.
2. Copy the **Web client ID** (ends in `.apps.googleusercontent.com`).
3. Paste it into `src/config/env.ts` under `GOOGLE_WEB_CLIENT_ID`.

---

## 3. Google Maps API key

Needed for `react-native-maps` on the parent screen.

1. Go to https://console.cloud.google.com/apis/credentials (same Google account).
2. **Create credentials → API key**.
3. Restrict it:
   - Application: **Android apps** → add package `com.kidsafe` and the same debug SHA-1 you generated in step 1.
   - API: enable **Maps SDK for Android**.
4. Paste the key in `android/app/src/main/AndroidManifest.xml` (inside `<application>`):
   ```xml
   <meta-data
     android:name="com.google.android.geo.API_KEY"
     android:value="YOUR_MAPS_KEY" />
   ```
   (Already stubbed in the manifest — just replace the `YOUR_MAPS_KEY` placeholder once you have the key.)

---

## 4. Install JS dependencies

```bash
cd /home/naushad/CODE/KidSafe
npm install
```

First install takes 5–10 minutes (lots of native deps).

---

## 5. Run the app

Start Metro in one terminal:
```bash
npm start
```

Run on a connected Android device (USB debugging on) or emulator in another terminal:
```bash
npm run android
```

---

## 6. First-launch permission flow (critical)

The child side needs these OS-level permissions. They **cannot all be requested via the normal RN prompt** — the user has to tap through system Settings screens. The in-app onboarding walks them through each:

1. Notification permission (Android 13+ runtime prompt).
2. Location (fine + background).
3. Contacts (runtime prompt).
4. **Usage access** — opens `Settings → Apps → Special app access → Usage access`.
5. **Display over other apps** — opens `Settings → Apps → Special app access → Display over other apps`.
6. **Accessibility service** — opens `Settings → Accessibility → KidSafe`. Required for app blocking.
7. **Device admin** — opens the Device Admin activation screen. Required for remote lock + uninstall protection.

Each of these is handled by a screen in [`src/screens/child/permissions/`](./src/screens/child/permissions/).

---

## 7. Release checklist (before Play Store upload)

- [ ] Real upload keystore generated (`keytool -genkey -v -keystore release.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`) and release `signingConfig` updated in `android/app/build.gradle`.
- [ ] Release SHA-1 added in Firebase console.
- [ ] Privacy policy URL live.
- [ ] **Play Console → Policy → App Content** forms filled:
  - Data Safety (location, contacts, app usage, device ID)
  - Target audience (12+ adult caregivers — not for children, per Families Policy)
  - Prominent disclosure for Accessibility + Device Admin usage
- [ ] Internal testing track for the first 50 users before public rollout.
