import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {requireSchoolId} from '../lib/schoolWeb';

interface Input {
  schoolId: string;
  leaveId: string;
}

export const cancelTeacherLeave = onCall<Input, Promise<{ok: true}>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const schoolId = requireSchoolId(request.data?.schoolId);
    const leaveId = typeof request.data?.leaveId === 'string' ? request.data.leaveId : '';
    if (!leaveId) throw new HttpsError('invalid-argument', 'Leave is required.');
    const ref = db().collection('schools').doc(schoolId).collection('leaves').doc(leaveId);

    await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'That leave request was not found.');
      if (snap.data()?.teacherUid !== caller.uid) {
        throw new HttpsError('permission-denied', 'You can cancel only your own leave.');
      }
      if (snap.data()?.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'Only a pending request can be cancelled.');
      }
      tx.set(ref, {status: 'cancelled', updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    });
    return {ok: true};
  },
);
