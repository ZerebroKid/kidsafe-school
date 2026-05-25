import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type Role = 'parent' | 'child';

/**
 * How the parent intends to use KidSafe on this install.
 *
 * - `two_device` (legacy / default): parent phone + separate child phone. Child has its own
 *   Firebase user; parent monitors via Firestore.
 * - `shared`: family only owns one phone. The parent's own install hosts a single child
 *   profile and flips between "Parent dashboard" and a locked "Child Mode" kiosk on demand.
 *   No second Firebase user is created — the parent writes the child profile doc directly,
 *   guarded by `parentOwns(...)` in `firestore.rules`.
 *
 * Treated as `'two_device'` whenever absent so pre-existing users keep working unchanged.
 */
export type DeviceMode = 'two_device' | 'shared';

/**
 * Metadata for the single child profile that lives on a shared phone. The doc itself lives
 * at `children/{childUid}` where `childUid === ${parentUid}_shared`.
 */
export interface SharedProfile {
  childUid: string;
  childName: string;
  createdAt: number;
}

export interface UserDoc {
  role: Role;
  name: string;
  email: string;
  photoURL?: string | null;
  fcmToken?: string | null;
  createdAt: FirebaseFirestoreTypes.FieldValue | number;
  // Parent only: rotatable 6-digit code the child enters to link.
  pairingCode?: string;
  pairingCodeExpiresAt?: number;
  // Child only: uid of the linked parent. Set during pairing.
  parentUid?: string;
  /**
   * Parent only. Drives `RootNavigator`'s routing decision (shared-mode parents can be
   * pushed into a locked kiosk) and the engine's "treat my own phone as a child device"
   * gating. Absent === `'two_device'`.
   */
  deviceMode?: DeviceMode;
  /** Parent + shared mode only. Child profile that lives on this same install. */
  sharedProfile?: SharedProfile;
}

export interface LockState {
  locked: boolean;
  /** Optional unix-ms deadline after which the lock is automatically released. */
  until?: number | null;
}

export interface ScreenTime {
  limitMins: number;
  usedTodayMins: number;
  resetAt: number;
}

export interface Geo {
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: number;
}

/**
 * Reasons the child's location pipeline can be unhealthy. Drives the plain-English copy
 * shown on the parent's `LocationTab` banner. Single-word ids keep the Firestore payload
 * compact and make rule validation trivial (`reason in [...]`).
 *
 * Ordered roughly from "kid needs to do something" → "device needs to be restarted" so the
 * UI can pick the most-actionable reason when multiple flags are simultaneously true.
 */
export type LocationDiagnosticsReason =
  | 'fine_permission_missing'
  | 'background_permission_missing'
  | 'system_location_off'
  | 'play_services_unavailable'
  | 'fg_service_not_running'
  | 'first_fix_timeout'
  | 'firestore_write_failing';

/**
 * Child-written health record for the location pipeline. Mirrors what's surfaced in the
 * parent's "Why isn't location updating?" banner. The native `LocationWriter` and the JS
 * `ensureLocationWatcher` are both writers; throttled to one write per minute on the
 * child side to avoid a hot-loop.
 */
export interface LocationDiagnostics {
  /** Unix-ms when the child app last evaluated its location pipeline. */
  evaluatedAt: number;
  /** True = every check passed and the writer is delivering fixes. */
  ok: boolean;
  /** When `ok === false`. Drives the parent banner's copy + CTA. */
  reason?: LocationDiagnosticsReason;
  /**
   * Free-form context for the parent banner. Examples:
   *   "Realme is killing the background service — ask kid to enable Autostart for KidSafe."
   *   "System location toggle is OFF — ask kid to tap Settings → Location → On."
   * Kept short (< 140 chars) so it fits on one line of the banner on small phones.
   */
  hint?: string;
}

export interface Geofence {
  centerLat: number;
  centerLng: number;
  radiusM: number;
  active: boolean;
}

export interface Schedule {
  enabled: boolean;
  /** 0 = Sunday .. 6 = Saturday */
  daysOfWeek: number[];
  /** Minutes since local midnight, 0..1439. */
  startMinutes: number;
  /** Minutes since local midnight, 0..1439. If <= startMinutes the window crosses midnight. */
  endMinutes: number;
  /** Apps that remain usable while the window is active. Everything else gets blocked. */
  allowedPackages: string[];
}

export interface PinResetRequest {
  /** Unix-ms when the parent issued the reset. Mostly informational; presence is what matters. */
  requestedAt: number;
}

/**
 * Live "Child Mode" flag on a shared-phone install. Mirrors the native
 * `KidSafeStore.CHILD_MODE_ACTIVE` flag so the parent's dashboard and the kiosk both have a
 * single source of truth. Native is authoritative — Firestore is mirrored for visibility
 * and so the parent can flip child mode from any signed-in instance.
 */
export interface ChildModeState {
  active: boolean;
  /** Unix-ms when the parent last started Child Mode. */
  startedAt: number;
  /** Firebase uid of the parent that flipped the switch. */
  startedByParentUid: string;
}

