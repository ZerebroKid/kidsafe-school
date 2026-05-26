/**
 * P4.2.4 -- admin rotates a school's inviteCode.
 *
 * Generates a fresh 8-char code via the shared codes lib, verifies it does
 * not collide with any existing school's code, and atomically updates the
 * school doc.
 *
 * Pending principal claims survive a rotation. Approval works against the
 * `schools/{id}/principals/{principalId}` doc, NOT the inviteCode itself,
 * so an in-flight claim is unaffected. Only NEW claims (anyone who hasn't
 * called `claimSchool` yet) need the fresh code.
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller doesn't hold the 'admin' role
 *   - invalid-argument    -> schoolId missing
 *   - not-found           -> schoolId doesn't exist
 *   - internal            -> collision-retry exhausted (impossible in practice
 *                            with a 32^8 alphabet) or write failed
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';
import {generateInviteCode, withCodeCollisionRetry} from '../lib/codes';

interface Input {
  schoolId: string;
}

interface Output {
  inviteCode: string;
}

export const rotateInviteCode = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'admin');

    const {schoolId} = request.data ?? {};
    if (typeof schoolId !== 'string' || schoolId.length === 0) {
      throw new HttpsError('invalid-argument', 'schoolId is required.');
    }

    const ref = db().collection('schools').doc(schoolId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'School not found.');
    }

    const newCode = await withCodeCollisionRetry(
      db(),
      'schools',
      'inviteCode',
      generateInviteCode,
    );

    await ref.update({
      inviteCode: newCode,
      inviteCodeRotatedAt: FieldValue.serverTimestamp(),
    });

    return {inviteCode: newCode};
  },
);
