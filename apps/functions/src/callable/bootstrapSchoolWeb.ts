/**
 * First School Web sign-in creates a private school for this phone.
 * A later call returns the same school. Does not attach Campus schools.
 */

import {onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {generateInviteCode} from '../lib/codes';
import {rolePatch} from '../lib/schoolWeb';
import {todayYmdInTz} from '../lib/schoolTime';

interface Output {
  schoolId: string;
}

function currentAcademicYear(): string {
  const [yearText, monthText] = todayYmdInTz().split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** Nursery plus classes 1–12, sections A and B. Runs once per school. */
async function ensureDefaultClasses(schoolId: string): Promise<void> {
  const schoolRef = db().collection('schools').doc(schoolId);
  const schoolSnap = await schoolRef.get();
  if (schoolSnap.data()?.classesSeeded === true) return;

  const existing = await schoolRef.collection('classes').get();
  const have = new Set(
    existing.docs.map(item => `${item.data().grade}|${item.data().section}`),
  );
  const year = currentAcademicYear();
  const batch = db().batch();
  for (let grade = 0; grade <= 12; grade++) {
    for (const section of ['A', 'B']) {
      if (have.has(`${grade}|${section}`)) continue;
      const className = grade === 0 ? `Nursery ${section}` : `${grade}${section}`;
      batch.set(schoolRef.collection('classes').doc(`g${grade}-${section}`), {
        grade,
        section,
        className,
        academicYear: year,
        teacherIds: [],
        studentChildUids: [],
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
  batch.set(schoolRef, {classesSeeded: true, activeGrades: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}, {merge: true});
  await batch.commit();
}

export const bootstrapSchoolWeb = onCall<unknown, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const existing = await db()
      .collection('schools')
      .where('principalUid', '==', caller.uid)
      .where('app', '==', 'school-web')
      .limit(1)
      .get();
    if (!existing.empty) {
      const schoolId = existing.docs[0].id;
      await ensureDefaultClasses(schoolId);
      return {schoolId};
    }

    const schoolRef = db().collection('schools').doc(`sw_${caller.uid}`);
    const userRef = db().collection('users').doc(caller.uid);
    const principalRef = schoolRef.collection('principals').doc(caller.uid);

    await db().runTransaction(async tx => {
      const [schoolSnap, userSnap] = await Promise.all([
        tx.get(schoolRef),
        tx.get(userRef),
      ]);
      if (schoolSnap.exists && schoolSnap.data()?.app === 'school-web') return;

      const userData = userSnap.data() ?? {};
      const phone =
        caller.phone ?? (typeof userData.phone === 'string' ? userData.phone : '');
      const displayName =
        typeof userData.displayName === 'string' && userData.displayName.length > 0
          ? userData.displayName
          : 'Principal';

      tx.set(schoolRef, {
        name: 'My School',
        principalUid: caller.uid,
        app: 'school-web',
        activeGrades: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        inviteCode: generateInviteCode(),
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(principalRef, {
        userId: caller.uid,
        phone,
        displayName,
        status: 'active',
        requestedAt: FieldValue.serverTimestamp(),
        approvedAt: FieldValue.serverTimestamp(),
      });
      tx.set(userRef, {...rolePatch(userData, 'principal'), ...(phone ? {phone} : {})}, {merge: true});
    });

    await ensureDefaultClasses(schoolRef.id);
    return {schoolId: schoolRef.id};
  },
);
