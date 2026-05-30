/**
 * Admin rejects a pending grade-change request.
 *
 * Updates the request doc with status='rejected' and the rejection reason.
 * Does NOT modify the school's activeGrades.
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller doesn't hold 'admin'
 *   - invalid-argument    -> missing fields or reason too short
 *   - not-found           -> school or request doc doesn't exist
 *   - failed-precondition -> request is not pending
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';

interface Input {
  schoolId: string;
  requestId: string;
  reason: string;
}

interface Output {
  ok: true;
}

export const rejectGradeChange = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'admin');

    const {schoolId, requestId, reason} = request.data ?? {};
    if (
      typeof schoolId !== 'string' || schoolId.length === 0 ||
      typeof requestId !== 'string' || requestId.length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'schoolId and requestId are required.',
      );
    }
    if (typeof reason !== 'string' || reason.trim().length < 3) {
      throw new HttpsError(
        'invalid-argument',
        'A rejection reason of at least 3 characters is required.',
      );
    }

    const schoolRef = db().collection('schools').doc(schoolId);
    const requestRef = schoolRef
      .collection('gradeChangeRequests')
      .doc(requestId);

    const reqSnap = await requestRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError('not-found', 'Grade change request not found.');
    }
    const reqData = reqSnap.data() ?? {};
    if (reqData.status !== 'pending') {
      throw new HttpsError(
        'failed-precondition',
        `Request is ${reqData.status}, not pending.`,
      );
    }

    await requestRef.update({
      status: 'rejected',
      rejectedReason: reason.trim(),
      reviewedByUid: caller.uid,
      reviewedAt: FieldValue.serverTimestamp(),
    });

    return {ok: true};
  },
);
