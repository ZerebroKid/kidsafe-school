import {PermissionsAndroid, Platform} from 'react-native';

import {
  AppBlocker,
  DeviceAdmin,
  Location,
  OemSettings,
  Pin,
  ScreenTime,
} from '../../../../modules/native';
import type {Step} from '../types';

/**
 * Re-usable step builders. The OEM-specific files (`xiaomi.ts`, `samsung.ts`, `generic.ts`)
 * compose these with their own overrides for the four "tricky" instruction screens
 * (Accessibility / Usage access / Overlay / Battery).
 */

// -- Runtime permission steps -------------------------------------------------

export const welcomeStep: Step = {
  kind: 'illustration',
  id: 'welcome',
  illustration: 'welcome',
  title: "Let's set up your phone",
  subtitle:
    "We'll walk through every permission KidSafe needs. It takes about 5 minutes — you can come back to anything you skip.",
  ctaLabel: 'Set up',
};

export const notificationsStep: Step = {
  kind: 'runtime',
  id: 'notifications',
  illustration: 'notifications',
  title: 'Allow notifications',
  subtitle:
    'KidSafe shows an ongoing badge so the system keeps it alive. Required to monitor in the background.',
  permission:
    Number(Platform.Version) >= 33
      ? ('android.permission.POST_NOTIFICATIONS' as never)
      : null,
  check: async () => {
    if (Number(Platform.Version) < 33) {return true;}
    return PermissionsAndroid.check(
      'android.permission.POST_NOTIFICATIONS' as never,
    );
  },
};

export const activityStep: Step = {
  kind: 'runtime',
  id: 'activity',
  illustration: 'shield',
  title: 'Allow physical activity',
  subtitle: "Helps the app save battery while it's tracking your child's location.",
  permission:
    Number(Platform.Version) >= 29
      ? ('android.permission.ACTIVITY_RECOGNITION' as never)
      : null,
  check: async () => {
    if (Number(Platform.Version) < 29) {return true;}
    return PermissionsAndroid.check(
      'android.permission.ACTIVITY_RECOGNITION' as never,
    );
  },
};

export const locationForegroundStep: Step = {
  kind: 'runtime',
  id: 'locationForeground',
  illustration: 'location',
  title: 'Allow location',
  subtitle:
    'Lets your parent see where you are on the map and notifies them if you leave the safe zone.',
  permission: [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ],
  check: async () =>
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
};

export const locationBackgroundStep: Step = {
  kind: 'runtime',
  id: 'locationBackground',
  illustration: 'location',
  title: 'Allow background location',
  subtitle:
    'Tap "Allow all the time" so the location keeps updating when the app is closed.',
  permission: PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
  check: async () =>
    PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    ),
};

/**
 * Recovery step shown when the kid picked "While using this app" (or denied the dialog
 * outright) on `locationBackgroundStep`. The system stops offering the runtime dialog on
 * the second request (Android 11+ returns `NEVER_ASK_AGAIN`), so the only way back is the
 * App info → Permissions → Location page where the kid can pick "Allow all the time"
 * from the radio list.
 *
 * Modelled as an `instructions` step so we get the "Go to settings + return + re-check"
 * loop for free. `optional: false` (default) keeps the wizard blocked on this step until
 * the system actually returns `ACCESS_BACKGROUND_LOCATION === GRANTED`.
 *
 * `unverifiable: false` — we DO have a public read-back via `PermissionsAndroid.check`,
 * so the verification sheet's "Yes" will be honest-checked before advancing.
 */
export const locationBackgroundExplainStep: Step = {
  kind: 'instructions',
  id: 'locationBackgroundExplain',
  illustration: 'location',
  title: 'Switch to "Allow all the time"',
  subtitle:
    "Android needs this exact option so your parent can see your location even when you're not using KidSafe.",
  bullets: [
    {icon: '1', text: 'Tap "Open Settings" below'},
    {icon: '2', text: 'Tap "Permissions" (or "App permissions")'},
    {icon: '3', text: 'Tap "Location"'},
    {icon: '4', text: 'Pick "Allow all the time"'},
  ],
  ctaLabel: 'Open Settings',
  openSettings: () => OemSettings.openAppDetailsSettings(),
  check: async () =>
    PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    ),
};

/**
 * Hard gate on the system-wide Location / GPS master switch — the toggle exposed in the
 * quick-settings panel. Distinct from `ACCESS_FINE_LOCATION` (which only controls per-app
 * permission): on Realme/ColorOS we saw repeatedly that the permission was "Allow all the time"
 * but this switch was OFF, so the fused-location subscription returned no fixes and the parent
 * map sat empty under a `system_location_off` diagnostic.
 *
 * Two robustness layers stack here:
 *   - `check` runs `Location.isLocationServicesEnabled()` (same probe the native writer uses
 *      internally before it tries to subscribe), so an already-on toggle auto-advances the
 *      wizard the moment it mounts and there's zero friction on the happy path.
 *   - `strict: true` makes the verification sheet's "Yes" honest — a kid who taps "Yes"
 *      without actually flipping the toggle stays parked on this step instead of leaking
 *      through to FinalStep (where the audit would catch them, but we'd rather catch it here
 *      so the kid doesn't have to backtrack at the end of setup).
 *
 * The CTA opens `Settings.ACTION_LOCATION_SOURCE_SETTINGS` directly so the kid lands one tap
 * away from the master toggle on every OEM. AppState re-check then auto-advances when they
 * return to the app with the toggle on.
 */
