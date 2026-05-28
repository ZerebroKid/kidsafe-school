/**
 * Platform-agnostic Firestore types shared by all Zerebro apps + Cloud Functions.
 *
 * `shared-types` has NO RN / Firebase SDK deps -- web apps, Cloud Functions, and the
 * React Native apps all consume from here. Each consumer coerces FieldValue-like
 * tokens at its own boundary (RN Firebase: `firestore.FieldValue.serverTimestamp()`,
 * Firebase Web / Admin: `serverTimestamp()`).
 */

/**
 * Sentinel-or-timestamp placeholder for write-time fields. The Firestore SDK accepts
 * either a number (ms since epoch) OR a server-resolved token (e.g. serverTimestamp()).
 * We don't pin the token shape because it differs across web, native, and admin SDKs.
 */
export type FirestoreFieldValueLike = number | object;

/** Unix-ms timestamp. Used by every doc that needs a wire-stable created/updated time. */
export type FirestoreTimestampMs = number;

/**
 * The five roles Zerebro recognizes. v1 only emitted `'parent' | 'child'`; v2 widens
 * here so v2-aware code (shared-firebase auth helpers, the future Zerebro Campus &
 * Admin webs) can typecheck end-to-end. v1 code paths still only produce `parent` /
 * `child` -- the wider set is purely additive.
 */
export type Role = 'admin' | 'principal' | 'teacher' | 'parent' | 'child';

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

/**
 * v2 user doc. Every user has an array of roles + a primary role that drives navigation.
 *
 * Migration story (Phase 3):
 *  - `roles: Role[]` and `primaryRole: Role` are REQUIRED on every fresh write. The Phase 3
 *    one-time script (`apps/functions/src/scripts/oneTimeMigration_v1_to_v2.ts`) backfills
 *    them for existing v1 docs and stamps `migratedAt`.
 *  - `role` (single, v1) stays as an OPTIONAL legacy alias that signup paths still write so
 *    a fresh checkout pointing at a not-yet-deployed rule set still satisfies the v1 create
 *    shape in `firestore/rules`. Reads MUST go through `getUserDoc` in `@zerebro/shared-firebase`
 *    which normalises v1 docs to v2 in-memory. Removable once Phase 4 ships and we widen
 *    the create rule to require the v2 shape only.
 *  - `name` and `email` stay optional because phone-OTP signups (web Campus/Admin from
 *    Phase 2.2.3) never collect them.
 *
 * Role-escalation defence: clients are NEVER allowed to mutate `roles` directly (locked in
 * `firestore/rules` Phase 3.4.2). Only Admin SDK from Cloud Functions can append (e.g. the
 * Phase 4 `approveTeacher` callable adds 'teacher'). `primaryRole` IS self-writable so the
 * ZConnect role switcher works without a round-trip to a Function.
 */
export interface UserDoc {
  /** Every role the user holds. Append-only from the client's perspective. */
  roles: Role[];
  /** Drives navigation in ZConnect. Self-writable so RoleSwitcher can flip it instantly. */
  primaryRole: Role;
  /** Phone E.164 -- set on web phone-OTP signups (P2.2.3). Optional because email signups don't collect it. */
  phone?: string;
  /** Display name -- collected by email signups, may be missing on OTP signups until profile completion. */
  displayName?: string;
  /** Unix-ms when the migration script stamped this doc. Absent on docs that were born v2. */
  migratedAt?: FirestoreFieldValueLike;
  /**
   * Legacy v1 single-role field. Still written by ZKid/ZConnect's `ensureUserDoc` for
   * back-compat with the v1 create rule branch; reads must normalise via `getUserDoc`.
   * @deprecated Drops after Phase 4 lands and the v1 create rule branch is removed.
   */
  role?: Role;
  /** @deprecated -- v1 field; kept optional for back-compat. */
  name?: string;
  /** @deprecated -- v1 field; kept optional for back-compat. */
  email?: string;
  photoURL?: string | null;
  fcmToken?: string | null;
  /**
   * Every school this user belongs to (parent, teacher, or child). Array-unioned
   * by `joinSchoolAsParent` / `joinSchool` / `approveTeacher` / `approvePrincipal`
   * in the same transaction that flips `roles[]`. Optional because v1 docs and
   * fresh OTP users (pre-`joinSchool*`) don't have it. Drives the ZKid
   * SchoolStep gate ("paired but not yet school-linked").
   */
  schoolIds?: string[];
  createdAt: FirestoreFieldValueLike;
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

/**
 * Pointer from a `children/{uid}` doc back to its school + class section.
 * Written by `joinSchool` callable in the same transaction that array-unions
 * the child uid into `schools/{schoolId}/classes/{classId}.studentChildUids`.
 * `schoolId` matches `users/{uid}.schoolIds[0]` for a child (children only
 * join ONE school today; the array shape on the user doc is forward-compat
 * with multi-school parents and is intentional).
 */
export interface ChildClassRef {
  schoolId: string;
  classId: string;
}

export interface ChildDoc {
  status: 'online' | 'offline';
  lastSeenAt: FirestoreFieldValueLike;
  /**
   * Set by `joinSchool` callable after first-time ZKid school-step. Absent
   * until the child enters a valid school code + grade + section. Drives the
   * class roster the principal sees and the curriculum the topic-learn screens
   * pull. Once set, future logins skip the school step entirely.
   */
  classId?: ChildClassRef;
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
  installedAt?: FirestoreFieldValueLike;
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
  updatedAt: FirestoreFieldValueLike;
}

// `UserDocStub` was the Phase 2 forward-compat alias for the v2 shape. As of
// Phase 3.2.1 `UserDoc` itself IS the v2 shape (roles[] + primaryRole) so the
// alias is gone -- import `UserDoc` directly. If a TS error points at this
// file complaining about a missing `UserDocStub` symbol, the fix is to swap
// the import to `UserDoc`.
