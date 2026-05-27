/**
 * P4.3.1 -- principal rotates their school's teacherCode.
 *
 * The teacherCode is the 6-char string the principal shares MANUALLY (WhatsApp /
 * SMS / in person) with a teacher they want to onboard. The teacher enters it
 * during ZConnect first-time signup, which fires `requestTeacherJoin` (P4.3.3).
 *
 * Rotation is a deliberate revocation tool -- if a code leaks (e.g. principal
 * accidentally pasted it in the wrong WhatsApp group), the principal can rotate
 * to invalidate every outstanding share. Pending join requests are NOT cancelled
 * by a rotation: `schools/{id}/teachers/{teacherId}` records use the teacher's
 * uid as the doc id, not the code itself, so an in-flight request survives
 * rotation and the principal can still approve or reject it. Only NEW joins
 * (callers who haven't yet hit `requestTeacherJoin`) need the fresh code.
 *
 * Defence-in-depth: this callable requires `roles[]` includes 'principal' AND
 * verifies the caller is the `schools/{schoolId}.principalUid`. The role check
 * alone isn't enough -- a principal of school A must not rotate school B's code.
 *
 * Error contract (mapped to HttpsError):
 *   - unauthenticated      -> caller not signed in
 *   - permission-denied    -> caller is not 'principal' OR not the principal of this school
 *   - invalid-argument     -> schoolId missing
 *   - not-found            -> schoolId does not exist
 *   - internal             -> collision-retry exhausted (~impossible with a 32^6 alphabet)
 *                             OR Firestore write failed
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';
import {generateTeacherCode, withCodeCollisionRetry} from '../lib/codes';

interface Input {
  schoolId: string;
}

interface Output {
  teacherCode: string;
}

export const rotateTeacherCode = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'principal');

    const {schoolId} = request.data ?? {};
    if (typeof schoolId !== 'string' || schoolId.length === 0) {
      throw new HttpsError('invalid-argument', 'schoolId is required.');
    }

    const ref = db().collection('schools').doc(schoolId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'School not found.');
    }
    // School-scope check: caller must be THIS school's principal, not just
    // any user with the 'principal' role. The role check above only proved
    // they've been approved as a principal somewhere; this proves they own
    // this particular school.
    const data = snap.data() ?? {};
    if (data.principalUid !== caller.uid) {
      throw new HttpsError(
        'permission-denied',
        'You can only rotate the teacher code for your own school.',
      );
    }

    const newCode = await withCodeCollisionRetry(
      db(),
      'schools',
      'teacherCode',
      generateTeacherCode,
    );

    await ref.update({
      teacherCode: newCode,
      teacherCodeRotatedAt: FieldValue.serverTimestamp(),
    });

    return {teacherCode: newCode};
  },
);
