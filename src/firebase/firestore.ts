import firestore, {firebase} from '@react-native-firebase/firestore';

import type {AppEntry, ChildDoc, ContactEntry, Geofence, Geo, Schedule, UserDoc} from './types';

/**
 * Paths helpers keep collection names in one place — change here, update nowhere else.
 */
export const paths = {
  users: () => firestore().collection('users'),
  user: (uid: string) => firestore().collection('users').doc(uid),
  child: (childUid: string) => firestore().collection('children').doc(childUid),
  apps: (childUid: string) =>
    firestore().collection('children').doc(childUid).collection('apps'),
  contacts: (childUid: string) =>
    firestore().collection('children').doc(childUid).collection('contacts'),
  events: (childUid: string) =>
    firestore().collection('children').doc(childUid).collection('events'),
};

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

export function subscribeChildContacts(
  childUid: string,
  cb: (c: ContactEntry[]) => void,
) {
  return paths.contacts(childUid).onSnapshot(
    snap =>
      cb(
        snap.docs.map(d => ({
          ...(d.data() as ContactEntry),
          id: d.id,
        })),
      ),
    err => console.warn('subscribeChildContacts error', err),
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

export async function writeContact(childUid: string, c: ContactEntry) {
  await paths.contacts(childUid).doc(c.id).set(c);
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
