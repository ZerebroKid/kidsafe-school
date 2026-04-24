import firestore from '@react-native-firebase/firestore';

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
  const query = await firestore()
    .collection('users')
    .where('role', '==', 'parent')
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
  // Burn the code once used so a child can't be linked twice with the same code
  await parent.ref.update({
    pairingCode: firestore.FieldValue.delete(),
    pairingCodeExpiresAt: firestore.FieldValue.delete(),
  });
  return parent.id;
}

function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i += 1) {
    s += Math.floor(Math.random() * 10).toString();
  }
  return s;
}
