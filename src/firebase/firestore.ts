import firestore, {firebase} from '@react-native-firebase/firestore';

import type {
  AppEntry,
  ChildDoc,
  ChildModeState,
  Geofence,
  Geo,
  Schedule,
  SharedProfile,
  UsageDailyDoc,
  UserDoc,
} from './types';

/**
 * Paths helpers keep collection names in one place — change here, update nowhere else.
 */
export const paths = {
  users: () => firestore().collection('users'),
  user: (uid: string) => firestore().collection('users').doc(uid),
  child: (childUid: string) => firestore().collection('children').doc(childUid),
  apps: (childUid: string) =>
    firestore().collection('children').doc(childUid).collection('apps'),
  events: (childUid: string) =>
    firestore().collection('children').doc(childUid).collection('events'),
  usageDaily: (childUid: string) =>
    firestore().collection('children').doc(childUid).collection('usageDaily'),
};

/**
 * Format a `Date` as `YYYY-MM-DD` in the local timezone — matches the format the child writes
 * to `usageDaily/{date}` doc ids.
 */
export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// --- Parent-side helpers -----------------------------------------------------

export async function getLinkedChildren(parentUid: string): Promise<Array<UserDoc & {uid: string}>> {
  const query = await paths
    .users()
    .where('role', '==', 'child')
    .where('parentUid', '==', parentUid)
    .get();
  return query.docs.map(d => ({uid: d.id, ...(d.data() as UserDoc)}));
}

export function subscribeLinkedChildren(
  parentUid: string,
  cb: (children: Array<UserDoc & {uid: string}>) => void,
) {
  return paths
    .users()
    .where('role', '==', 'child')
    .where('parentUid', '==', parentUid)
    .onSnapshot(
      snap => {
        cb(snap.docs.map(d => ({uid: d.id, ...(d.data() as UserDoc)})));
      },
      err => console.warn('subscribeLinkedChildren error', err),
    );
}

export function subscribeChildDoc(
  childUid: string,
  cb: (doc: ChildDoc | null) => void,
) {
  return paths.child(childUid).onSnapshot(
    snap => cb(snap.exists ? (snap.data() as ChildDoc) : null),
    err => console.warn('subscribeChildDoc error', err),
  );
}

export function subscribeChildApps(
  childUid: string,
  cb: (apps: AppEntry[]) => void,
) {
  return paths
    .apps(childUid)
    .orderBy('appName')
    .onSnapshot(
      snap =>
        cb(
          snap.docs.map(d => ({
            ...(d.data() as AppEntry),
            packageName: d.id,
          })),
        ),
      err => console.warn('subscribeChildApps error', err),
    );
}

/**
 * Streams the most recent N days (default 7) of `usageDaily` docs for a child. Documents are
 * keyed by a `YYYY-MM-DD` date string in the child's local timezone, which is also stored as
 * the `date` field on the doc — we query and order by that field rather than `__name__` to
 * sidestep a `@react-native-firebase` quirk where `FieldPath.documentId()` returns a fresh
 * instance per call and the SDK's where/orderBy validator rejects the mismatched references.
 */
export function subscribeUsageWeek(
  childUid: string,
  cb: (days: UsageDailyDoc[]) => void,
  daysBack = 7,
) {
  const start = new Date();
  start.setDate(start.getDate() - (daysBack - 1));
  const startKey = formatDateKey(start);
  return paths
    .usageDaily(childUid)
    .where('date', '>=', startKey)
    .orderBy('date')
    .onSnapshot(
      snap => cb(snap.docs.map(d => d.data() as UsageDailyDoc)),
      err => console.warn('subscribeUsageWeek error', err),
    );
}

export async function setLock(childUid: string, locked: boolean, until?: number | null) {
  await paths.child(childUid).set(
    {
      lockState: {locked, until: until ?? null},
    },
    {merge: true},
  );
}

