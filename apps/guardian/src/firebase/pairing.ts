import firestore, {firebase} from '@react-native-firebase/firestore';

import {ENV} from '../config/env';

/**
 * Generates a random pairing code and saves it on the parent's user doc with a TTL.
 * The child enters this code during signup and the app looks it up to find the parent uid.
 */
export async function generatePairingCode(parentUid: string): Promise<string> {
  const code = randomDigits(ENV.PAIRING_CODE_LENGTH);
  const expires = Date.now() + ENV.PAIRING_CODE_TTL_MINS * 60_000;
  await firestore().collection('users').doc(parentUid).update({
    pairingCode: code,
    pairingCodeExpiresAt: expires,
  });
  return code;
}

/**
 * Looks up the parent uid for a given pairing code and links the child to them by setting
 * `users/{childUid}.parentUid = parentUid`. Throws on invalid / expired code.
 */
export async function linkChildToParent(childUid: string, code: string): Promise<string> {
  // P4.4 -- query by v2 `roles[]` (array-contains) instead of v1 `role` (==).
  // Phone-OTP parents created post-P4.4 only have `roles: ['parent']` and no
  // legacy `role` field, so the old v1-style query missed them and pairing
  // silently failed with "invalid code". v1 parents still match because the
  // P3 migration script back-filled `roles` on every legacy doc.
  const query = await firestore()
    .collection('users')
    .where('roles', 'array-contains', 'parent')
    .where('pairingCode', '==', code.trim())
    .limit(1)
    .get();

  if (query.empty) {
    throw new Error('Invalid code. Double-check and try again.');
  }
  const parent = query.docs[0];
  const parentData = parent.data() as {pairingCodeExpiresAt?: number};
  if (parentData.pairingCodeExpiresAt && parentData.pairingCodeExpiresAt < Date.now()) {
    throw new Error('This code has expired. Ask your parent to generate a new one.');
  }

  await firestore().collection('users').doc(childUid).update({
    parentUid: parent.id,
  });
  // Best-effort: try to burn the code so it can't be reused. Firestore rules
  // only let the parent update their own doc, so this will fail when the child
  // is signed in. The code's TTL (and the parent regenerating a new one)
  // already prevents long-lived reuse, so we swallow permission errors here
  // instead of failing the whole link operation.
  try {
    await parent.ref.update({
      pairingCode: firebase.firestore.FieldValue.delete(),
      pairingCodeExpiresAt: firebase.firestore.FieldValue.delete(),
    });
  } catch (e) {
    console.warn('Could not clear pairing code (expected for child session)', e);
  }
  return parent.id;
}

function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i += 1) {
    s += Math.floor(Math.random() * 10).toString();
  }
  return s;
}
