import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

const IS_IOS = Platform.OS === 'ios';

const {
  DeviceAdmin: DeviceAdminNative,
  InstalledApps: InstalledAppsNative,
  AppBlocker: AppBlockerNative,
  ScreenTime: ScreenTimeNative,
  KidSafeLocationModule: LocationNative,
  Geofence: GeofenceNative,
  ForegroundService: ForegroundServiceNative,
  Schedule: ScheduleNative,
  OemSettings: OemSettingsNative,
  Pin: PinNative,
  Supervision: SupervisionNative,
  ChildMode: ChildModeNative,
} = NativeModules;

function assert(mod: unknown, name: string) {
  if (!mod) {
    if (IS_IOS) {
      return new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === 'addListener' || prop === 'removeListeners') {
              return () => {};
            }
            return async (..._args: any[]) => {
              if (name === 'Pin') {
                if (prop === 'hasPin') return true;
                if (prop === 'verifyPin') return true;
                if (prop === 'lockoutRemainingMs') return 0;
                return undefined;
              }
              if (name === 'InstalledApps' && prop === 'list') return [];
              if (name === 'ScreenTime' && prop === 'getTodayUsedMinutes') return 0;
              if (name === 'ScreenTime' && prop === 'getPerAppUsage') return {days: []};
              if (name === 'ScreenTime' && prop === 'hasUsageAccess') return true;
              if (name === 'AppBlocker' && prop === 'getBlockedPackages') return [];
              if (name === 'AppBlocker' && prop === 'isAccessibilityServiceEnabled') return true;
              if (name === 'AppBlocker' && prop === 'canDrawOverlays') return true;
              if (name === 'DeviceAdmin' && prop === 'isActive') return true;
              if (name === 'KidSafeLocationModule' && prop === 'isLocationServicesEnabled') return true;
              if (name === 'OemSettings' && prop === 'getOem') return 'generic';
              if (name === 'OemSettings' && prop === 'isIgnoringBatteryOptimizations') return true;
              if (name === 'ChildMode') {
                if (prop === 'isSharedDevice') return false;
                if (prop === 'isActive') return false;
                if (prop === 'getProfileId') return null;
                if (prop === 'getStartedAt') return 0;
              }
              return true;
            };
          },
        },
      );
    }
    throw new Error(
      `Native module "${name}" not linked. Rebuild the Android app after pulling: ` +
        'cd android && ./gradlew clean && cd .. && npm run android',
    );
  }
  return mod;
}

// -------- DeviceAdmin --------

export const DeviceAdmin = {
  isActive: (): Promise<boolean> =>
    (assert(DeviceAdminNative, 'DeviceAdmin') as typeof DeviceAdminNative).isActive(),
  requestActivation: (): Promise<void> =>
    (assert(DeviceAdminNative, 'DeviceAdmin') as typeof DeviceAdminNative).requestActivation(),
  lockNow: (): Promise<boolean> =>
    (assert(DeviceAdminNative, 'DeviceAdmin') as typeof DeviceAdminNative).lockNow(),
};

// -------- InstalledApps --------

export interface InstalledApp {
  packageName: string;
  appName: string;
  icon?: string;
}

export const InstalledApps = {
  list: (includeIcons = false): Promise<InstalledApp[]> =>
    (assert(InstalledAppsNative, 'InstalledApps') as typeof InstalledAppsNative).list(includeIcons),
};

// -------- AppBlocker --------

/**
 * Foreground app event emitted by the native accessibility service whenever the kid switches
 * apps. `packageName` is the raw Android package id; the parent dashboard resolves it to a
 * friendly name + icon via the `apps` subcollection.
 */
export interface ForegroundAppEvent {
  packageName: string;
  timestamp: number;
}

