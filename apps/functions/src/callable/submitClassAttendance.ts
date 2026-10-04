import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {requireSchoolId, requireYmd, todayYmd} from '../lib/schoolWeb';

interface Input {
  schoolId: string;
  classId: string;
  date: string;
  marks: Record<string, 'P' | 'A'>;
}

export const submitClassAttendance = onCall<Input, Promise<{ok: true}>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const schoolId = requireSchoolId(request.data?.schoolId);
    const classId = typeof request.data?.classId === 'string' ? request.data.classId : '';
    const date = requireYmd(request.data?.date);
    const marks = request.data?.marks;
    if (!classId || !marks || typeof marks !== 'object') {
      throw new HttpsError('invalid-argument', 'classId and marks are required.');
    }

    const schoolRef = db().collection('schools').doc(schoolId);
    const [schoolSnap, classSnap, userSnap, studentsSnap] = await Promise.all([
      schoolRef.get(),
      schoolRef.collection('classes').doc(classId).get(),
      db().collection('users').doc(caller.uid).get(),
      schoolRef.collection('students').where('classId', '==', classId).where('status', '==', 'active').get(),
    ]);
    if (!schoolSnap.exists || !classSnap.exists) {
      throw new HttpsError('not-found', 'Class not found.');
    }

    const roles: unknown = userSnap.data()?.roles;
    const roleList = Array.isArray(roles) ? roles : [];
    const isPrincipal =
      roleList.includes('principal') && schoolSnap.data()?.principalUid === caller.uid;
    const teacherIds: unknown = classSnap.data()?.teacherIds;
    const isTeacher =
      roleList.includes('teacher') &&
      Array.isArray(teacherIds) &&
      teacherIds.includes(caller.uid);
    if (!isPrincipal && !isTeacher) {
      throw new HttpsError('permission-denied', 'You cannot mark this class.');
    }
    if (!isPrincipal && date !== todayYmd()) {
      throw new HttpsError('failed-precondition', 'Teachers can mark attendance for today only.');
    }

    const expected = new Set(studentsSnap.docs.map(doc => doc.id));
    const given = Object.keys(marks);
    if (given.length !== expected.size || given.some(id => !expected.has(id))) {
      throw new HttpsError('invalid-argument', 'Mark every active student Present or Absent.');
    }
    for (const value of Object.values(marks)) {
      if (value !== 'P' && value !== 'A') {
        throw new HttpsError('invalid-argument', 'Each mark must be P or A.');
      }
    }

    await schoolRef.collection('attendance').doc(`${classId}_${date}`).set({
      classId,
      date,
      marks,
      submittedBy: caller.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {ok: true};
  },
);
