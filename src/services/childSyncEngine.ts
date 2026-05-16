import auth from '@react-native-firebase/auth';
import firestore, {firebase} from '@react-native-firebase/firestore';
import {AppState, type AppStateStatus} from 'react-native';

import {
  deleteAppEntry,
  paths,
  setChildAppsSyncMeta,
  setUsageDaily,
  writeAppEntry,
  writeChildStatus,
  writeGeofenceEvent,
  writeLocation,
} from '../firebase/firestore';
import {
  AppBlocker,
  ChildMode,
  DeviceAdmin,
  ForegroundService,
  Geofence,
  InstalledApps,
  Location,
  Pin,
  Schedule,
  ScreenTime,
} from '../modules/native';
import type {AppEntry, ChildDoc, Schedule as ScheduleConfig} from '../firebase/types';
import {ENV} from '../config/env';
import {getOrCreateDeviceId} from './deviceId';

/**
 * Engine variants:
 *  - `'two_device'` (default): child Firebase user signed in on their own phone. All blocking,
 *    foreground tracking, schedule enforcement, and usage uploads run unconditionally.
 *  - `'shared'`: parent Firebase user signed in on a single-phone install. Same engine, but
 *    enforcement is gated on `ChildDoc.childMode.active` so the phone behaves like the
 *    parent's own device when Child Mode is OFF (no blocking, no foreground writes, no
 *    usage tracking — anything else would either block the parent or upload the parent's
 *    personal app usage to Firestore).
 */
export type EngineMode = 'two_device' | 'shared';

interface EngineOpts {
  mode?: EngineMode;
}

/**
 * Wires the child side together:
 *   - Pushes local state (apps, location, usage) up to Firestore.
 *   - Listens to the child's Firestore doc and reacts to parent-issued commands:
 *       lock, geofence, screenTime, blocked apps.
 *
 * This runs as long as the user is signed in and has role=child.
 */

const unsubs: Array<() => void> = [];
let locationSub: {remove: () => void} | null = null;
let geofenceSub: {remove: () => void} | null = null;
let appStateSub: {remove: () => void} | null = null;
let foregroundAppSub: {remove: () => void} | null = null;
let screenStateSub: {remove: () => void} | null = null;
let lastLocationWriteAt = 0;
let lastReconcileAt = 0;
let screenTimeTicker: ReturnType<typeof setInterval> | null = null;
let perAppUsageTicker: ReturnType<typeof setInterval> | null = null;
let currentAppHeartbeatTicker: ReturnType<typeof setInterval> | null = null;

// --- Shared-phone gating ---------------------------------------------------------------------
//
// `engineMode` is set once at start. `childModeActive` mirrors `ChildDoc.childMode.active`
// (which in turn is mirrored into the native `ChildMode` flag for boot-time enforcement).
// `enforcing` is the unified gate used everywhere — true for all two-device installs, and for
// shared installs only while Child Mode is on.
//
// We also cache the latest blocklist + schedule we've seen so we can re-push them to native
// when `enforcing` flips on (or push neutral empty values when it flips off).

let engineMode: EngineMode = 'two_device';
let childModeActive = false;
let cachedBlocklist: string[] = [];
let cachedSchedule: ScheduleConfig | undefined;
/**
 * The child uid the engine is currently writing for. In two-device mode this is the same
 * as the signed-in Firebase uid; in shared mode it's `${parentUid}_shared` and must NOT be
 * confused with `auth().currentUser?.uid` (which would point at the parent).
 */
let activeChildUid: string | null = null;

/** True when we should actually enforce blocking + push tracking data. */
function isEnforcing(): boolean {
  return engineMode === 'two_device' || childModeActive;
}

// --- Live "currently using" pill state (mirrors ChildDoc.currentApp) -------------------------
//
// Root problem on XOS-like OEMs: the accessibility stream can emit launcher/home after a real
// app transition. If we simply "take the last package in 3s", the launcher can overwrite
// WhatsApp and the 30s heartbeat then keeps that wrong state fresh.
//
// Fix strategy:
//  1) Keep a short window of recent foreground events.
//  2) Score candidates: prefer most recent non-launcher over launcher within a recency horizon.
//  3) For launcher winners, optionally cross-check UsageStats' recent foreground package.
//  4) Persist confidence/reason/source metadata so parent UI and diagnostics can explain state.

const CURRENT_APP_DEBUG = __DEV__;
/**
 * Collect events over this window before committing a foreground write. Tightened from 3s →
 * 1s now that the native foreground-service resolver owns the primary live-pill path — JS is
 * a hot-path fallback for in-process foreground emits (when the parent dashboard is itself
 * running) and shouldn't drag updates by 3s when the native writer would have flushed within
 * 1.5s anyway.
 */
const CURRENT_APP_COALESCE_MS = 1_000;
/**
 * Heartbeat to keep genuine sessions fresh in parent UI. Bumped from 30s → 60s because the
 * native ticker already refreshes Firestore every ~25s for the same package; JS heartbeats on
 * top of that would just double the write cost without changing what the parent sees.
 */