export async function setScreenTimeLimit(childUid: string, limitMins: number) {
  await paths.child(childUid).set(
    {
      screenTime: {
        limitMins,
        usedTodayMins: 0,
        resetAt: Date.now(),
      },
    },
    {merge: true},
  );
}

export async function setAppBlocked(
  childUid: string,
  packageName: string,
  blocked: boolean,
) {
  await paths.apps(childUid).doc(packageName).set(
    {isBlocked: blocked},
    {merge: true},
  );
}

export async function setGeofence(childUid: string, g: Geofence) {
  await paths.child(childUid).set({geofence: g}, {merge: true});
}

export async function setSchedule(childUid: string, s: Schedule) {
  await paths.child(childUid).set({schedule: s}, {merge: true});
}

/**
 * Shared-phone helpers --------------------------------------------------------
 *
 * In shared mode, the parent's own Firebase user owns the child profile at
 * `children/{parentUid}_shared`. The doc id is deterministic so the rules can validate
 * ownership via the `parentOwns(...)` helper without needing a separate users-collection
 * lookup. These helpers create the profile, mirror Child Mode state, and tear it down on
 * mode-switch.
 */

/** Deterministic shared-profile id for a given parent uid. */
export function sharedProfileChildUid(parentUid: string): string {
  return `${parentUid}_shared`;
}

/**
 * First-time setup for a shared-phone install. Creates the child profile doc and stamps the
 * parent's user doc with the shared-profile pointer. Idempotent — re-running on an existing
 * shared profile just updates the name and bumps `appsLastSyncedAt` heuristics.
 */
export async function createSharedChildProfile(
  parentUid: string,
  childName: string,
): Promise<SharedProfile> {
  const childUid = sharedProfileChildUid(parentUid);
  const createdAt = Date.now();
  const profile: SharedProfile = {childUid, childName, createdAt};

  // Create the child doc with mode + parentUid so `parentOwns(...)` is satisfied. Use
  // `set + merge` so a re-setup doesn't wipe schedule / blocklist / usage data the parent
  // may have configured already.
  await paths.child(childUid).set(
    {
      mode: 'shared',
      parentUid,
      status: 'online',
      lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
      lockState: {locked: false, until: null},
    },
    {merge: true},
  );

  await paths.user(parentUid).set(
    {
      deviceMode: 'shared',
      sharedProfile: profile,
    },
    {merge: true},
  );

  return profile;
}

/**
 * Flip the Child Mode flag on the shared profile. Two callers:
 *   - "Start Child Mode" CTA → `setChildModeActive(parentUid, true)`
 *   - "Exit Child Mode" PIN gate → `setChildModeActive(parentUid, false)`
 *
 * Pairs with the native `ChildMode.setActive(...)` call in the same code path so Firestore
 * and the native flag never diverge.
 */
export async function setChildModeActive(
  parentUid: string,
  active: boolean,
): Promise<void> {
  const childUid = sharedProfileChildUid(parentUid);
  const update: Partial<ChildDoc> = {
    childMode: active
      ? {
          active: true,
          startedAt: Date.now(),
          startedByParentUid: parentUid,
        } as ChildModeState
      : {
          active: false,
          // Keep startedAt + startedByParentUid for the post-session summary; the engine
          // doesn't care about them when active=false.
          startedAt: 0,
          startedByParentUid: parentUid,
        },
  };
  await paths.child(childUid).set(update, {merge: true});
}

/**
 * Tear down the shared profile on a mode switch back to two-device. Best-effort: we delete
 * the apps + usage subcollections first, then the child doc itself, then clear the pointer
 * on the parent's user doc.
 */
