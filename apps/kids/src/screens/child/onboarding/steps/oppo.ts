import {AppBlocker, OemSettings, ScreenTime} from '../../../../modules/native';
import type {Step} from '../types';
import {
  accessibilityCheck,
  accessibilityDisclosureStep,
  activityStep,
  batteryCheck,
  deviceAdminStep,
  finalStep,
  locationBackgroundExplainStep,
  locationBackgroundStep,
  locationForegroundStep,
  locationServicesStep,
  notificationsStep,
  overlayCheck,
  pinSetupStep,
  usageAccessCheck,
  welcomeStep,
} from './shared';

/**
 * Oppo / Realme / OnePlus (ColorOS / Realme UI) and Vivo (FuntouchOS / OriginOS) step list.
 *
 * Realme phones are the textbook case for "permission granted but parent sees no location" —
 * ColorOS aggressively kills background services unless the user has explicitly granted:
 *
 *   1. Autostart           (`StartupAppListActivity` — opens via `OemSettings.openAutostartSettings`)
 *   2. "Allow background activity" / battery unrestricted (per-app)
 *   3. Deep-sleep / "Sleep standby optimization" disabled
 *
 * None of these are queryable via a public API on ColorOS, so the steps are marked
 * `unverifiable + optional` — the wizard accepts the user's "Done" without a read-back, and
 * the FinalStep audit later surfaces a "we couldn't verify these" reminder.
 *
 * The location step ordering (foreground → background → explainer) is the same as
 * `genericSteps` so the strict "Allow all the time" gate from §1 of the reliable-location
 * plan still applies. Adding the ColorOS-specific reliability gates AFTER location keeps
 * the user mentally grouping "permissions" before "system tweaks".
 *
 * Note: Vivo's FuntouchOS uses different activity class names but the same conceptual
 * settings layout. [OemSettingsModule.kt](android/.../OemSettingsModule.kt) `openAutostartSettings`
 * branches on `OEM_VIVO` to pick the Vivo-specific component, so a single step covers both.
 */
export const oppoSteps: Step[] = [
  welcomeStep,
  pinSetupStep,
  notificationsStep,
  activityStep,
  locationForegroundStep,
  locationBackgroundStep,
  locationBackgroundExplainStep,
  // System-wide GPS toggle gate. THIS is the step Realme phones routinely fail at — the kid
  // grants "Allow all the time" then leaves the master toggle off in the quick-settings panel.
  // `strict: true` (set on the step) keeps the wizard parked here until `isLocationEnabled`
  // actually returns true, so the parent never sees an empty map under a `system_location_off`
  // diagnostic from a successful setup.
  locationServicesStep,

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
      {
        icon: '2',
        text: 'On ColorOS / Realme UI, tap "Installed services" (sometimes "Downloaded apps")',
      },
      {icon: '3', text: 'Find KidSafe and toggle "Use KidSafe" on'},
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
      {icon: '2', text: 'Find KidSafe in the list'},
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

  // -- ColorOS / Realme reliability gates --------------------------------------------------
  //
  // Each of these maps to one of the three things ColorOS does that breaks the foreground
  // service silently. We model them as `optional: true, unverifiable: true` because:
  //
  //   - Optional: the wizard should still advance if the user can't find the toggle (rare),
  //     and the FinalStep audit will warn them clearly before flipping to Status.
  //   - Unverifiable: ColorOS exposes none of these as queryable system settings, so we
  //     have to trust the user's "Done" rather than ping `getApplicationInfo().flags`.

  {
    kind: 'instructions',
    id: 'autostart',
    illustration: 'autostart',
    title: 'Enable Autostart',
    subtitle:
      'Without this, ColorOS will block KidSafe from starting in the background — your parent will stop seeing your location.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings"'},
      {
        icon: '2',
        text: 'Find KidSafe in the "Auto-launch" / "Startup manager" list',
      },
      {icon: '3', text: 'Toggle the switch on (it should turn green / blue)'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => OemSettings.openAutostartSettings(),
    check: async () => false,
    unverifiable: true,
    optional: true,
  },

  {
    kind: 'instructions',
    id: 'backgroundActivity',
    illustration: 'battery',
    title: 'Allow background activity',
    subtitle:
      "ColorOS will pause KidSafe when you lock your phone if this isn't on. The location stops updating until you unlock again.",
    bullets: [
      {icon: '1', text: 'Tap "Go to settings"'},
      {icon: '2', text: 'Tap "Battery" or "Battery usage"'},
      {icon: '3', text: 'Pick "Allow background activity" (or "Unrestricted")'},
      {icon: '4', text: 'If you see "Allow auto-launch", turn that on too'},
    ],
    ctaLabel: 'Go to settings',
    openSettings: () => OemSettings.openBatteryUnrestricted(),
    // `OemSettings.isIgnoringBatteryOptimizations` reads the standard
    // PowerManager flag, which ColorOS's "Allow background activity" toggle actually
    // does set internally. So we get a real read-back here even though the toggle is
    // ColorOS-branded — no need to mark this unverifiable.
    check: batteryCheck,
    optional: true,
  },

  {
    kind: 'instructions',
    id: 'deepSleep',
    illustration: 'battery',
    title: 'Disable deep sleep / sleep standby',
    subtitle:
      'ColorOS\'s "Sleep standby optimisation" decides which apps to freeze overnight. KidSafe must NOT be on that list.',
    bullets: [
      {icon: '1', text: 'Tap "Go to settings"'},
      {icon: '2', text: 'Tap "Battery" → "More battery settings"'},
      {
        icon: '3',
        text: 'Turn OFF "Sleep standby optimisation" — or remove KidSafe from the optimised list',
      },
      {
        icon: '4',
        text: "If you can't find the option, your phone may not have it — just tap Done",
      },
    ],
    // No reliable deep link to the deep-sleep config page exists across ColorOS versions
    // — `openBatteryUnrestricted` lands a tap or two away on every version we've tested.
    ctaLabel: 'Go to settings',
    openSettings: () => OemSettings.openBatteryUnrestricted(),
    check: async () => false,
    unverifiable: true,
    optional: true,
  },

  deviceAdminStep,
  finalStep,
];
