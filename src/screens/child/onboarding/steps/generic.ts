import {AppBlocker, OemSettings, ScreenTime} from '../../../../modules/native';
import type {Step} from '../types';
import {
  accessibilityCheck,
  accessibilityDisclosureStep,
  activityStep,
  batteryCheck,
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
 * Generic / stock-Android step list. Used as a fallback for OEMs we don't have a custom branch
 * for (Pixel, OnePlus, Motorola, Nothing, Huawei, etc.).
 *
 * The instruction copy here matches what stock Android shows — minimal warnings, single-tap
 * toggles. OEM-specific quirks like Xiaomi's "Restricted settings" gate are not addressed.
 */
export const genericSteps: Step[] = [
  welcomeStep,
  pinSetupStep,
  notificationsStep,
  activityStep,
  locationForegroundStep,
  locationBackgroundStep,

  accessibilityDisclosureStep,
  {
    kind: 'instructions',
    id: 'accessibility',
    illustration: 'accessibility',
    title: 'Enable Accessibility for KidSafe',
    subtitle: 'Required for app blocking. KidSafe only reads the package name of apps you open.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings" below'},
      {icon: '2', text: 'Find KidSafe in the list'},
      {icon: '3', text: 'Toggle "Use KidSafe" on'},
      {icon: '4', text: 'Tap "Allow" on the confirmation dialog'},
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
      {icon: '2', text: 'Find "KidSafe"'},
      {icon: '3', text: 'Toggle "Allow display over other apps" on'},
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

  // Battery optimization exemption is universally helpful — keeps the foreground service alive
  // overnight on most stock-Android battery-saver schedules.
  {
    kind: 'instructions',
    id: 'battery',
    illustration: 'battery',
    title: 'Disable battery optimization',
    subtitle:
      'Stops Android from killing KidSafe in the background, especially overnight.',
    bullets: [
      {icon: '1', text: 'Tap "Allow" on the confirmation dialog'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => OemSettings.openBatteryUnrestricted(),
    check: batteryCheck,
    optional: true,
  },

  deviceAdminStep,
  finalStep,
];
