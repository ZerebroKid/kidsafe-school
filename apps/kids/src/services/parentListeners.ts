import {Alert} from 'react-native';

import {paths, subscribeLinkedChildren} from '../firebase/firestore';
import type {ChildDoc} from '@zerebro/shared-types';

/**
 * Parent-side listeners. Surfaces an in-app alert when any linked child exits their geofence.
 *
 * For push notifications while the parent app is backgrounded, wire Cloud Functions in v1.1 to
 * send an FCM message from a Firestore trigger. For MVP we only surface while the app is open.
 */

const unsubs: Array<() => void> = [];
const seenGeofenceTimestamps = new Map<string, number>();

export function startParentListeners(parentUid: string) {
  const unsubChildren = subscribeLinkedChildren(parentUid, children => {
    // Tear down old per-child subscriptions before recreating them with the fresh list
    unsubs.filter((_, i) => i > 0).forEach(u => u());
    unsubs.splice(1, unsubs.length - 1);

    children.forEach(child => {
      const sub = paths.child(child.uid).onSnapshot(snap => {
        if (!snap.exists) return;
        const data = snap.data() as ChildDoc;
        const evt = data.lastGeofenceEvent;
        if (!evt) return;
        const seen = seenGeofenceTimestamps.get(child.uid) ?? 0;
        if (evt.timestamp <= seen) return;
        seenGeofenceTimestamps.set(child.uid, evt.timestamp);
        if (evt.transition === 'exit') {
          Alert.alert(
            `${child.name} left the safe area`,
            `At ${evt.lat.toFixed(4)}, ${evt.lng.toFixed(4)}.`,
          );
        }
      });
      unsubs.push(sub);
    });
  });
  unsubs.unshift(unsubChildren);
}

export function stopParentListeners() {
  unsubs.forEach(u => u());
  unsubs.length = 0;
  seenGeofenceTimestamps.clear();
}
