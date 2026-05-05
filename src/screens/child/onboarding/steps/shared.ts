import {PermissionsAndroid, Platform} from 'react-native';

import {
  AppBlocker,
  DeviceAdmin,
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

export const contactsStep: Step = {
  kind: 'runtime',
  id: 'contacts',
  illustration: 'contacts',
  title: 'Allow contacts',
  subtitle:
    'Shares your contacts list with your parent so they know who to call in an emergency.',
  permission: PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
  check: async () =>
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS),
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

export const deviceAdminStep: Step = {
  kind: 'illustration',
  id: 'deviceAdmin',
  illustration: 'shield',
  title: 'Activate uninstall protection',
  subtitle:
    'Stops anyone from accidentally deleting KidSafe. Your parent can lock the device remotely too.',
  ctaLabel: 'Activate',
  onCtaAction: async () => {
    await DeviceAdmin.requestActivation();
  },
  check: () => DeviceAdmin.isActive().catch(() => false),
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