/**
 * Live "what is the child using right now" snapshot, written by the child sync engine and
 * read by the parent's `CurrentAppPill`. Kept intentionally tiny (~80 bytes) — the parent
 * resolves `packageName` against the `apps` subcollection for the friendly name + icon so
 * the doc itself doesn't drift when the device locale changes.
 *
 * States:
 *  - `foreground` — accessibility service saw a `TYPE_WINDOW_STATE_CHANGED` for this package
 *  - `screen_off` — `ACTION_SCREEN_OFF` fired, or sync engine stopped cleanly
 *  - `unavailable` — accessibility service is disabled on the child device
 */
export interface ChildForegroundApp {
  /** Null when the screen is off, the device is locked, or the data source is unavailable. */
  packageName: string | null;
  state: 'foreground' | 'screen_off' | 'unavailable';
  /** Unix-ms when the child last refreshed this field. Used for staleness detection. */
  updatedAt: number;
  /**
   * Optional confidence hint from the child scorer.
   * - `high`: strong non-launcher signal (or confirmed by cross-check)
   * - `low`: launcher-like signal that may be transitional on some OEMs
   */
  confidence?: 'high' | 'low';
  /**
   * Why this write happened. Useful for OEM diagnostics and for pill rendering subtleties.
   * Kept as a broad union — the native foreground service may add new reason values
   * (`usage_stats_poll`, `heartbeat_keep_last_real`, ...) without us needing to update this
   * type on every iteration.
   */
  reason?: string;
  /** Which detector produced the winning package for this write. */
  source?: 'accessibility' | 'usage_stats' | 'screen_state' | 'native_usage_stats';
  /**
   * Raw package from the latest accessibility event before scorer normalization. When the
   * scorer prefers a different package (e.g. launcher conflict), this helps debug OEM behavior.
   */
  rawPackage?: string | null;
  /** Last non-launcher package observed in the recent scoring window. */
  lastNonLauncherPackage?: string | null;
  /** Unix-ms when `lastNonLauncherPackage` was observed. */
  lastNonLauncherAt?: number;
}

export interface ChildDoc {
  status: 'online' | 'offline';
  lastSeenAt: FirebaseFirestoreTypes.FieldValue | number;
  /**
   * `'child_owned'` (legacy / default): doc was created by a child Firebase user signed in
   * on their own phone. `'shared'`: the parent owns this profile on a shared-phone install
   * and writes the doc directly (auth uid !== doc id). Absent === `'child_owned'`.
   */
  mode?: 'child_owned' | 'shared';
  /**
   * Always set for `mode === 'shared'` docs — used by the Firestore `parentOwns(...)` rule
   * to verify the writer. Optional/absent for legacy child-owned docs (the parent is
   * resolved via `users/{childUid}.parentUid` there).
   */
  parentUid?: string;
  /** Live Child Mode flag for shared-phone installs. Always absent on `child_owned` docs. */
  childMode?: ChildModeState;
  lockState: LockState;
  screenTime?: ScreenTime;
  currentLocation?: Geo;
  geofence?: Geofence;
  schedule?: Schedule;
  deviceAdminActive?: boolean;
  /**
   * Set by the parent when they want to clear the on-device PIN (e.g. parent forgot it). The
   * child sync engine clears the local PIN on next foreground sync and immediately deletes the
   * field so the request is one-shot.
   */
  pinResetRequest?: PinResetRequest;
  lastGeofenceEvent?: {
    transition: 'enter' | 'exit' | 'dwell';
    lat: number;
    lng: number;
    timestamp: number;
  };
  /**
   * Opaque per-install id of the phone that most recently completed an apps reconcile. Lets the
   * parent UI tell "this child has never opened KidSafe" from "we have a stale list" — and lets
   * us detect a device switch (same Firebase account, different phone) to refresh state.
   */
  currentDeviceId?: string;
  /** Unix-ms when the child device last finished a full apps reconcile. */
  appsLastSyncedAt?: number;
  /**
   * Live "what is the child using right now" snapshot. Updated by the child sync engine
   * on foreground app changes (3s coalesce + 30s heartbeat) and on screen on/off events.
   * Absent means the child hasn't reported yet (or the engine hasn't started since this
   * field was introduced) — parent UI shows a neutral placeholder in that case.
   */
  currentApp?: ChildForegroundApp;
  /**
   * Health record for the location pipeline. Written by the child (native `LocationWriter`
   * and JS `ensureLocationWatcher`) whenever the state transitions (permission granted ↔
   * revoked, system location toggled, first-fix watchdog fires, Firestore writes fail).
   * Read by the parent's `LocationTab` to render a "why isn't location updating?" banner.
   */
  locationDiagnostics?: LocationDiagnostics;
}

export interface AppEntry {
  packageName: string;
  appName: string;
  icon?: string;
  isBlocked: boolean;
  installedAt?: FirebaseFirestoreTypes.FieldValue | number;
}

/**
 * One day's screen-time breakdown. Stored at `children/{childUid}/usageDaily/{date}` so we can
 * cheaply query a sliding 7-day window without bloating the parent dashboard `ChildDoc`.
 *
 * `date` is `YYYY-MM-DD` in the **child** device's local timezone. Both writer (child sync
 * engine) and reader (parent UI) use the date string verbatim — no UTC conversion — so the
 * chart always reads as "the child's day" even when the parent is in a different zone.
 */
export interface UsageDailyDoc {
  date: string;
  totalMins: number;
  /** Package name → minutes of foreground time. Pre-sorted by minutes desc on the child side. */
  perApp: Record<string, number>;
  updatedAt: FirebaseFirestoreTypes.FieldValue | number;
}
