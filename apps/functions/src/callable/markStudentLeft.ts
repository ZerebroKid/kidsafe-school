import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {requirePrincipalOfSchool, requireSchoolId} from '../lib/schoolWeb';

interface Input {
  schoolId: string;
  studentId: string;
}

export const markStudentLeft = onCall<Input, Promise<{ok: true}>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const schoolId = requireSchoolId(request.data?.schoolId);
    const studentId = request.data?.studentId;
    if (typeof studentId !== 'string' || studentId.length === 0) {
      throw new HttpsError('invalid-argument', 'studentId is required.');
    }
    await requirePrincipalOfSchool(caller.uid, schoolId);
    const ref = db().collection('schools').doc(schoolId).collection('students').doc(studentId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Student not found.');
    await ref.set(
      {status: 'left', leftAt: FieldValue.serverTimestamp()},
      {merge: true},
    );
    return {ok: true};
  },
);
