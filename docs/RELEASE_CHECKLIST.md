# KidSafe release checklist

Follow this top-to-bottom before pushing v1.0 to the Play Store public track.

## Pre-QA build

- [ ] `git pull` + `npm install` on a clean clone — make sure a fresh dev gets a working build.
- [ ] `npx tsc --noEmit` — zero errors.
- [ ] `npx eslint src --ext .ts,.tsx` — zero errors (warnings acceptable).
- [ ] `cd android && ./gradlew assembleRelease` succeeds.

## Device QA

Two devices required to cover the Android-version spread.

### Test matrix

| Device        | Android version | Role   | Scenarios                                                         |
| ------------- | --------------- | ------ | ----------------------------------------------------------------- |
| Older phone   | Android 10-11   | Child  | Install + permissions + all 6 features + reboot                   |
| Newer phone   | Android 13-14   | Parent | Signup, pair with child, flip every toggle, receive alerts        |

### Scenarios

**Auth**
- [ ] Email + password signup (parent + child) → email verification works.
- [ ] Google sign-in from a cold install.
- [ ] Password reset email arrives.
- [ ] Sign out + sign back in preserves role.

**Pairing**
- [ ] Parent sees pairing code in Settings.
- [ ] Code regeneration replaces the old one (old code stops working).
- [ ] Child enters code → navigates to Permissions Onboarding.
- [ ] Expired code is rejected with a clear message.

**Permissions onboarding (child)**
- [ ] All 8 rows flip to "Done" after granting each.
- [ ] "I'm done" button only enables when all rows are Done.
- [ ] Foreground service notification appears and stays.

**Remote lock**
- [ ] Parent flips lock switch → child phone locks within 2 s (foreground) / 30 s (backgrounded).
- [ ] Unflipping lock does NOT unlock the phone (by design — kid must enter PIN).

**Screen time**
- [ ] Set 10-min limit, use the child phone for 10 min → it locks.
- [ ] Counter resets shortly after midnight (manipulate device clock to test).

**App blocking**
- [ ] Toggle Instagram → opening Instagram on child shows the KidSafe overlay.
- [ ] Un-toggle → Instagram opens normally again.
- [ ] System apps (Settings, Phone, Launcher) never get blocked even if somehow toggled.

**Location**
- [ ] Map on parent side shows child's current position within 1 min.
- [ ] Moving 100+ m updates the pin.
- [ ] With location perm revoked, parent sees the "no location yet" message.

**Geofence**
- [ ] Parent taps map + sets 200 m fence → circle appears.
- [ ] Child leaves the area → parent sees an alert.
- [ ] Clearing the fence removes the circle.

**Contacts**
- [ ] Child's contact list appears on parent tab.
- [ ] Call / SMS buttons open the dialer / composer on parent phone.

**Resilience**
- [ ] Reboot child phone → foreground service restarts, all features still work.
- [ ] Force-stop child app → when reopened, service comes back without re-onboarding.
- [ ] Airplane mode on child → commands queue in Firestore → delivered on reconnect.

## Play Store submission

- [ ] Real upload keystore generated: `keytool -genkey -v -keystore release.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`.
- [ ] `android/app/build.gradle` release `signingConfig` points to the new keystore (env vars in `~/.gradle/gradle.properties`).
- [ ] Release SHA-1 added to Firebase console.
- [ ] Version code bumped + `versionName` set to `1.0.0`.
- [ ] Upload AAB: `cd android && ./gradlew bundleRelease`.

## Play Console metadata

- [ ] Screenshots (min 2 phone, 7"+ tablet): parent home, child onboarding, map, apps.
- [ ] Short description + Long description.
- [ ] Privacy policy URL — **must mention** location, contacts, accessibility data usage.
- [ ] **Data Safety form**: declare location, contacts, app list collection. All used for parental monitoring only. No ads, no analytics SDK.
- [ ] Target audience: **12+ adult caregivers**, NOT child-directed.
- [ ] Families Policy review — although we're not child-directed, KidSafe touches Device Admin + Accessibility so Google will review manually.
- [ ] Accessibility Service justification: paste the text in `strings.xml#accessibility_service_description`.
- [ ] Device Admin justification: paste `strings.xml#device_admin_description`.
- [ ] Internal testing track first — invite 20–50 real users, wait 1 week before bumping to closed testing.

## Post-launch monitoring

- [ ] Firebase console → Firestore usage dashboard: watch for any child writing more than ~500 docs/day (usually a bug in the sync engine).
- [ ] Play Console → ANR & crashes: set alert for > 1% crash rate.
- [ ] Support email (or a Typeform link) on the Play listing so users can reach you.

## Known post-MVP follow-ups

Track these in your tracker so they don't slip:

1. Cloud Function for FCM cold-start wake-up — see `docs/FCM_WAKEUP.md`.
2. SMS + Call-log features — requires Permissions Declaration.
3. i18n (Arabic). The UI strings are already separated — just need a translation pass.
4. App Check to stop API abuse at scale.
5. Crashlytics + Performance Monitoring.
6. iOS parent app.
