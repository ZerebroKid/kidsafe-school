import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Contacts from 'react-native-contacts';
import {PermissionsAndroid} from 'react-native';

import {
  deleteAppEntry,
  paths,
  writeAppEntry,
  writeChildStatus,
  writeContact,
  writeGeofenceEvent,
  writeLocation,
} from '../firebase/firestore';
import {
  AppBlocker,
  DeviceAdmin,
  Geofence,
  InstalledApps,
  Location,
  ScreenTime,
} from '../modules/native';
import type {AppEntry, ChildDoc} from '../firebase/types';
import {ENV} from '../config/env';

/**
 * Wires the child side together:
 *   - Pushes local state (apps, contacts, location) up to Firestore.
 *   - Listens to the child's Firestore doc and reacts to parent-issued commands:
 *       lock, geofence, screenTime, blocked apps.
 *
 * This runs as long as the user is signed in and has role=child.
 */

const unsubs: Array<() => void> = [];
let locationSub: {remove: () => void} | null = null;
let geofenceSub: {remove: () => void} | null = null;
let lastLocationWriteAt = 0;
let screenTimeTicker: ReturnType<typeof setInterval> | null = null;

export async function startChildSyncEngine(childUid: string) {
  await writeChildStatus(childUid, 'online');

  // 1. Subscribe to the child doc so parent commands flow in.
  const docUnsub = paths.child(childUid).onSnapshot(async snap => {
    if (!snap.exists) return;
    const data = snap.data() as ChildDoc;
    await reactToChildDoc(data);
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

  // 3. Sync installed apps (one-off, then rely on PackageReceiver for deltas).
  syncInstalledApps(childUid).catch(e => console.warn('syncInstalledApps', e));

  // 4. Sync contacts (one-off).
  syncContacts(childUid).catch(e => console.warn('syncContacts', e));

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
  if (screenTimeTicker) {
    clearInterval(screenTimeTicker);
    screenTimeTicker = null;
  }
  Location.stopWatching().catch(() => {});
}

// -- Reactive handlers --------------------------------------------------------

async function reactToChildDoc(doc: ChildDoc) {
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
}

// -- Sync helpers -------------------------------------------------------------

async function syncInstalledApps(childUid: string) {
  const apps = await InstalledApps.list(true);
  const batch = firestore().batch();
  for (const a of apps) {
    const ref = paths.apps(childUid).doc(a.packageName);
    batch.set(
      ref,
      {
        appName: a.appName,
        icon: a.icon ?? null,
        isBlocked: false,
        installedAt: firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
  }
  await batch.commit();
}

async function syncContacts(childUid: string) {
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
  );
  if (!granted) return;
  const all = await Contacts.getAll();
  for (const c of all.slice(0, 500)) {
    const phone = c.phoneNumbers[0]?.number;
    if (!phone) continue;
    await writeContact(childUid, {
      id: c.recordID,
      name: `${c.givenName || ''} ${c.familyName || ''}`.trim() || phone,
      phone,
    });
  }
}

// -- Headless tasks (called from native receivers when the app is not running) ---

/** Registered under "PackageSync" in `index.js`. */
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
