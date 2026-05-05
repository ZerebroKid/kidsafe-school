import {AppBlocker, OemSettings, ScreenTime} from '../../../../modules/native';
import type {Step} from '../types';
import {
  accessibilityCheck,
  accessibilityDisclosureStep,
  activityStep,
  batteryCheck,
  contactsStep,
  deviceAdminStep,
  finalStep,
  locationBackgroundStep,
  locationForegroundStep,
  notificationsStep,
  overlayCheck,
  pinSetupStep,
  usageAccessCheck,
  welcomeStep,
} from './shared';

/**
 * Samsung One UI step list. One UI is closer to stock than MIUI but still has its own battery
 * profiler ("Sleeping apps", "Deep sleeping apps") and a slightly different Accessibility menu
 * structure. We add the battery-unrestricted step but skip Xiaomi's Autostart / pop-up prompts.
 */
export const samsungSteps: Step[] = [
  welcomeStep,
  pinSetupStep,
  notificationsStep,
  activityStep,
  locationForegroundStep,
  locationBackgroundStep,
  contactsStep,

  accessibilityDisclosureStep,
  {
    kind: 'instructions',
    id: 'accessibility',
    illustration: 'accessibility',
    title: 'Enable Accessibility for KidSafe',
    subtitle:
      'Required for app blocking. KidSafe only reads the package name of apps you open.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings" below'},
      {icon: '2', text: 'Tap "Installed apps"'},
      {icon: '3', text: 'Find KidSafe and toggle it on'},
      {icon: '4', text: 'Tap "Allow" on the confirm dialog'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => AppBlocker.openAccessibilitySettings(),
    check: accessibilityCheck,
  },

  {
    kind: 'instructions',
    id: 'overlay',
    illustration: 'overlay',
    title: 'Allow display over other apps',
    subtitle:
      'Lets KidSafe show the block screen when you open a restricted app.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings"'},
      {icon: '2', text: 'Find KidSafe'},
      {icon: '3', text: 'Toggle "Allow permission" on'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => AppBlocker.openOverlaySettings(),
    check: overlayCheck,
  },

  {
    kind: 'instructions',
    id: 'usageAccess',
    illustration: 'usage',
    title: 'Allow Usage access',
    subtitle: 'So KidSafe can count screen time and apply daily limits.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings"'},
      {icon: '2', text: 'Find KidSafe in the list'},
      {icon: '3', text: 'Toggle "Permit usage access" on'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => ScreenTime.openUsageAccessSettings(),
    check: usageAccessCheck,
  },

  {
    kind: 'instructions',
    id: 'battery',
    illustration: 'battery',
    title: 'Set battery to "Unrestricted"',
    subtitle:
      "Samsung's Sleeping apps system kills background services. KidSafe needs an exemption.",
    bullets: [
      {icon: '1', text: 'Tap "Allow" on the system dialog'},
      {icon: '2', text: 'If you see App info instead, tap "Battery" → "Unrestricted"'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => OemSettings.openBatteryUnrestricted(),
    check: batteryCheck,
    optional: true,
  },

  deviceAdminStep,
  finalStep,
];
