import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {normalizePhoneToE164} from '../lib/phone';
import {assertStaffPhoneAvailable, requirePrincipalOfSchool, requireSchoolId} from '../lib/schoolWeb';

interface Input {
  schoolId: string;
  displayName: string;
  phone: string;
}

export const addSchoolAccountant = onCall<Input, Promise<{accountantId: string}>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const schoolId = requireSchoolId(request.data?.schoolId);
    const displayName =
      typeof request.data?.displayName === 'string' ? request.data.displayName.trim() : '';
    if (!displayName) throw new HttpsError('invalid-argument', 'Name is required.');
    const phone = normalizePhoneToE164(request.data?.phone ?? '');
    await requirePrincipalOfSchool(caller.uid, schoolId);
    await assertStaffPhoneAvailable(schoolId, phone, caller.phone, 'accountant');

    const schoolRef = db().collection('schools').doc(schoolId);
    const existing = await schoolRef.collection('accountants').where('phone', '==', phone).limit(1).get();
    if (!existing.empty) {
      await existing.docs[0].ref.set({displayName}, {merge: true});
      return {accountantId: existing.docs[0].id};
    }

    const ref = schoolRef.collection('accountants').doc();
    await ref.set({
      displayName,
      phone,
      status: 'invited',
      userId: '',
      requestedAt: FieldValue.serverTimestamp(),
    });
    return {accountantId: ref.id};
  },
);
