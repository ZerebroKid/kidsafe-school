/**
 * P4.2.6 -- admin rejects a pending principal claim.
 *
 * Sets status='rejected' and records the reason. Does NOT touch
 * `users/{uid}.roles[]` -- a rejected claimant still has roles=[] and the
 * Campus dashboard guard will send them back to /onboarding so they can
 * re-claim with a fresh code if the admin asks them to.
 *
 * `approvedByUid` + `approvedAt` are reused for the decision-time audit on
 * reject too (the spec uses one timestamp field for "decision made", not
 * separate accepted/rejected fields).
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller doesn't hold 'admin'
 *   - invalid-argument    -> schoolId, principalId, or reason missing/empty
 *   - not-found           -> principal doc doesn't exist
 *   - failed-precondition -> principal claim is not pending
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';

interface Input {
  schoolId: string;
  principalId: string;
  reason: string;
}

interface Output {
  ok: true;
}

export const rejectPrincipal = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'admin');

    const {schoolId, principalId, reason} = request.data ?? {};
    if (
      typeof schoolId !== 'string' ||
      schoolId.length === 0 ||
      typeof principalId !== 'string' ||
      principalId.length === 0 ||
      typeof reason !== 'string' ||
      reason.trim().length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'schoolId, principalId, and reason are required.',
      );
    }

    const principalRef = db()
      .collection('schools')
      .doc(schoolId)
      .collection('principals')
      .doc(principalId);

    await db().runTransaction(async tx => {
      const snap = await tx.get(principalRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'Principal claim not found.');
      }
      const data = snap.data() ?? {};
      if (data.status !== 'pending') {
        throw new HttpsError(
          'failed-precondition',
          `Principal claim is ${data.status}, not pending.`,
        );
      }
      tx.update(principalRef, {
        status: 'rejected',
        rejectedReason: reason.trim(),
        approvedByUid: caller.uid,
        approvedAt: FieldValue.serverTimestamp(),
      });
    });

    return {ok: true};
  },
);
