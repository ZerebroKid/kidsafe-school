import firestore, {firebase} from '@react-native-firebase/firestore';

import type {
  AppEntry,
  ChildDoc,
  Geofence,
  Geo,
  Schedule,
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

export async function writeAppEntry(childUid: string, entry: AppEntry) {
  const {packageName, ...rest} = entry;
  await paths.apps(childUid).doc(packageName).set(
    {
      ...rest,
      isBlocked: rest.isBlocked ?? false,
      installedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
}

export async function deleteAppEntry(childUid: string, packageName: string) {
  await paths.apps(childUid).doc(packageName).delete();
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