export const AppBlocker = {
  setBlockedPackages: (pkgs: string[]): Promise<boolean> =>
    (assert(AppBlockerNative, 'AppBlocker') as typeof AppBlockerNative).setBlockedPackages(pkgs),
  getBlockedPackages: (): Promise<string[]> =>
    (assert(AppBlockerNative, 'AppBlocker') as typeof AppBlockerNative).getBlockedPackages(),
  isAccessibilityServiceEnabled: (): Promise<boolean> =>
    (assert(AppBlockerNative, 'AppBlocker') as typeof AppBlockerNative).isAccessibilityServiceEnabled(),
  openAccessibilitySettings: (): Promise<void> =>
    (assert(AppBlockerNative, 'AppBlocker') as typeof AppBlockerNative).openAccessibilitySettings(),
  canDrawOverlays: (): Promise<boolean> =>
    (assert(AppBlockerNative, 'AppBlocker') as typeof AppBlockerNative).canDrawOverlays(),
  openOverlaySettings: (): Promise<void> =>
    (assert(AppBlockerNative, 'AppBlocker') as typeof AppBlockerNative).openOverlaySettings(),
  /**
   * Launches an installed app by package name. Used by the shared-phone "Child Mode" kiosk
   * which renders the allowlist as a tappable grid.
   */
  launchApp: (packageName: string): Promise<void> =>
    (assert(AppBlockerNative, 'AppBlocker') as typeof AppBlockerNative).launchApp(packageName),
  /**
   * Subscribes to `KidSafeForegroundApp` events fired by `AppBlockerService` on every
   * `TYPE_WINDOW_STATE_CHANGED`. Used by `childSyncEngine` to keep `ChildDoc.currentApp`
   * fresh so the parent's "Currently using" pill updates within a few seconds.
   */
  subscribeForegroundApp: (cb: (e: ForegroundAppEvent) => void) => {
    if (IS_IOS || !AppBlockerNative) return {remove: () => {}};
    const emitter = new NativeEventEmitter(
      assert(AppBlockerNative, 'AppBlocker') as typeof AppBlockerNative,
    );
    return emitter.addListener('KidSafeForegroundApp', cb);
  },
};

// -------- ScreenTime --------

/**
 * Per-app usage breakdown for a single day. `date` is a `YYYY-MM-DD` string in the child
 * device's local timezone; `perApp` maps package name → minutes of foreground time.
 */
export interface UsageDay {
  date: string;
  totalMins: number;
  perApp: Record<string, number>;
}

export interface RecentForegroundApp {
  packageName: string | null;
  updatedAt: number;
}

export const ScreenTime = {
  hasUsageAccess: (): Promise<boolean> =>
    (assert(ScreenTimeNative, 'ScreenTime') as typeof ScreenTimeNative).hasUsageAccess(),
  openUsageAccessSettings: (): Promise<void> =>
    (assert(ScreenTimeNative, 'ScreenTime') as typeof ScreenTimeNative).openUsageAccessSettings(),
  setDailyLimitMinutes: (mins: number): Promise<boolean> =>
    (assert(ScreenTimeNative, 'ScreenTime') as typeof ScreenTimeNative).setDailyLimitMinutes(mins),
  getTodayUsedMinutes: (): Promise<number> =>
    (assert(ScreenTimeNative, 'ScreenTime') as typeof ScreenTimeNative).getTodayUsedMinutes(),
  lockIfOverLimit: (): Promise<boolean> =>
    (assert(ScreenTimeNative, 'ScreenTime') as typeof ScreenTimeNative).lockIfOverLimit(),
  /**
   * Returns the per-app foreground time for the last `days` days. The last entry of `days`
   * is "today" (midnight → now). Per-app maps are pre-sorted by minutes desc and capped at
   * `topN` apps each (default 30) — the parent UI never needs the long tail.
   */
  getPerAppUsage: (days = 7, topN = 30): Promise<{days: UsageDay[]}> =>
    (assert(ScreenTimeNative, 'ScreenTime') as typeof ScreenTimeNative).getPerAppUsage(days, topN),
  /**
   * Returns the most recently foregrounded package detected by UsageStats events inside the
   * supplied lookback window. Used as a launcher-conflict cross-check for the live pill scorer.
   */
  getRecentForegroundApp: (lookbackMs = 15_000): Promise<RecentForegroundApp> =>
    (assert(ScreenTimeNative, 'ScreenTime') as typeof ScreenTimeNative).getRecentForegroundApp(
      lookbackMs,
    ),
};

// -------- Location --------
//
// Authority for fused-location updates + Firestore writes lives in the native
// `LocationWriter` (foreground service). The JS layer's job is to:
//   - probe permissions during onboarding and at engine boot,
//   - call `startWatching` to nudge the native writer to attach (idempotent),
//   - read `currentLocation` from Firestore via the regular child-doc subscriber.
//
// `subscribe` is retained for backward compat with in-process consumers, but the native
// module no longer emits `KidSafeLocation` events — listeners simply never fire. New code
// should subscribe to `children/{childUid}.currentLocation` via the firestore helpers.

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
}

