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
  DeviceAdmin,
  Geofence,
  InstalledApps,
  Location,
  Pin,
  Schedule,
  ScreenTime,
} from '../modules/native';
import type {AppEntry, ChildDoc} from '../firebase/types';
import {ENV} from '../config/env';
import {getOrCreateDeviceId} from './deviceId';

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
let lastLocationWriteAt = 0;
let lastReconcileAt = 0;
let screenTimeTicker: ReturnType<typeof setInterval> | null = null;
let perAppUsageTicker: ReturnType<typeof setInterval> | null = null;

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

export async function startChildSyncEngine(childUid: string) {
  await writeChildStatus(childUid, 'online');

  // 1. Subscribe to the child doc so parent commands flow in.
  const docUnsub = paths.child(childUid).onSnapshot(async snap => {
    if (!snap.exists) return;
    const data = snap.data() as ChildDoc;
    await reactToChildDoc(childUid, data);
  });
  unsubs.push(docUnsub);

  // 2. Subscribe to blocked apps so the AccessibilityService has the latest list.
  const appsUnsub = paths.apps(childUid).onSnapshot(async snap => {
    const blocked = snap.docs
      .filter(d => (d.data() as AppEntry).isBlocked)
      .map(d => d.id);
    console.log(`[KidSafe] Received blocklist update (${blocked.length}):`, blocked);
    try {
      await AppBlocker.setBlockedPackages(blocked);
    } catch (e) {
      console.warn('setBlockedPackages failed', e);
    }
  });
  unsubs.push(appsUnsub);

  // 3. Reconcile installed apps. Unlike a plain "write current device's apps and call it a
  //    day" pass, this also deletes Firestore docs for packages absent on this device — so a
  //    device switch (same Firebase account, different phone) doesn't leave the parent staring
  //    at a merged list. Failures are logged but not fatal; we retry on every foreground.
  reconcileInstalledApps(childUid).catch(e => console.warn('reconcileInstalledApps', e));

  // 4. Re-run the reconcile when the app returns to foreground after a quiet stretch.
  appStateSub = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status !== 'active') return;
    if (Date.now() - lastReconcileAt < RECONCILE_REFRESH_MS) return;
    reconcileInstalledApps(childUid).catch(e => console.warn('reconcile on foreground', e));
  });

  // 5. Start watching location if allowed.
  try {
    if (await Location.hasLocationPermission()) {
      await Location.startWatching();
      locationSub = Location.subscribe(async loc => {
        const now = Date.now();
        if (now - lastLocationWriteAt < ENV.LOCATION_MIN_INTERVAL_MS) return;
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

  // 7. Periodically tally screen-time and enforce the limit.
  screenTimeTicker = setInterval(async () => {
    try {
      if (!(await ScreenTime.hasUsageAccess())) return;
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
  pushPerAppUsage(childUid, 7).catch(e => console.warn('initial pushPerAppUsage', e));
  perAppUsageTicker = setInterval(() => {
    pushPerAppUsage(childUid, 1).catch(e => console.warn('pushPerAppUsage', e));
  }, PER_APP_USAGE_INTERVAL_MS);
}

export function stopChildSyncEngine() {
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
  if (screenTimeTicker) {
    clearInterval(screenTimeTicker);
    screenTimeTicker = null;
  }
  if (perAppUsageTicker) {
    clearInterval(perAppUsageTicker);
    perAppUsageTicker = null;
  }
  lastReconcileAt = 0;
  Location.stopWatching().catch(() => {});
}

// -- Reactive handlers --------------------------------------------------------

async function reactToChildDoc(childUid: string, doc: ChildDoc) {
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
  // We always push the latest config — if doc.schedule is missing, treat as disabled.
  try {
    const s = doc.schedule;
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
    console.warn('Schedule.setSchedule failed', e);
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
    if (!sched || !sched.allowedPackages?.length) return;
    if (!sched.allowedPackages.some(p => removed.includes(p))) return;
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
 * Pulls the last `days` days of per-app foreground time from the native module and writes one
 * `usageDaily/{date}` doc per day. Used for both the startup backfill (`days=7`) and the
 * periodic ticker (`days=1`).
 *
 * Silently no-ops if Usage Access isn't granted — same pattern as the screen-time ticker.
 */
async function pushPerAppUsage(childUid: string, days: number) {
  if (!(await ScreenTime.hasUsageAccess())) return;
  const {days: data} = await ScreenTime.getPerAppUsage(days);
  // Each day write is idempotent (set+merge by date doc id), so we don't bother batching:
  // separate writes parallelise nicely and are tiny.
  await Promise.all(
    data.map(d => setUsageDaily(childUid, d.date, d.totalMins, d.perApp)),
  );
}

// -- Headless tasks (called from native receivers when the app is not running) ---

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
  const uid = auth().currentUser?.uid;
  if (!uid) return;
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
  const uid = auth().currentUser?.uid;
  if (!uid) return;
  await writeGeofenceEvent(uid, params.transition, params.lat, params.lng);
}