export const locationServicesStep: Step = {
  kind: 'instructions',
  id: 'locationServices',
  illustration: 'location',
  title: 'Turn on Location (GPS)',
  subtitle:
    "Your phone's main Location switch needs to be ON. Without it, even with permission, the GPS chip can't get a fix.",
  bullets: [
    {icon: '1', text: 'Tap "Open Location settings" below'},
    {icon: '2', text: 'Turn the top "Use location" switch ON'},
    {icon: '3', text: 'Come back to KidSafe — it will auto-detect'},
  ],
  ctaLabel: 'Open Location settings',
  openSettings: () => OemSettings.openLocationSourceSettings(),
  check: () => Location.isLocationServicesEnabled().catch(() => false),
  strict: true,
};

// -- Prominent disclosure (paired with the Accessibility step) ---------------

export const accessibilityDisclosureStep: Step = {
  kind: 'disclosure',
  id: 'accessibilityDisclosure',
  title: 'About the Accessibility permission',
  subtitle:
    'KidSafe uses the Accessibility API for one purpose only: app blocking.',
  body: [
    'When your parent blocks an app or sets a daily schedule, KidSafe needs to know which app you just opened so it can show the block screen.',
    'KidSafe only reads the package name (e.g. "com.android.chrome") of the foregrounded window. It never reads screen content, what you type, or what you tap.',
    'You can revoke this permission at any time from system Settings → Accessibility.',
  ],
  agreeLabel: 'Agree and continue',
  pairsWithStepId: 'accessibility',
};

// -- Parent PIN (uninstall protection) ---------------------------------------

/**
 * Set on the child device — parent must be physically present. The PIN is required later if
 * anyone tries to disable accessibility, uninstall KidSafe, or change OEM autostart settings.
 *
 * `check` returning true (PIN already set) makes the wizard auto-skip this step on resume so
 * a re-onboard after relaunch doesn't ask the parent to set the PIN again.
 */
export const pinSetupStep: Step = {
  kind: 'pin',
  id: 'pin',
  illustration: 'shield',
  title: 'Set a parent PIN',
  subtitle:
    'Pick a 4-6 digit PIN. KidSafe will ask for it if anyone tries to uninstall the app or turn off the accessibility service.',
  check: () => Pin.hasPin().catch(() => false),
};

// -- Device admin (uninstall protection) -------------------------------------

/**
 * Device admin gives KidSafe the right to lock the screen remotely AND prevents the child from
 * uninstalling the app without the parent PIN. The system "Activate this device admin app?" page
 * shown by ACTION_ADD_DEVICE_ADMIN is unfamiliar to most users, so we model this as an
 * `instructions` step (numbered bullets + system page) rather than a barebones illustration.
 *
 * Marked `optional: true` so the wizard can advance even if the user truly cannot grant it on
 * a stripped-down OEM build — the FinalStep audit still surfaces a "Recommended — tap to fix"
 * row and warns the user before they tap Finish.
 *
 * Also marked `requireExplicitConfirm: true`: the wizard's silent auto-advance paths
 * (mount-time recheck + AppState return) are bypassed for this step. The kid MUST tap
 * "Yes, I activated it" on the verification sheet, and that "Yes" is then honest-checked
 * via `DeviceAdmin.isActive()` before the wizard moves on. Combined with the TamperWatcher
 * fixes this closes the v1 hole where the screen silently skipped before anyone confirmed
 * uninstall protection was on. The documented escape path remains FinalStep's parent-PIN
 * "Skip uninstall protection" modal.
 */
export const deviceAdminStep: Step = {
  kind: 'instructions',
  id: 'deviceAdmin',
  illustration: 'shield',
  title: 'Activate uninstall protection',
  subtitle:
    "Stops anyone from accidentally deleting KidSafe. You'll see a system page describing what KidSafe will be allowed to do.",
  bullets: [
    {icon: '1', text: 'Tap "Open device admin settings" below'},
    {
      icon: '2',
      text: 'On the next screen, read the description of what KidSafe will be allowed to do',
    },
    {
      icon: '3',
      text: 'Scroll down and tap "Activate this device admin app" (sometimes labelled just "Activate")',
    },
    {
      icon: '4',
      text: 'If you only see a Security list, tap "Device admin apps", then tap KidSafe and toggle it on',
    },
  ],
  ctaLabel: 'Open device admin settings',
  openSettings: async () => {
    await DeviceAdmin.requestActivation();
  },
  check: () => DeviceAdmin.isActive().catch(() => false),
  optional: true,
  requireExplicitConfirm: true,
};

// -- Final step --------------------------------------------------------------

export const finalStep: Step = {
  kind: 'final',
  id: 'final',
  title: "You're all set!",
  subtitle:
    'KidSafe is now monitoring this device. Tap below to test that app blocking is working.',
  ctaLabel: 'Finish',
};

// -- Permission checks reused by Accessibility / Usage / Overlay / Battery ---

export const accessibilityCheck = () =>
  AppBlocker.isAccessibilityServiceEnabled().catch(() => false);

export const usageAccessCheck = () =>
  ScreenTime.hasUsageAccess().catch(() => false);

export const overlayCheck = () => AppBlocker.canDrawOverlays().catch(() => false);

/**
 * Real read-back for battery optimization — backed by `PowerManager.isIgnoringBatteryOptimizations`
 * via the `OemSettings` native module. Pre-Android-M and devices where the lookup throws return
 * `true` so we don't get stuck (those phones don't enforce battery optimization on FG services).
 */
export const batteryCheck = () =>
  OemSettings.isIgnoringBatteryOptimizations().catch(() => true);