const CURRENT_APP_HEARTBEAT_MS = 60_000;
/**
 * If the native writer wrote within this many milliseconds of a JS-coalesced foreground push,
 * the JS write is skipped to avoid two writers racing on the same Firestore doc. The native
 * writer's heartbeat (`HEARTBEAT_REFRESH_MS` in `CurrentAppWriter.kt`) keeps the doc fresh
 * regardless, so dropping the JS write is safe.
 */
const NATIVE_WRITE_SUPPRESSION_MS = 1_500;
/** If a non-launcher happened this recently, do not let launcher immediately win. */
const NON_LAUNCHER_RECENCY_MS = 8_000;
/** Launcher confidence decays fast — require quicker reconfirmation. */
const LAUNCHER_HEARTBEAT_MS = 90_000;
/** UsageStats lookback used only when launcher is candidate winner. */
const USAGE_CROSSCHECK_LOOKBACK_MS = 15_000;
/** Keep only a bounded event window for scoring. */
const MAX_FOREGROUND_EVENTS = 20;

const LAUNCHER_PREFIXES = [
  'com.android.launcher',
  'com.google.android.apps.nexuslauncher',
  'com.sec.android.app.launcher',
  'com.miui.home',
  'com.miui.launcher',
  'com.oppo.launcher',
  'com.bbk.launcher2',
  'com.realme.launcher',
  'com.oneplus.launcher',
  'net.oneplus.launcher',
  'com.transsion.xoslauncher',
  'com.transsion.launcher',
  'com.infinix.xlauncher',
] as const;

type CurrentAppState = 'foreground' | 'screen_off' | 'unavailable';
type CurrentAppConfidence = 'high' | 'low';
type CurrentAppSource =
  | 'accessibility'
  | 'usage_stats'
  | 'screen_state'
  | 'native_usage_stats';
type CurrentAppReason =
  | 'foreground_emit'
  | 'heartbeat'
  | 'screen_off'
  | 'accessibility_unavailable'
  | 'engine_stop'
  | 'child_mode_off'
  | 'native_skip';

interface ForegroundCandidate {
  packageName: string;
  timestamp: number;
  source: 'accessibility' | 'usage_stats';
}

interface ForegroundWriteMeta {
  confidence: CurrentAppConfidence;
  source: CurrentAppSource;
  reason: CurrentAppReason;
  rawPackage?: string | null;
}

let lastPushedPkg: string | null = null;
let lastPushedState: CurrentAppState | null = null;
let lastPushedAt = 0;
let lastPushedConfidence: CurrentAppConfidence = 'high';
let pendingForegroundPkg: string | null = null;
let pendingForegroundTs = 0;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
let recentForegroundEvents: ForegroundCandidate[] = [];
let lastNonLauncherPkg: string | null = null;
let lastNonLauncherAt = 0;
/**
 * Unix-ms when we last observed a write from the native foreground-service resolver
 * (`source === 'native_usage_stats'`) come back through the child-doc snapshot. JS uses this
 * to suppress its own coalesced write when the native side just owned the doc — avoids two
 * writers racing on `currentApp` and flickering the parent pill.
 */
let lastSeenNativeWriteAt = 0;

/** 10 minutes between per-app usage uploads — see comment on the ticker setup below. */
const PER_APP_USAGE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Re-reconcile the apps list every time the child app returns to foreground after this long.
 * Catches the (rare) case where a long-running session survives an account swap without the
 * `startChildSyncEngine` restart, plus the (common) case of returning from background after a
 * batch of installs/uninstalls happened while the receiver wasn't running.
 */
const RECONCILE_REFRESH_MS = 5 * 60 * 1000;

/**
 * Firestore batches are capped at 500 writes. A handful of phones with bloated OEM bloatware
 * push close to that, and a device-switch reconcile may add a chunk of deletes on top. We
 * commit in 450-op slices to leave a comfortable buffer.
 */
const BATCH_CHUNK = 450;

function isLauncher(pkg: string): boolean {
  const normalized = pkg.toLowerCase();
  return LAUNCHER_PREFIXES.some(
    prefix => normalized === prefix || normalized.startsWith(prefix),
  );
}

function logCurrentApp(event: string, payload: Record<string, unknown>) {
  if (!CURRENT_APP_DEBUG) {return;}
  console.log(`[KidSafe][CurrentApp] ${event}`, payload);
}

