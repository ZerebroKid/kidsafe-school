import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {requirePrincipalOfSchool, requireSchoolId} from '../lib/schoolWeb';

interface Input {
  schoolId: string;
  leaveId: string;
  decision: 'approved' | 'rejected';
}

export const decideTeacherLeave = onCall<Input, Promise<{ok: true}>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const schoolId = requireSchoolId(request.data?.schoolId);
    const leaveId = typeof request.data?.leaveId === 'string' ? request.data.leaveId : '';
    const decision = request.data?.decision;
    if (!leaveId || (decision !== 'approved' && decision !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'Choose approve or reject.');
    }
    await requirePrincipalOfSchool(caller.uid, schoolId);
    const ref = db().collection('schools').doc(schoolId).collection('leaves').doc(leaveId);

    await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'That leave request was not found.');
      if (snap.data()?.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'That request is no longer pending.');
      }
      tx.set(ref, {
        status: decision,
        decidedBy: caller.uid,
        decidedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    });
    return {ok: true};
  },
);
