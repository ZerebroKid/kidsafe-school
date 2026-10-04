import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {normalizePhoneToE164} from '../lib/phone';
import {requirePrincipalOfSchool, requireSchoolId} from '../lib/schoolWeb';

interface Input {
  schoolId: string;
  studentId?: string;
  classId: string;
  name: string;
  rollNo: string;
  parentName: string;
  parentPhone: string;
}

interface Output {
  studentId: string;
}

export const upsertStudent = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const data = request.data ?? ({} as Input);
    const schoolId = requireSchoolId(data.schoolId);
    const classId = typeof data.classId === 'string' ? data.classId : '';
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const rollNo = typeof data.rollNo === 'string' ? data.rollNo.trim() : '';
    const parentName = typeof data.parentName === 'string' ? data.parentName.trim() : '';
    const parentPhoneRaw = typeof data.parentPhone === 'string' ? data.parentPhone.trim() : '';
    if (!classId || !name) {
      throw new HttpsError('invalid-argument', 'Class and student name are required.');
    }
    await requirePrincipalOfSchool(caller.uid, schoolId);

    const schoolRef = db().collection('schools').doc(schoolId);
    const classSnap = await schoolRef.collection('classes').doc(classId).get();
    if (!classSnap.exists) throw new HttpsError('not-found', 'Class not found.');
    const teacherIds: string[] = Array.isArray(classSnap.data()?.teacherIds)
      ? classSnap.data()?.teacherIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    const parentPhone = parentPhoneRaw ? normalizePhoneToE164(parentPhoneRaw) : '';
    const studentRef = data.studentId
      ? schoolRef.collection('students').doc(data.studentId)
      : schoolRef.collection('students').doc();

    if (data.studentId) {
      const existing = await studentRef.get();
      if (!existing.exists) throw new HttpsError('not-found', 'Student not found.');
    }

    await studentRef.set(
      {
        name,
        rollNo,
        classId,
        parentName,
        parentPhone,
        readerIds: teacherIds,
        status: 'active',
        ...(data.studentId ? {} : {createdAt: FieldValue.serverTimestamp()}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    return {studentId: studentRef.id};
  },
);