export const Location = {
  hasLocationPermission: (): Promise<boolean> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).hasLocationPermission(),
  hasBackgroundLocationPermission: (): Promise<boolean> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).hasBackgroundLocationPermission(),
  /**
   * Reads the system-wide Location / GPS master switch — the toggle exposed in quick-settings
   * panels. Returns `true` only when at least one provider can actually produce fixes. Distinct
   * from `hasLocationPermission` (which only checks the per-app grant): on Realme/ColorOS we
   * routinely see permission granted but this returning `false`, which makes the fused-location
   * subscription a no-op and is the root cause the parent saw "GPS turned off" with the kid
   * insisting permission was "all the time".
   *
   * Backs the onboarding wizard's `locationServicesStep` so the kid cannot finish setup without
   * flipping GPS on. The native writer's own `system_location_off` diagnostic is the runtime
   * safety net for the same scenario.
   */
  isLocationServicesEnabled: (): Promise<boolean> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).isLocationServicesEnabled(),
  startWatching: (): Promise<boolean> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).startWatching(),
  stopWatching: (): Promise<boolean> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).stopWatching(),
  getCurrent: (): Promise<LocationUpdate | null> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).getCurrent(),
  /**
   * Retained for backward compat — the native writer no longer emits these events. Listeners
   * registered here will simply never fire. Subscribe to Firestore `currentLocation` instead.
   */
  subscribe: (cb: (loc: LocationUpdate) => void) => {
    if (IS_IOS || !LocationNative) return {remove: () => {}};
    const emitter = new NativeEventEmitter(LocationNative);
    return emitter.addListener('KidSafeLocation', cb);
  },
};

// -------- Geofence (emits 'KidSafeGeofence') --------

export interface GeofenceTransition {
  transition: 'enter' | 'exit' | 'dwell';
  lat: number;
  lng: number;
  timestamp: number;
}

export const Geofence = {
  setFence: (lat: number, lng: number, radiusM: number): Promise<boolean> =>
    (assert(GeofenceNative, 'Geofence') as typeof GeofenceNative).setFence(lat, lng, radiusM),
  clearFence: (): Promise<boolean> =>
    (assert(GeofenceNative, 'Geofence') as typeof GeofenceNative).clearFence(),
  subscribe: (cb: (t: GeofenceTransition) => void) => {
    if (IS_IOS || !GeofenceNative) return {remove: () => {}};
    const emitter = new NativeEventEmitter(GeofenceNative);
    return emitter.addListener('KidSafeGeofence', cb);
  },
};

// -------- ForegroundService --------

/**
 * Screen on/off event emitted by `KidSafeForegroundService`'s `BroadcastReceiver`.
 * `state` is `'foreground'` once the user has dismissed the keyguard (so we don't show the
 * pill as "active" while the lockscreen is up) and `'screen_off'` the moment the display
 * powers down.
 */
export interface ScreenStateEvent {
  state: 'foreground' | 'screen_off';
  timestamp: number;
}

export const ForegroundService = {
  start: (childUid: string): Promise<boolean> =>
    (assert(ForegroundServiceNative, 'ForegroundService') as typeof ForegroundServiceNative).start(childUid),
  isRunning: (): Promise<boolean> =>
    (assert(ForegroundServiceNative, 'ForegroundService') as typeof ForegroundServiceNative).isRunning(),
  /**
   * Subscribes to `KidSafeScreenState` events fired when the device screen turns off
   * (`ACTION_SCREEN_OFF`) or the user unlocks (`ACTION_USER_PRESENT`).
   */
  subscribeScreenState: (cb: (e: ScreenStateEvent) => void) => {
    if (IS_IOS || !ForegroundServiceNative) return {remove: () => {}};
    const emitter = new NativeEventEmitter(
      assert(ForegroundServiceNative, 'ForegroundService') as typeof ForegroundServiceNative,
    );
    return emitter.addListener('KidSafeScreenState', cb);
  },
};

// -------- Schedule --------

export const Schedule = {
  /**
   * @param daysMask  bitmask of days the schedule applies to. Bit 0 = Sun .. bit 6 = Sat.
   * @param startMins start time in minutes since local midnight (0..1439).
   * @param endMins   end time in minutes since local midnight. If <= startMins the window crosses midnight.
   */
  setSchedule: (
    enabled: boolean,
    daysMask: number,
    startMins: number,
    endMins: number,
    allowedPackages: string[],
  ): Promise<boolean> =>
    (assert(ScheduleNative, 'Schedule') as typeof ScheduleNative).setSchedule(
      enabled,
      daysMask,
      startMins,
      endMins,
      allowedPackages,
    ),
  isActiveNow: (): Promise<boolean> =>
    (assert(ScheduleNative, 'Schedule') as typeof ScheduleNative).isActiveNow(),
};

// -------- OemSettings --------
//
// Deep links into OEM-specific system settings pages so the user lands directly on KidSafe's
// permission row instead of an alphabetised list. Every method falls back to a generic intent and
// finally to the app's "App info" page if the OEM-specific activity is missing.

export type Oem = 'xiaomi' | 'samsung' | 'oppo' | 'vivo' | 'huawei' | 'generic';

