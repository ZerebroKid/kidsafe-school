import {NativeEventEmitter, NativeModules} from 'react-native';

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
} = NativeModules;

function assert(mod: unknown, name: string) {
  if (!mod) {
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
};

// -------- ScreenTime --------

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
};

// -------- Location (emits 'KidSafeLocation') --------

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
}

export const Location = {
  hasLocationPermission: (): Promise<boolean> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).hasLocationPermission(),
  startWatching: (): Promise<boolean> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).startWatching(),
  stopWatching: (): Promise<boolean> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).stopWatching(),
  getCurrent: (): Promise<LocationUpdate | null> =>
    (assert(LocationNative, 'KidSafeLocationModule') as typeof LocationNative).getCurrent(),
  subscribe: (cb: (loc: LocationUpdate) => void) => {
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
    const emitter = new NativeEventEmitter(GeofenceNative);
    return emitter.addListener('KidSafeGeofence', cb);
  },
};

// -------- ForegroundService --------

export const ForegroundService = {
  start: (childUid: string): Promise<boolean> =>
    (assert(ForegroundServiceNative, 'ForegroundService') as typeof ForegroundServiceNative).start(childUid),
  isRunning: (): Promise<boolean> =>
    (assert(ForegroundServiceNative, 'ForegroundService') as typeof ForegroundServiceNative).isRunning(),
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
  openAutostartSettings: (): Promise<void> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).openAutostartSettings(),
  openBatteryUnrestricted: (): Promise<void> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).openBatteryUnrestricted(),
  openMiuiOtherPermissions: (): Promise<void> =>
    (assert(OemSettingsNative, 'OemSettings') as typeof OemSettingsNative).openMiuiOtherPermissions(),
};
