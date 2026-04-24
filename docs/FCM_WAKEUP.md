# FCM wake-up (v1.1 addition)

## Why we don't need it on day 1

The child phone keeps a [`KidSafeForegroundService`](../android/app/src/main/java/com/kidsafe/services/KidSafeForegroundService.kt)
running which keeps the React Native JS thread alive, which keeps the Firestore listener alive,
which means parent commands arrive **in under a second** in practice. Android process management
will sometimes kill us on low-memory devices, but the `BootReceiver` / next app open restores the
listener promptly.

## Why you probably want it by v1.1

Cold-start worst case: child phone just rebooted + is under memory pressure + Doze is active.
Command can be delayed 5+ minutes. Fix: have a tiny server-side trigger send an **FCM data
message** which Android Doze does forward even in deep idle; our `setBackgroundMessageHandler`
in `index.js` then wakes the JS engine and re-reads Firestore.

## The simplest possible implementation

One Firebase Cloud Function (Node.js, ~20 LOC), triggered on `children/{id}` update:

```js
// functions/index.js
import {onDocumentUpdated} from 'firebase-functions/v2/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {getFirestore} from 'firebase-admin/firestore';
import {initializeApp} from 'firebase-admin/app';
initializeApp();

export const onChildChanged = onDocumentUpdated('children/{childUid}', async event => {
  const childUid = event.params.childUid;
  const userSnap = await getFirestore().collection('users').doc(childUid).get();
  const token = userSnap.data()?.fcmToken;
  if (!token) return;

  await getMessaging().send({
    token,
    data: {type: 'childDocChanged'},
    android: {priority: 'high'},
  });
});
```

Deploy:
```bash
firebase init functions   # select TypeScript or JS
firebase deploy --only functions
```

No logic change needed on the app — our listener already re-evaluates Firestore on every update.
The FCM message just nudges a sleeping app awake.

## Cost

At 1000 children with ~10 commands/day each = 10k Cloud Function invocations/day → ~$0.40/month.
Still cheaper than running a Node.js backend 24/7.