export async function startChildSyncEngine(childUid: string, opts: EngineOpts = {}) {
  engineMode = opts.mode ?? 'two_device';
  activeChildUid = childUid;

  // Hydrate the local Child Mode flag BEFORE starting any subscribers, so the very first
  // `applyNativePolicy()` reflects the post-reboot truth instead of a stale `false`.
  if (engineMode === 'shared') {
    try {
      childModeActive = await ChildMode.isActive();
    } catch (e) {
      console.warn('ChildMode.isActive failed at engine start', e);
      childModeActive = false;
    }
    // Belt-and-braces: re-assert mode + parentUid on the shared profile doc so the
    // subsequent `writeChildStatus` (and every other parent-owned write the engine
    // performs) satisfies the `parentOwns(childUid)` Firestore rule. Defends against
    // the doc being deleted out-of-band (manual Firestore console edit, mode-switch
    // race) while the engine is still configured for shared mode.
    const parentUid = auth().currentUser?.uid;
    if (parentUid) {
      try {
        await paths.child(childUid).set(
          {mode: 'shared', parentUid},
          {merge: true},
        );
      } catch (e) {
        console.warn('shared profile re-assert failed', e);
      }
    }
  } else {
    childModeActive = false;
  }

  await writeChildStatus(childUid, 'online');

  // 1. Subscribe to the child doc so parent commands flow in.
  const docUnsub = paths.child(childUid).onSnapshot(async snap => {
    if (!snap.exists) {return;}
    const data = snap.data() as ChildDoc;
    await reactToChildDoc(childUid, data);
  });
  unsubs.push(docUnsub);

  // 2. Subscribe to blocked apps. We CACHE the latest blocklist so flipping Child Mode on
  //    can re-push it to native without waiting for the next Firestore change. When the
  //    engine is in shared mode and Child Mode is OFF, we deliberately push an empty list
  //    so the parent's own foreground app activity is never blocked.
  const appsUnsub = paths.apps(childUid).onSnapshot(async snap => {
    cachedBlocklist = snap.docs
      .filter(d => (d.data() as AppEntry).isBlocked)
      .map(d => d.id);
    console.log(
      `[KidSafe] Received blocklist update (${cachedBlocklist.length}, enforcing=${isEnforcing()}):`,
      cachedBlocklist,
    );
    await pushBlocklistToNative();
  });
  unsubs.push(appsUnsub);

  // 3. Reconcile installed apps. Unlike a plain "write current device's apps and call it a
  //    day" pass, this also deletes Firestore docs for packages absent on this device — so a
  //    device switch (same Firebase account, different phone) doesn't leave the parent staring
  //    at a merged list. Failures are logged but not fatal; we retry on every foreground.
  reconcileInstalledApps(childUid).catch(e => console.warn('reconcileInstalledApps', e));

  // 4. Re-run the reconcile when the app returns to foreground after a quiet stretch.
  appStateSub = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status !== 'active') {return;}
    if (Date.now() - lastReconcileAt < RECONCILE_REFRESH_MS) {return;}
    reconcileInstalledApps(childUid).catch(e => console.warn('reconcile on foreground', e));
  });

  // 5. Start watching location if allowed.
  try {
    if (await Location.hasLocationPermission()) {
      await Location.startWatching();
      locationSub = Location.subscribe(async loc => {
        const now = Date.now();
        if (now - lastLocationWriteAt < ENV.LOCATION_MIN_INTERVAL_MS) {return;}
        lastLocationWriteAt = now;
        await writeLocation(childUid, loc);
      });
    }
  } catch (e) {
    console.warn('location start failed', e);
  }

  // 6. Listen to geofence events (raised from the GeofenceModule event emitter).
  geofenceSub = Geofence.subscribe(async t => {
    await writeGeofenceEvent(childUid, t.transition, t.lat, t.lng);
  });

  // 6b. Drive the parent dashboard's "Currently using" pill.
  //
  //   - Foreground app emits from the accessibility service are coalesced (3s) and de-duped
  //     by package so rapid swipes don't spam Firestore.
  //   - Screen on/off emits flip state immediately — that transition is what the parent UI
  //     reacts to fastest, so no coalesce.
  //   - A 30s heartbeat ticker re-writes the same state so the parent's "stale" detection
  //     (>60s without `updatedAt` movement) doesn't fire while the kid is parked on one app.
  //     The same ticker also polls `isAccessibilityServiceEnabled` so we flip to
  //     `unavailable` if the kid disables the service mid-session.
  foregroundAppSub = AppBlocker.subscribeForegroundApp(e => {
    // On a shared phone with Child Mode OFF, the native side already drops these emits, but
    // belt-and-braces: drop them in JS too so we never write the parent's app history to
    // the child profile.
    if (!isEnforcing()) {return;}
    logCurrentApp('native_fg_event', {
      packageName: e.packageName,
      timestamp: e.timestamp,
      childUid,
    });
    scheduleForegroundPush(childUid, e.packageName, e.timestamp);
  });
  screenStateSub = ForegroundService.subscribeScreenState(e => {
    if (!isEnforcing()) {return;}
    // Screen transitions cancel any pending coalesced foreground push — once the screen is
    // off, the last "Using YouTube" emit is meaningless.
    if (coalesceTimer) {
      clearTimeout(coalesceTimer);
      coalesceTimer = null;
      pendingForegroundPkg = null;
    }
    if (e.state === 'screen_off') {
      writeCurrentApp(childUid, null, 'screen_off', {
        confidence: 'high',
        source: 'screen_state',
        reason: 'screen_off',
      });
    }
    // For ACTION_USER_PRESENT we deliberately don't write 'foreground' yet — we don't know
    // which package the user is on. The next TYPE_WINDOW_STATE_CHANGED will fill that in.
  });
  // Heartbeat + accessibility-down detector. Runs once immediately and every 30s thereafter.
  const runCurrentAppHeartbeat = async () => {
    // Skip heartbeats while shared + Child Mode off — the parent's pill state doesn't matter
    // when no kid is using the phone, and we don't want to spam writes.
    if (!isEnforcing()) {return;}
    try {
      const ok = await AppBlocker.isAccessibilityServiceEnabled();
      if (!ok) {
        // Don't spam — only write when state actually changes or the heartbeat is due.
        if (
          lastPushedState !== 'unavailable' ||
          Date.now() - lastPushedAt >= CURRENT_APP_HEARTBEAT_MS
        ) {
          await writeCurrentApp(childUid, null, 'unavailable', {
            confidence: 'high',
            source: 'screen_state',
            reason: 'accessibility_unavailable',
          });
        }
        return;
      }
    } catch {
      // Polling failures are non-fatal; skip this tick.
      return;
    }
    // If the native foreground service has been writing recently, skip the JS heartbeat
    // entirely — its own `HEARTBEAT_REFRESH_MS` (~25s) is already keeping `updatedAt` fresh
    // and we'd just be racing for the same write.
    const sinceNative = Date.now() - lastSeenNativeWriteAt;
    if (sinceNative < CURRENT_APP_HEARTBEAT_MS) {
      logCurrentApp('heartbeat_skip_native_active', {sinceNative});
      return;
    }
    // Accessibility is on. If we recovered from 'unavailable' but haven't seen a foreground
    // event yet, the pill stays on whatever the last known package was — fine, the next
    // window change will refresh it.
    if (
      lastPushedState &&
      lastPushedState !== 'unavailable' &&
      Date.now() - lastPushedAt >=
        (lastPushedPkg && isLauncher(lastPushedPkg) && lastPushedConfidence === 'low'
          ? LAUNCHER_HEARTBEAT_MS
          : CURRENT_APP_HEARTBEAT_MS)
    ) {
      if (
        lastPushedPkg &&
        isLauncher(lastPushedPkg) &&
        lastPushedConfidence === 'low' &&
        !hasRecentLauncherSignal(lastPushedPkg)
      ) {
        logCurrentApp('heartbeat_skip_low_conf_launcher', {
          packageName: lastPushedPkg,
          lastPushedAt,
        });
        return;
      }
      await writeCurrentApp(childUid, lastPushedPkg, lastPushedState, {
        confidence: lastPushedConfidence,
        source: 'accessibility',
        reason: 'heartbeat',
      });
    }
  };
  runCurrentAppHeartbeat().catch(e => console.warn('initial currentApp heartbeat', e));
  currentAppHeartbeatTicker = setInterval(() => {
    runCurrentAppHeartbeat().catch(e => console.warn('currentApp heartbeat', e));
  }, CURRENT_APP_HEARTBEAT_MS);

  // 7. Periodically tally screen-time and enforce the limit.
  screenTimeTicker = setInterval(async () => {
    // Don't tally the parent's screen time as if it were the child's — wait until they
    // start Child Mode.
    if (!isEnforcing()) {return;}
    try {
      if (!(await ScreenTime.hasUsageAccess())) {return;}
      const used = await ScreenTime.getTodayUsedMinutes();
      // Update only the used-today counter. The parent-written limit / resetAt fields are kept.
      await paths.child(childUid).update({
        'screenTime.usedTodayMins': used,
      });
      await ScreenTime.lockIfOverLimit();
    } catch {
      // transient — ignore
    }
  }, 60_000);

  // 8. Per-app usage breakdown for the parent's App Usage screen.
  //
  // Two phases:
  //   (a) On startup, push 7 days at once. UsageStatsManager keeps history independently of
  //       whether KidSafe was running, so this backfills any day the child app missed.
  //   (b) Every 10 minutes thereafter, push only today's doc. 10 minutes is a comfortable
  //       cadence: ~100 writes/day per child during waking hours (well within free tier),
  //       fresh enough that the parent's chart updates within "open the app, blink twice".
  //
  // For shared installs, both phases are gated on `isEnforcing()` — otherwise we'd upload
  // the parent's own daily app usage as if it were the child's.
  if (isEnforcing()) {
    pushPerAppUsage(childUid, 7).catch(e => console.warn('initial pushPerAppUsage', e));
  }
  perAppUsageTicker = setInterval(() => {
    if (!isEnforcing()) {return;}
    pushPerAppUsage(childUid, 1).catch(e => console.warn('pushPerAppUsage', e));
  }, PER_APP_USAGE_INTERVAL_MS);

  // 9. Push the initial native policy. In two-device mode this is a no-op (the apps
  //    subscriber already pushed); in shared mode it ensures native starts in the right
  //    state even before the first Firestore snapshot lands.
  await pushBlocklistToNative();
  await pushScheduleToNative();
}

