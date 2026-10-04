import {onCall} from 'firebase-functions/v2/https';
import {FieldValue, type DocumentReference, type QueryDocumentSnapshot} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, type AuthedCaller} from '../lib/auth';
import {rolePatch, syncTeacherOntoClasses} from '../lib/schoolWeb';

interface Output {
  schoolId: string | null;
  role: 'teacher' | 'accountant' | null;
}

async function claimTeacher(caller: AuthedCaller, inviteDoc: QueryDocumentSnapshot): Promise<string | null> {
  const schoolRef = inviteDoc.ref.parent.parent;
  if (!schoolRef || !caller.phone) return null;
  const classIds: string[] = Array.isArray(inviteDoc.data().assignedClassIds)
    ? inviteDoc.data().assignedClassIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const displayName =
    typeof inviteDoc.data().displayName === 'string' ? inviteDoc.data().displayName : 'Teacher';
  const teacherRef = schoolRef.collection('teachers').doc(caller.uid);
  const userRef = db().collection('users').doc(caller.uid);

  await db().runTransaction(async tx => {
    const [inviteSnap, userSnap] = await Promise.all([
      tx.get(inviteDoc.ref),
      tx.get(userRef),
    ]);
    if (!inviteSnap.exists || inviteSnap.data()?.status !== 'invited') return;
    await syncTeacherOntoClasses(tx, schoolRef.id, classIds, caller.uid);
    tx.set(teacherRef, {
      userId: caller.uid,
      phone: caller.phone,
      displayName,
      status: 'active',
      assignedClassIds: classIds,
      requestedAt: inviteSnap.data()?.requestedAt ?? FieldValue.serverTimestamp(),
      approvedAt: FieldValue.serverTimestamp(),
    });
    if (inviteDoc.ref.path !== teacherRef.path) tx.delete(inviteDoc.ref);
    tx.set(userRef, rolePatch(userSnap.data(), 'teacher'), {merge: true});
  });
  return schoolRef.id;
}

async function claimAccountant(caller: AuthedCaller, inviteDoc: QueryDocumentSnapshot): Promise<string | null> {
  const schoolRef = inviteDoc.ref.parent.parent;
  if (!schoolRef || !caller.phone) return null;
  const displayName =
    typeof inviteDoc.data().displayName === 'string' ? inviteDoc.data().displayName : 'Accountant';
  const accountantRef = schoolRef.collection('accountants').doc(caller.uid);
  const userRef = db().collection('users').doc(caller.uid);

  await db().runTransaction(async tx => {
    const [inviteSnap, userSnap] = await Promise.all([
      tx.get(inviteDoc.ref),
      tx.get(userRef),
    ]);
    if (!inviteSnap.exists || inviteSnap.data()?.status !== 'invited') return;
    tx.set(accountantRef as DocumentReference, {
      userId: caller.uid,
      phone: caller.phone,
      displayName,
      status: 'active',
      requestedAt: inviteSnap.data()?.requestedAt ?? FieldValue.serverTimestamp(),
      approvedAt: FieldValue.serverTimestamp(),
    });
    if (inviteDoc.ref.path !== accountantRef.path) tx.delete(inviteDoc.ref);
    tx.set(userRef, rolePatch(userSnap.data(), 'accountant'), {merge: true});
  });
  return schoolRef.id;
}

export const claimStaffSeat = onCall<unknown, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    if (!caller.phone) return {schoolId: null, role: null};

    const owned = await db()
      .collection('schools')
      .where('principalUid', '==', caller.uid)
      .where('app', '==', 'school-web')
      .limit(1)
      .get();
    if (!owned.empty) return {schoolId: null, role: null};

    const teachers = await db()
      .collectionGroup('teachers')
      .where('phone', '==', caller.phone)
      .where('status', '==', 'invited')
      .limit(1)
      .get();
    if (!teachers.empty) {
      const schoolId = await claimTeacher(caller, teachers.docs[0]);
      return {schoolId, role: schoolId ? 'teacher' : null};
    }

    const accountants = await db()
      .collectionGroup('accountants')
      .where('phone', '==', caller.phone)
      .where('status', '==', 'invited')
      .limit(1)
      .get();
    if (!accountants.empty) {
      const schoolId = await claimAccountant(caller, accountants.docs[0]);
      return {schoolId, role: schoolId ? 'accountant' : null};
    }

    return {schoolId: null, role: null};
  },
);
