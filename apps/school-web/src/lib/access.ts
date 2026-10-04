'use client';

import {collectionGroup, getDocs, limit, query, where} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';

export type SchoolAccess =
  | {kind: 'principal'; schoolId: string}
  | {kind: 'teacher'; schoolId: string}
  | {kind: 'accountant'; schoolId: string}
  | {kind: 'none'};

export function destinationForAccess(access: SchoolAccess): string {
  if (access.kind === 'principal') return '/p/dashboard';
  if (access.kind === 'teacher') return '/t/home';
  if (access.kind === 'accountant') return '/a/fees';
  return '/no-access';
}

export async function resolveSchoolAccess(uid: string): Promise<SchoolAccess> {
  try {
    const claimed = await callFn<Record<string, never>, {schoolId: string | null; role?: 'teacher' | 'accountant' | null}>(
      'claimStaffSeat',
      {},
    );
    if (claimed.schoolId && claimed.role === 'accountant') return {kind: 'accountant', schoolId: claimed.schoolId};
    if (claimed.schoolId) return {kind: 'teacher', schoolId: claimed.schoolId};
  } catch {
    /* no invite */
  }

  const db = getFirestoreInstance();
  const teachers = await getDocs(
    query(
      collectionGroup(db, 'teachers'),
      where('userId', '==', uid),
      where('status', '==', 'active'),
      limit(1),
    ),
  );
  const teacherSchoolId = teachers.docs[0]?.ref.parent.parent?.id ?? null;
  if (teacherSchoolId) return {kind: 'teacher', schoolId: teacherSchoolId};

  const accountants = await getDocs(
    query(
      collectionGroup(db, 'accountants'),
      where('userId', '==', uid),
      where('status', '==', 'active'),
      limit(1),
    ),
  );
  const accountantSchoolId = accountants.docs[0]?.ref.parent.parent?.id ?? null;
  if (accountantSchoolId) return {kind: 'accountant', schoolId: accountantSchoolId};

  try {
    const boot = await callFn<Record<string, never>, {schoolId: string}>('bootstrapSchoolWeb', {});
    if (boot.schoolId) return {kind: 'principal', schoolId: boot.schoolId};
  } catch {
    return {kind: 'none'};
  }
  return {kind: 'none'};
}
