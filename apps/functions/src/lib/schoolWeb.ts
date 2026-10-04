import {HttpsError} from 'firebase-functions/v2/https';
import type {DocumentData, DocumentReference, Transaction} from 'firebase-admin/firestore';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from './admin';
import {todayYmdInTz} from './schoolTime';

export function requireSchoolId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpsError('invalid-argument', 'schoolId is required.');
  }
  return value;
}

export function requireYmd(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'date must be YYYY-MM-DD.');
  }
  return value;
}

export async function requirePrincipalOfSchool(
  uid: string,
  schoolId: string,
): Promise<void> {
  const [userSnap, schoolSnap] = await Promise.all([
    db().collection('users').doc(uid).get(),
    db().collection('schools').doc(schoolId).get(),
  ]);
  const roles: unknown = userSnap.data()?.roles;
  const isPrincipal =
    Array.isArray(roles) && roles.some(role => role === 'principal');
  if (!schoolSnap.exists || schoolSnap.data()?.principalUid !== uid || !isPrincipal) {
    throw new HttpsError('permission-denied', 'Only this school’s principal can do that.');
  }
}

/** Set primaryRole only when it is missing or not already one of the held roles. */
export function rolePatch(userData: DocumentData | undefined, role: string) {
  const existingRoles: string[] = Array.isArray(userData?.roles)
    ? userData.roles.filter((item: unknown): item is string => typeof item === 'string')
    : [];
  const primaryNeedsFix =
    typeof userData?.primaryRole !== 'string' ||
    userData.primaryRole.length === 0 ||
    !existingRoles.includes(userData.primaryRole);
  const patch: Record<string, unknown> = {roles: FieldValue.arrayUnion(role)};
  if (primaryNeedsFix) patch.primaryRole = role;
  return patch;
}

export async function syncTeacherOntoClasses(
  tx: Transaction,
  schoolId: string,
  classIds: string[],
  teacherUid: string,
  removeClassIds: string[] = [],
): Promise<void> {
  const schoolRef = db().collection('schools').doc(schoolId);
  const addRefs = classIds.map(id => schoolRef.collection('classes').doc(id));
  const removeRefs = removeClassIds.map(id => schoolRef.collection('classes').doc(id));
  const addSnaps = await Promise.all(addRefs.map(ref => tx.get(ref)));
  const removeSnaps = await Promise.all(removeRefs.map(ref => tx.get(ref)));
  const addStudents = await Promise.all(
    classIds.map(classId =>
      tx.get(schoolRef.collection('students').where('classId', '==', classId)),
    ),
  );
  const removeStudents = await Promise.all(
    removeClassIds.map(classId =>
      tx.get(schoolRef.collection('students').where('classId', '==', classId)),
    ),
  );

  addSnaps.forEach((snap, index) => {
    if (!snap.exists) {
      throw new HttpsError('not-found', 'One of the classes no longer exists.');
    }
    tx.set(addRefs[index] as DocumentReference, {teacherIds: FieldValue.arrayUnion(teacherUid)}, {merge: true});
  });
  addStudents.forEach(snap => {
    snap.docs.forEach(student => {
      tx.set(student.ref, {readerIds: FieldValue.arrayUnion(teacherUid)}, {merge: true});
    });
  });
  removeSnaps.forEach((snap, index) => {
    if (!snap.exists) return;
    tx.set(removeRefs[index] as DocumentReference, {teacherIds: FieldValue.arrayRemove(teacherUid)}, {merge: true});
  });
  removeStudents.forEach(snap => {
    snap.docs.forEach(student => {
      tx.set(student.ref, {readerIds: FieldValue.arrayRemove(teacherUid)}, {merge: true});
    });
  });
}

export function todayYmd(): string {
  return todayYmdInTz();
}

/** One phone is the principal, a teacher, or an accountant. Not more than one. */
export async function assertStaffPhoneAvailable(
  schoolId: string,
  phone: string,
  callerPhone: string | null,
  role: 'teacher' | 'accountant',
): Promise<void> {
  if (callerPhone === phone) {
    throw new HttpsError(
      'failed-precondition',
      'Use a different phone. This number signs in as the principal.',
    );
  }
  const schoolRef = db().collection('schools').doc(schoolId);
  const school = await schoolRef.get();
  const principalUid = school.data()?.principalUid;
  if (typeof principalUid === 'string' && principalUid.length > 0) {
    const principal = await db().collection('users').doc(principalUid).get();
    if (principal.data()?.phone === phone) {
      throw new HttpsError(
        'failed-precondition',
        'Use a different phone. This number signs in as the principal.',
      );
    }
  }
  const other = role === 'teacher' ? 'accountants' : 'teachers';
  const taken = await schoolRef.collection(other).where('phone', '==', phone).limit(1).get();
  if (!taken.empty) {
    throw new HttpsError(
      'failed-precondition',
      role === 'teacher'
        ? 'That phone is already an accountant.'
        : 'That phone is already a teacher.',
    );
  }
}

export async function requireAccountantOfSchool(uid: string, schoolId: string): Promise<void> {
  const snap = await db().collection('schools').doc(schoolId).collection('accountants').doc(uid).get();
  const data = snap.data();
  if (!snap.exists || data?.status !== 'active' || data?.userId !== uid) {
    throw new HttpsError('permission-denied', 'Only this school’s accountant can do that.');
  }
}

export async function requireActiveTeacher(
  uid: string,
  schoolId: string,
): Promise<{displayName: string}> {
  const snap = await db().collection('schools').doc(schoolId).collection('teachers').doc(uid).get();
  const data = snap.data();
  if (!snap.exists || data?.status !== 'active' || data?.userId !== uid) {
    throw new HttpsError('permission-denied', 'Only a teacher of this school can do that.');
  }
  const displayName = typeof data?.displayName === 'string' && data.displayName.length > 0
    ? data.displayName
    : 'Teacher';
  return {displayName};
}