export const OemSettings = {
  getOem: (): Promise<Oem> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).getOem(),
  openAppDetailsSettings: (): Promise<void> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).openAppDetailsSettings(),
  /**
   * Opens the system-wide Location / GPS toggle page (`Settings.ACTION_LOCATION_SOURCE_SETTINGS`).
   * Falls back to KidSafe's app-info page on the rare device that strips the action. Paired with
   * `Location.isLocationServicesEnabled` as the wizard's auto-detect read-back so the step
   * advances on its own the moment the kid flips the toggle and returns to the app.
   */
  openLocationSourceSettings: (): Promise<void> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).openLocationSourceSettings(),
  openAutostartSettings: (): Promise<void> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).openAutostartSettings(),
  openBatteryUnrestricted: (): Promise<void> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).openBatteryUnrestricted(),
  openMiuiOtherPermissions: (): Promise<void> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).openMiuiOtherPermissions(),
  /**
   * Reads `PowerManager.isIgnoringBatteryOptimizations(packageName)` so the wizard can
   * auto-detect when the user grants the battery exemption — we no longer have to fall back to
   * the "Did you do it?" verification sheet for this step.
   */
  isIgnoringBatteryOptimizations: (): Promise<boolean> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).isIgnoringBatteryOptimizations(),
};

// -------- Pin (uninstall protection PIN) --------
//
// The PIN is set on the child device during onboarding (parent supposed to be physically present)
// and stored salted-and-hashed in SharedPreferences. JS only ever sees boolean / numeric results.

export const Pin = {
  setPin: (pin: string): Promise<void> =>
    (assert(PinNative, 'Pin') as typeof PinNative).setPin(pin),
  hasPin: (): Promise<boolean> =>
    (assert(PinNative, 'Pin') as typeof PinNative).hasPin(),
  verifyPin: (pin: string): Promise<boolean> =>
    (assert(PinNative, 'Pin') as typeof PinNative).verifyPin(pin),
  clearPin: (): Promise<void> =>
    (assert(PinNative, 'Pin') as typeof PinNative).clearPin(),
  /** Milliseconds remaining in the current lockout (0 if entry is allowed). */
  lockoutRemainingMs: (): Promise<number> =>
    (assert(PinNative, 'Pin') as typeof PinNative).lockoutRemainingMs(),
};

// -------- Supervision (onboarding gate-suppression window) --------
//
// The onboarding wizard arms a short supervision window before opening Settings screens that the
// tamper guard would otherwise intercept (Accessibility, Usage access, Autostart, Battery). The
// window auto-expires so protection always comes back on its own. The wizard also disarms it on
// `Finish` so the gate re-arms instantly once setup is done.

export const Supervision = {
  /** Arm supervision for [durationMs] milliseconds. Returns the resulting expiry timestamp. */
  arm: (durationMs: number): Promise<number> =>
    (assert(SupervisionNative, 'Supervision') as typeof SupervisionNative).arm(durationMs),
  disarm: (): Promise<void> =>
    (assert(SupervisionNative, 'Supervision') as typeof SupervisionNative).disarm(),
  isActive: (): Promise<boolean> =>
    (assert(SupervisionNative, 'Supervision') as typeof SupervisionNative).isActive(),
};

// -------- ChildMode (shared phone kiosk) --------
//
// Two persistent flags backing the shared-phone feature. Native is the reader (the
// accessibility service consults them before blocking) and JS is the writer. Mirrored
// into Firestore for parent-side visibility, but the native flag is the source of truth
// since it survives JS engine death and OEM kills.

export const ChildMode = {
  /** True if this install was set up as a "one shared phone" family. */
  isSharedDevice: (): Promise<boolean> =>
    (assert(ChildModeNative, 'ChildMode') as typeof ChildModeNative).isSharedDevice(),
  /** Persist the shared-vs-two-device choice. Called once at signup; also on mode-switch. */
  setSharedDevice: (shared: boolean): Promise<void> =>
    (assert(ChildModeNative, 'ChildMode') as typeof ChildModeNative).setSharedDevice(shared),
  /** True when the parent has flipped the kiosk on for the child. Polled by the root nav gate. */
  isActive: (): Promise<boolean> =>
    (assert(ChildModeNative, 'ChildMode') as typeof ChildModeNative).isActive(),
  /**
   * Flip Child Mode. `profileId` is the shared profile's `childUid` so native can persist it
   * alongside the flag — keeps reboot recovery deterministic.
   */
  setActive: (active: boolean, profileId: string | null): Promise<void> =>
    (assert(ChildModeNative, 'ChildMode') as typeof ChildModeNative).setActive(active, profileId),
  getProfileId: (): Promise<string | null> =>
    (assert(ChildModeNative, 'ChildMode') as typeof ChildModeNative).getProfileId(),
  /** Returns the millis-epoch when the current Child Mode session started (0 if inactive). */
  getStartedAt: (): Promise<number> =>
    (assert(ChildModeNative, 'ChildMode') as typeof ChildModeNative).getStartedAt(),
};