export async function deleteSharedChildProfile(parentUid: string): Promise<void> {
  const childUid = sharedProfileChildUid(parentUid);

  // Batched cleanup of subcollections. Firestore doesn't recursively delete docs from the
  // client SDK, so we enumerate and chunk-delete. 450 per batch matches the engine's chunk
  // size, which is the safe limit below Firestore's 500 hard cap.
  const subcollections = [paths.apps(childUid), paths.events(childUid), paths.usageDaily(childUid)];
  for (const coll of subcollections) {
    let snap = await coll.limit(450).get();
    while (!snap.empty) {
      const batch = firestore().batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      snap = await coll.limit(450).get();
    }
  }

  await paths.child(childUid).delete().catch(() => {
    // Doc may already be gone — non-fatal.
  });

  await paths.user(parentUid).set(
    {
      deviceMode: 'two_device',
      sharedProfile: firebase.firestore.FieldValue.delete(),
    },
    {merge: true},
  );
}

/**
 * Parent asks the child device to clear its on-device PIN. The child sync engine watches for
 * this field and calls `Pin.clearPin()` then deletes the field, so the request is one-shot.
 *
 * The child will be re-prompted for a new PIN on next foreground (the onboarding wizard's
 * pinSetupStep `check` returns false when no PIN is stored).
 */
export async function requestPinReset(childUid: string) {
  await paths.child(childUid).set(
    {
      pinResetRequest: {requestedAt: Date.now()},
    },
    {merge: true},
  );
}

// --- Child-side helpers ------------------------------------------------------

export async function writeChildStatus(
  childUid: string,
  status: 'online' | 'offline',
) {
  await paths.child(childUid).set(
    {
      status,
      lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
}

export async function writeLocation(childUid: string, loc: Geo) {
  await paths.child(childUid).set({currentLocation: loc}, {merge: true});
}

/**
 * Child-side: writes one day's screen-time breakdown. The `date` doubles as the document id so
 * a re-write for the same day is an idempotent merge — perfect for the 10-minute sync ticker.
 *
 * Empty `perApp` maps are valid (a day where the child only used KidSafe itself, for example).
 */
export async function setUsageDaily(
  childUid: string,
  date: string,
  totalMins: number,
  perApp: Record<string, number>,
) {
  await paths.usageDaily(childUid).doc(date).set(
    {
      date,
      totalMins,
      perApp,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
}

/**
 * Writes one app entry. `isBlocked` is only seeded on first create — for an existing doc we
 * preserve whatever value is already stored so a re-sync (PackageReceiver "added" delta or a
 * reconcile pass) does not clobber a parent-set block.
 */
export async function writeAppEntry(childUid: string, entry: AppEntry) {
  const {packageName, ...rest} = entry;
  const ref = paths.apps(childUid).doc(packageName);
  const existing = await ref.get();
  const payload: Record<string, unknown> = {
    ...rest,
    installedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (!existing.exists) {
    payload.isBlocked = rest.isBlocked ?? false;
  } else {
    delete payload.isBlocked;
  }
  await ref.set(payload, {merge: true});
}

export async function deleteAppEntry(childUid: string, packageName: string) {
  await paths.apps(childUid).doc(packageName).delete();
}

/**
 * Records that this device just finished a successful apps reconcile. The parent UI reads
 * `appsLastSyncedAt` to differentiate "no child device has opened KidSafe yet" from "the child
 * device synced and has zero installed apps".
 */
export async function setChildAppsSyncMeta(childUid: string, deviceId: string) {
  await paths.child(childUid).set(
    {
      currentDeviceId: deviceId,
      appsLastSyncedAt: Date.now(),
    },
    {merge: true},
  );
}

export async function writeGeofenceEvent(
  childUid: string,
  transition: 'enter' | 'exit' | 'dwell',
  lat: number,
  lng: number,
) {
  const timestamp = Date.now();
  await paths.child(childUid).set(
    {lastGeofenceEvent: {transition, lat, lng, timestamp}},
    {merge: true},
  );
  await paths.events(childUid).add({
    type: `geofence_${transition}`,
    payload: {lat, lng},
    timestamp,
  });
}
