import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {normalizePhoneToE164} from '../lib/phone';
import {assertStaffPhoneAvailable, requirePrincipalOfSchool, requireSchoolId, syncTeacherOntoClasses} from '../lib/schoolWeb';

interface Input {
  schoolId: string;
  displayName: string;
  phone: string;
  classIds: string[];
}

export const addSchoolTeacher = onCall<Input, Promise<{teacherId: string}>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const schoolId = requireSchoolId(request.data?.schoolId);
    const displayName =
      typeof request.data?.displayName === 'string' ? request.data.displayName.trim() : '';
    const classIds = Array.isArray(request.data?.classIds)
      ? request.data.classIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (!displayName || classIds.length === 0) {
      throw new HttpsError('invalid-argument', 'Name and at least one class are required.');
    }
    const phone = normalizePhoneToE164(request.data?.phone ?? '');
    await requirePrincipalOfSchool(caller.uid, schoolId);
    await assertStaffPhoneAvailable(schoolId, phone, caller.phone, 'teacher');

    const schoolRef = db().collection('schools').doc(schoolId);
    const classSnaps = await Promise.all(
      classIds.map(id => schoolRef.collection('classes').doc(id).get()),
    );
    if (classSnaps.some(snap => !snap.exists)) {
      throw new HttpsError('not-found', 'One of the classes was not found.');
    }

    const existing = await schoolRef.collection('teachers').where('phone', '==', phone).limit(1).get();
    const teacherRef = existing.empty ? schoolRef.collection('teachers').doc() : existing.docs[0].ref;
    const current = existing.empty ? {} : existing.docs[0].data();
    const activeUid = typeof current.userId === 'string' ? current.userId : '';

    if (current.status === 'active' && activeUid) {
      const previous: string[] = Array.isArray(current.assignedClassIds)
        ? current.assignedClassIds.filter((id: unknown): id is string => typeof id === 'string')
        : [];
      const removed = previous.filter(id => !classIds.includes(id));
      await db().runTransaction(async tx => {
        await syncTeacherOntoClasses(tx, schoolId, classIds, activeUid, removed);
        tx.set(
          teacherRef,
          {
            displayName,
            phone,
            assignedClassIds: classIds,
            status: 'active',
            userId: activeUid,
          },
          {merge: true},
        );
      });
      return {teacherId: teacherRef.id};
    }

    await teacherRef.set(
      {
        displayName,
        phone,
        assignedClassIds: classIds,
        status: 'invited',
        userId: '',
        requestedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
    return {teacherId: teacherRef.id};
  },
);
