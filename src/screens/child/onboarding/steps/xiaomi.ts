import {AppBlocker, OemSettings, ScreenTime} from '../../../../modules/native';
import type {Step} from '../types';
import {
  accessibilityCheck,
  accessibilityDisclosureStep,
  activityStep,
  contactsStep,
  deviceAdminStep,
  finalStep,
  locationBackgroundStep,
  locationForegroundStep,
  notificationsStep,
  overlayCheck,
  usageAccessCheck,
  welcomeStep,
} from './shared';

/**
 * Xiaomi / Redmi / POCO step list (HyperOS / MIUI). Adds three Xiaomi-only steps the generic
 * flow doesn't have: "Display pop-up in background" (MIUI Other Permissions), "Autostart" and
 * "Battery: No restrictions" (MIUI's bespoke power-keeper). The instruction copy on Accessibility
 * and Usage access also calls out the "Danger" 7-second countdown dialog, which freaks users out
 * the first time they see it.
 */
export const xiaomiSteps: Step[] = [
  welcomeStep,
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
      'Required for app blocking. KidSafe only reads the package name of apps you open — never their content.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings" below'},
      {icon: '2', text: 'Tap "Installed services" or "Downloaded apps"'},
      {icon: '3', text: 'Find KidSafe and toggle it on'},
      {
        icon: '4',
        text: 'A red "Danger" dialog appears — tick the checkbox, wait 7 seconds, tap OK',
      },
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
      {icon: '2', text: 'Scroll down to find KidSafe'},
      {icon: '3', text: 'Tap KidSafe and toggle "Allow display over other apps"'},
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
      {icon: '2', text: 'Find KidSafe and tap it'},
      {icon: '3', text: 'Toggle "Permit usage access" on'},
      {
        icon: '4',
        text: 'On the "Danger" dialog: tick the checkbox, wait 7 seconds, tap OK',
      },
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => ScreenTime.openUsageAccessSettings(),
    check: usageAccessCheck,
  },

  // Xiaomi-only "Other permissions" deep link. Lands on KidSafe's permissions page where the
  // "Display pop-up windows while running in the background" toggle is — without this the
  // BlockedAppActivity overlay can't launch from AppBlockerService.
  {
    kind: 'instructions',
    id: 'miuiPopup',
    illustration: 'overlay',
    title: 'Allow pop-up in background',
    subtitle:
      'Without this, the block screen cannot appear when KidSafe is running in the background.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings"'},
      {icon: '2', text: 'Tap "Other permissions"'},
      {icon: '3', text: 'Find "Display pop-up windows while running in the background"'},
      {icon: '4', text: 'Toggle it on'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => OemSettings.openMiuiOtherPermissions(),
    // No reliable read-back API for this MIUI-private permission. Verification sheet handles it.
    check: async () => false,
  },

  {
    kind: 'instructions',
    id: 'autostart',
    illustration: 'autostart',
    title: 'Enable Autostart',
    subtitle:
      'Lets KidSafe start in the background after a reboot — required for blocking to keep working.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings"'},
      {icon: '2', text: 'Find KidSafe in the autostart list'},
      {icon: '3', text: 'Toggle the switch on'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => OemSettings.openAutostartSettings(),
    check: async () => false,
  },

  {
    kind: 'instructions',
    id: 'battery',
    illustration: 'battery',
    title: 'Set battery to "No restrictions"',
    subtitle:
      "MIUI's battery saver kills background apps aggressively. KidSafe needs an exemption.",
    bullets: [
      {icon: '1', text: 'Tap "Go to settings"'},
      {icon: '2', text: 'Tap "Battery saver"'},
      {icon: '3', text: 'Choose "No restrictions"'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => OemSettings.openBatteryUnrestricted(),
    check: async () => false,
  },

  deviceAdminStep,
  finalStep,
];