export function stopChildSyncEngine() {
  // Best-effort: tell the parent's pill we're going dark before we cut the listeners so it
  // doesn't sit on a stale "Using YouTube" indefinitely. Fire-and-forget — the engine
  // teardown can't await async cleanup synchronously.
  //
  // We use the tracked `activeChildUid` here rather than `auth().currentUser?.uid` because
  // in shared mode the two are different — the engine writes for `${parentUid}_shared`
  // while the auth user is the parent themselves.
  const childUid = activeChildUid;
  if (childUid && lastPushedState !== 'screen_off') {
    writeCurrentApp(childUid, null, 'screen_off', {
      confidence: 'high',
      source: 'screen_state',
      reason: 'engine_stop',
    }).catch(() => {});
  }

  unsubs.forEach(u => u());
  unsubs.length = 0;
  if (locationSub) {
    locationSub.remove();
    locationSub = null;
  }
  if (geofenceSub) {
    geofenceSub.remove();
    geofenceSub = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  if (foregroundAppSub) {
    foregroundAppSub.remove();
    foregroundAppSub = null;
  }
  if (screenStateSub) {
    screenStateSub.remove();
    screenStateSub = null;
  }
  if (screenTimeTicker) {
    clearInterval(screenTimeTicker);
    screenTimeTicker = null;
  }
  if (perAppUsageTicker) {
    clearInterval(perAppUsageTicker);
    perAppUsageTicker = null;
  }
  if (currentAppHeartbeatTicker) {
    clearInterval(currentAppHeartbeatTicker);
    currentAppHeartbeatTicker = null;
  }
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
  pendingForegroundPkg = null;
  pendingForegroundTs = 0;
  lastPushedPkg = null;
  lastPushedState = null;
  lastPushedAt = 0;
  lastPushedConfidence = 'high';
  recentForegroundEvents = [];
  lastNonLauncherPkg = null;
  lastNonLauncherAt = 0;
  lastSeenNativeWriteAt = 0;
  lastReconcileAt = 0;
  engineMode = 'two_device';
  childModeActive = false;
  cachedBlocklist = [];
  cachedSchedule = undefined;
  activeChildUid = null;
  Location.stopWatching().catch(() => {});
}

// -- Reactive handlers --------------------------------------------------------

async function reactToChildDoc(childUid: string, doc: ChildDoc) {
  // Native foreground-service writer mirror tracking. When the doc snapshot reflects a write
  // produced by `CurrentAppWriter.kt` we remember the `updatedAt` timestamp so JS's coalesce
  // path can defer to native (which has a more reliable view on aggressive OEMs where the JS
  // engine sleeps). Only `'native_usage_stats'` is considered authoritative here — JS writes
  // come back through the same listener but with a different `source`.
  const cur = doc.currentApp;
  if (cur?.source === 'native_usage_stats' && typeof cur.updatedAt === 'number') {
    if (cur.updatedAt > lastSeenNativeWriteAt) {
      lastSeenNativeWriteAt = cur.updatedAt;
    }
  }

  // Remote lock
  if (doc.lockState?.locked) {
    try {
      await DeviceAdmin.lockNow();
    } catch (e) {
      console.warn('lockNow failed', e);
    }
  }

  // Screen-time limit — cache in native side so the alarm can enforce even while app is killed.
  if (doc.screenTime?.limitMins) {
    try {
      await ScreenTime.setDailyLimitMinutes(doc.screenTime.limitMins);
    } catch (e) {
      console.warn('setDailyLimitMinutes failed', e);
    }
  }

  // Geofence
  if (doc.geofence?.active) {
    try {
      await Geofence.setFence(doc.geofence.centerLat, doc.geofence.centerLng, doc.geofence.radiusM);
    } catch (e) {
      console.warn('setFence failed', e);
    }
  } else {
    try {
      await Geofence.clearFence();
    } catch {
      // ignore, probably wasn't set
    }
  }

  // Schedule (parent-defined "only-these-apps-allowed" time window).
  // We always cache the latest config so a Child Mode flip can re-push it without waiting
  // for another Firestore snapshot. `pushScheduleToNative` handles the shared-phone gating.
  cachedSchedule = doc.schedule;
  await pushScheduleToNative();

  // Shared phone: react to remote Child Mode toggles (parent flipping the kiosk from another
  // signed-in instance). When the flag changes, re-push the native policy so blocking +
  // tracking turn on / off in sync with the kiosk routing.
  if (engineMode === 'shared') {
    const remote = doc.childMode?.active === true;
    if (remote !== childModeActive) {
      childModeActive = remote;
      try {
        await ChildMode.setActive(remote, childUid);
      } catch (e) {
        console.warn('ChildMode.setActive (mirror from Firestore) failed', e);
      }
      // Re-fire native policy so blocklist + schedule snap to the new state.
      await pushBlocklistToNative();
      await pushScheduleToNative();
      if (!remote) {
        // Engine just lost enforcement — settle the pill on "screen_off" so the dashboard
        // doesn't keep showing the last foreground app for the next 60s.
        writeCurrentApp(childUid, null, 'screen_off', {
          confidence: 'high',
          source: 'screen_state',
          reason: 'child_mode_off',
        }).catch(() => {});
      }
    }
  }

  // Parent-issued PIN reset. One-shot: clear locally then delete the field so we don't loop.
  if (doc.pinResetRequest) {
    try {
      await Pin.clearPin();
    } catch (e) {
      console.warn('Pin.clearPin failed', e);
    }
    try {
      await paths.child(childUid).update({
        pinResetRequest: firebase.firestore.FieldValue.delete(),
      });
    } catch (e) {
      console.warn('clearing pinResetRequest failed', e);
    }
  }
}

// -- Sync helpers -------------------------------------------------------------

/**
 * Reconciles the installed-apps list against Firestore in a single atomic-per-chunk pass:
 *
 *   - Upserts current device's packages (preserving any parent-set `isBlocked` on existing
 *     docs — only newly created docs get the default `isBlocked: false`).
 *   - **Deletes** Firestore docs for packages that aren't on this device anymore. This is the
 *     piece that fixes the "merged list across phones" bug: when the same Firebase child
 *     account signs in on a new handset, the old phone's package list gets pruned in the
 *     same pass that adds the new phone's apps.
 *
 * After the writes commit we also:
 *   - Trim `schedule.allowedPackages` to drop packages that no longer exist (otherwise a
 *     stale allowlist entry never matches anything on the new device).
 *   - Write `{currentDeviceId, appsLastSyncedAt}` so the parent UI can render a clean
 *     "waiting for child to open KidSafe" empty state vs. a stale list.
 */
async function reconcileInstalledApps(childUid: string) {
  const [localApps, remoteSnap] = await Promise.all([
    InstalledApps.list(true),
    paths.apps(childUid).get(),
  ]);

  const localByPkg = new Map(localApps.map(a => [a.packageName, a]));
  const remoteDocs = remoteSnap.docs.map(d => ({
    id: d.id,
    data: d.data() as AppEntry,
  }));

  type Batch = ReturnType<ReturnType<typeof firestore>['batch']>;
  const ops: Array<(b: Batch) => void> = [];
  for (const a of localApps) {
    const existing = remoteDocs.find(r => r.id === a.packageName);
    ops.push(batch => {
      const payload: Record<string, unknown> = {
        appName: a.appName,
        icon: a.icon ?? null,
        installedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (!existing) {
        payload.isBlocked = false;
      }
      batch.set(paths.apps(childUid).doc(a.packageName), payload, {merge: true});
    });
  }

  const removed: string[] = [];
  for (const r of remoteDocs) {
    if (!localByPkg.has(r.id)) {
      removed.push(r.id);
      ops.push(batch => {
        batch.delete(paths.apps(childUid).doc(r.id));
      });
    }
  }

  for (let i = 0; i < ops.length; i += BATCH_CHUNK) {
    const batch = firestore().batch();
    for (const op of ops.slice(i, i + BATCH_CHUNK)) {
      op(batch);
    }
    await batch.commit();
  }

  if (removed.length > 0) {
    await pruneScheduleAllowlist(childUid, removed);
  }

  try {
    await setChildAppsSyncMeta(childUid, getOrCreateDeviceId());
  } catch (e) {
    console.warn('setChildAppsSyncMeta failed', e);
  }

  lastReconcileAt = Date.now();
  console.log(
    `[KidSafe] Reconciled apps: kept=${localApps.length} removed=${removed.length}`,
  );
}

/**
 * If the parent's schedule allowlist mentions packages that this device doesn't have, drop
 * them. Without this, an allowlist set on one phone keeps referencing apps that don't exist
 * on the new phone — confusing, but mostly harmless (matchless rules block nothing).
 */
async function pruneScheduleAllowlist(childUid: string, removed: string[]) {
  try {
    const snap = await paths.child(childUid).get();
    const data = snap.data() as ChildDoc | undefined;
    const sched = data?.schedule;
    if (!sched || !sched.allowedPackages?.length) {return;}
    if (!sched.allowedPackages.some(p => removed.includes(p))) {return;}
    const trimmed = sched.allowedPackages.filter(p => !removed.includes(p));
    await paths.child(childUid).set(
      {schedule: {...sched, allowedPackages: trimmed}},
      {merge: true},
    );
  } catch (e) {
    console.warn('pruneScheduleAllowlist failed', e);
  }
}

/**
 * Pushes the current cached blocklist to the native `AppBlocker` module. When the engine is
 * in shared mode and Child Mode is OFF we push an EMPTY list so the parent's normal phone
 * usage isn't blocked. Belt-and-braces: native already short-circuits via `isSharedDevice
 * && !isChildModeActive`, but pushing empty values guarantees no surprises if the flags ever
 * drift.
 */
async function pushBlocklistToNative() {
  const list = isEnforcing() ? cachedBlocklist : [];
  try {
    await AppBlocker.setBlockedPackages(list);
  } catch (e) {
    console.warn('pushBlocklistToNative failed', e);
  }
}

/**
 * Pushes the current cached schedule config to the native `Schedule` module. Same shared-mode
 * gating as `pushBlocklistToNative` — when Child Mode is off in shared mode, we push a
 * disabled schedule so the parent isn't restricted to an allowlist during their own usage.
 */
async function pushScheduleToNative() {
  const s = isEnforcing() ? cachedSchedule : undefined;
  try {
    if (s) {
      const daysMask = s.daysOfWeek.reduce((m, d) => m | (1 << d), 0);
      await Schedule.setSchedule(
        s.enabled,
        daysMask,
        s.startMinutes,
        s.endMinutes,
        s.allowedPackages,
      );
    } else {
      await Schedule.setSchedule(false, 0, 0, 0, []);
    }
  } catch (e) {
    console.warn('pushScheduleToNative failed', e);
  }
}

/**
 * Persists `ChildDoc.currentApp`. Centralised so every caller (foreground events, screen-off
 * transitions, accessibility-down poll, engine shutdown) flows through the same merge-write
 * path. Updates the module-level "last pushed" trackers on success so coalesce + heartbeat
 * stay consistent.
 */
async function writeCurrentApp(
  childUid: string,
  pkg: string | null,
  state: CurrentAppState,
  meta: ForegroundWriteMeta,
) {
  try {
    const now = Date.now();
    await paths.child(childUid).set(
      {
        currentApp: {
          packageName: pkg,
          state,
          updatedAt: now,
          confidence: meta.confidence,
          source: meta.source,
          reason: meta.reason,
          rawPackage: meta.rawPackage ?? null,
          lastNonLauncherPackage: lastNonLauncherPkg,
          lastNonLauncherAt: lastNonLauncherAt || null,
        },
      },
      {merge: true},
    );
    lastPushedPkg = pkg;
    lastPushedState = state;
    lastPushedAt = now;
    lastPushedConfidence = meta.confidence;
    logCurrentApp('write_current_app', {
      childUid,
      packageName: pkg,
      state,
      confidence: meta.confidence,
      source: meta.source,
      reason: meta.reason,
      rawPackage: meta.rawPackage ?? null,
      lastNonLauncherPkg,
      lastNonLauncherAt,
    });
  } catch (e) {
    console.warn('writeCurrentApp failed', e);
  }
}

/**
 * Stages a foreground push under the 3s coalesce window. If a write is already scheduled, the
 * latest package wins (kids that swipe-flick through 4 apps in 2s settle on the last one).
 * Same-package emits are dropped unless the heartbeat is due, so a kid parked on YouTube
 * generates one write per 30s instead of one per `TYPE_WINDOW_STATE_CHANGED`.
 */
function scheduleForegroundPush(childUid: string, pkg: string, ts: number) {
  pendingForegroundPkg = pkg;
  pendingForegroundTs = ts || Date.now();
  recentForegroundEvents.push({
    packageName: pkg,
    timestamp: ts || Date.now(),
    source: 'accessibility',
  });
  trimForegroundEventWindow();
  if (coalesceTimer) {return;}

  // Honour the coalesce floor relative to the previous push so back-to-back transitions can't
  // sneak two writes inside the 3s budget.
  const sinceLast = Date.now() - lastPushedAt;
  const delay = Math.max(0, CURRENT_APP_COALESCE_MS - sinceLast);

  coalesceTimer = setTimeout(() => {
    runForegroundCoalesce(childUid).catch(e =>
      console.warn('runForegroundCoalesce failed', e),
    );
  }, delay);
}

function trimForegroundEventWindow() {
  const cutoff = Date.now() - Math.max(NON_LAUNCHER_RECENCY_MS * 2, 20_000);
  recentForegroundEvents = recentForegroundEvents
    .filter(e => e.timestamp >= cutoff)
    .slice(-MAX_FOREGROUND_EVENTS);
}

function hasRecentLauncherSignal(pkg: string): boolean {
  const cutoff = Date.now() - NON_LAUNCHER_RECENCY_MS;
  return recentForegroundEvents.some(
    e => e.packageName === pkg && e.timestamp >= cutoff,
  );
}

async function runForegroundCoalesce(childUid: string) {
  coalesceTimer = null;
  const rawPkg = pendingForegroundPkg;
  const rawTs = pendingForegroundTs;
  pendingForegroundPkg = null;
  pendingForegroundTs = 0;
  if (rawPkg === null) {return;}

  const selected = await selectBestForegroundCandidate(rawPkg, rawTs);
  if (!selected) {return;}

  // Native-first: if `CurrentAppWriter.kt` just wrote for the same package, skip the JS write
  // entirely. The native writer is more authoritative (it polls UsageStats every 1.5s even
  // when the JS engine is suspended) and double writes flicker the parent pill between the
  // two sources. JS still owns the path when native hasn't written recently (parent dashboard
  // open in the same install, or the writer is gated off by `shouldWrite`).
  const sinceNative = Date.now() - lastSeenNativeWriteAt;
  if (
    sinceNative < NATIVE_WRITE_SUPPRESSION_MS &&
    selected.packageName === lastPushedPkg &&
    lastPushedState === 'foreground'
  ) {
    logCurrentApp('coalesce_skip_native_recent', {
      packageName: selected.packageName,
      sinceNative,
    });
    return;
  }

  const heartbeatDue = Date.now() - lastPushedAt >= CURRENT_APP_HEARTBEAT_MS;
  if (
    selected.packageName === lastPushedPkg &&
    lastPushedState === 'foreground' &&
    !heartbeatDue
  ) {
    logCurrentApp('coalesce_skip_duplicate', {
      packageName: selected.packageName,
      confidence: selected.confidence,
    });
    return;
  }
  await writeCurrentApp(childUid, selected.packageName, 'foreground', {
    confidence: selected.confidence,
    source: selected.source,
    reason: 'foreground_emit',
    rawPackage: rawPkg,
  });
}

async function selectBestForegroundCandidate(
  rawPkg: string,
  rawTs: number,
): Promise<{
  packageName: string;
  confidence: CurrentAppConfidence;
  source: CurrentAppSource;
}> {
  const now = Date.now();
  trimForegroundEventWindow();
  const latest = [...recentForegroundEvents].sort((a, b) => b.timestamp - a.timestamp)[0];
  if (!latest) {
    return {
      packageName: rawPkg,
      confidence: isLauncher(rawPkg) ? 'low' : 'high',
      source: 'accessibility',
    };
  }

  if (!isLauncher(latest.packageName)) {
    lastNonLauncherPkg = latest.packageName;
    lastNonLauncherAt = latest.timestamp;
    return {packageName: latest.packageName, confidence: 'high', source: latest.source};
  }

  const recentNonLauncher = [...recentForegroundEvents]
    .filter(e => !isLauncher(e.packageName))
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (recentNonLauncher && now - recentNonLauncher.timestamp <= NON_LAUNCHER_RECENCY_MS) {
    lastNonLauncherPkg = recentNonLauncher.packageName;
    lastNonLauncherAt = recentNonLauncher.timestamp;
    logCurrentApp('launcher_conflict_prefer_non_launcher', {
      launcherPkg: latest.packageName,
      nonLauncherPkg: recentNonLauncher.packageName,
      deltaMs: now - recentNonLauncher.timestamp,
      rawPkg,
      rawTs,
    });
    return {
      packageName: recentNonLauncher.packageName,
      confidence: 'high',
      source: recentNonLauncher.source,
    };
  }

  const usagePkg = await crossCheckRecentForegroundFromUsageStats();
  if (usagePkg && !isLauncher(usagePkg)) {
    lastNonLauncherPkg = usagePkg;
    lastNonLauncherAt = now;
    recentForegroundEvents.push({
      packageName: usagePkg,
      timestamp: now,
      source: 'usage_stats',
    });
    trimForegroundEventWindow();
    logCurrentApp('launcher_conflict_usage_override', {
      launcherPkg: latest.packageName,
      usagePkg,
      rawPkg,
    });
    return {packageName: usagePkg, confidence: 'high', source: 'usage_stats'};
  }

  logCurrentApp('launcher_kept_low_confidence', {
    packageName: latest.packageName,
    rawPkg,
  });
  return {packageName: latest.packageName, confidence: 'low', source: latest.source};
}

async function crossCheckRecentForegroundFromUsageStats(): Promise<string | null> {
  try {
    if (!(await ScreenTime.hasUsageAccess())) {return null;}
    const recent = await ScreenTime.getRecentForegroundApp(USAGE_CROSSCHECK_LOOKBACK_MS);
    const pkg = recent.packageName;
    if (!pkg || pkg === 'com.android.systemui' || pkg === 'android') {return null;}
    if (pkg === 'com.google.android.permissioncontroller') {return null;}
    if (pkg === 'com.android.permissioncontroller') {return null;}
    return pkg;
  } catch (e) {
    logCurrentApp('usage_crosscheck_failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Pulls the last `days` days of per-app foreground time from the native module and writes one
 * `usageDaily/{date}` doc per day. Used for both the startup backfill (`days=7`) and the
 * periodic ticker (`days=1`).
 *
 * Silently no-ops if Usage Access isn't granted — same pattern as the screen-time ticker.
 */
async function pushPerAppUsage(childUid: string, days: number) {
  if (!(await ScreenTime.hasUsageAccess())) {return;}
  const {days: data} = await ScreenTime.getPerAppUsage(days);
  // Each day write is idempotent (set+merge by date doc id), so we don't bother batching:
  // separate writes parallelise nicely and are tiny.
  await Promise.all(
    data.map(d => setUsageDaily(childUid, d.date, d.totalMins, d.perApp)),
  );
}

// -- Headless tasks (called from native receivers when the app is not running) ---

/**
 * Resolves the child uid to write data for from a headless context. In two-device mode
 * this is the signed-in Firebase uid (same as `activeChildUid` when the engine is alive).
 * In shared mode it's `${parentUid}_shared` — the parent's auth uid IS the writer, but the
 * doc id is the deterministic shared-profile id. We read the device-mode flag from native
 * since the JS engine may not have hydrated `useAuthStore` by the time a headless task
 * fires (PackageReceiver right after boot, geofence transition mid-night, etc.).
 */
async function resolveHeadlessChildUid(): Promise<string | null> {
  const parentUid = auth().currentUser?.uid;
  if (!parentUid) {
    return null;
  }
  try {
    const shared = await ChildMode.isSharedDevice();
    return shared ? `${parentUid}_shared` : parentUid;
  } catch {
    return parentUid;
  }
}

/**
 * Registered under "PackageSync" in `index.js`. Called by the native PackageReceiver
 * (BroadcastReceiver for PACKAGE_ADDED / PACKAGE_REMOVED) via a Headless JS task.
 *
 * `writeAppEntry` preserves any existing `isBlocked` on the doc, so a reinstall of a
 * previously-blocked app keeps the block in place rather than silently unblocking it.
 */
export async function handlePackageSyncTask(params: {
  type: 'added' | 'removed';
  packageName: string;
}) {
  const uid = await resolveHeadlessChildUid();
  if (!uid) {return;}
  if (params.type === 'removed') {
    await deleteAppEntry(uid, params.packageName);
    return;
  }
  const apps = await InstalledApps.list(true);
  const entry = apps.find(a => a.packageName === params.packageName);
  if (entry) {
    await writeAppEntry(uid, {
      packageName: entry.packageName,
      appName: entry.appName,
      icon: entry.icon,
      isBlocked: false,
    });
  }
}

/** Registered under "GeofenceTransition" in `index.js`. */
export async function handleGeofenceTransitionTask(params: {
  transition: 'enter' | 'exit' | 'dwell';
  lat: number;
  lng: number;
}) {
  const uid = await resolveHeadlessChildUid();
  if (!uid) {return;}
  await writeGeofenceEvent(uid, params.transition, params.lat, params.lng);
}
