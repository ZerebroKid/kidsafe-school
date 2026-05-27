/**
 * P4.3.3 -- teacher submits the principal-issued teacherCode during ZConnect
 * first-time signup.
 *
 * Writes `schools/{schoolId}/teachers/{teacherId}` with status='pending'.
 * Does NOT grant any role -- the role grant happens later in `approveTeacher`
 * after the principal reviews. The `users/{uid}.roles[]` array remains [] until
 * then so ZConnect's RoleOnboardingGate keeps the teacher on the "Waiting for
 * principal approval" screen.
 *
 * teacherId is intentionally the caller's uid (NOT an auto-id). This:
 *   1. Guarantees at most one pending request per phone per school (the
 *      second `requestTeacherJoin` call from the same user simply returns
 *      the existing doc).
 *   2. Lets the ZConnect pending screen subscribe via
 *      `collectionGroup('teachers').where('userId','==',myUid).limit(1)`
 *      -- the cross-school rule in firestore/rules permits the read because
 *      `resource.data.userId == myUid()`.
 *   3. Aligns with the rules' `belongsToSchool()` predicate so the principal
 *      can read every teacher doc under their school.
 *
 * Mirrors `claimSchool.ts` line-for-line in structure -- the only differences
 * are the field name (`teacherCode` vs `inviteCode`) and the subcollection
 * path (`teachers` vs `principals`).
 *
 * Error contract (mapped to HttpsError):
 *   - unauthenticated      -> caller not signed in
 *   - failed-precondition  -> caller signed in via non-phone provider (no phone token)
 *                             OR teacher already approved on this school
 *   - invalid-argument     -> input fields missing OR teacherCode does not match
 *                             any school. Same code for both so a brute-forcer
 *                             can't probe for valid codes by reading error text.
 *   - internal             -> Firestore write failed; user can retry.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';

interface Input {
  teacherCode: string;
  displayName: string;
}

interface Output {
  schoolId: string;
  teacherId: string;
  status: 'pending';
}

export const requestTeacherJoin = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const {teacherCode, displayName} = request.data ?? {};

    if (
      typeof teacherCode !== 'string' ||
      teacherCode.trim().length === 0 ||
      typeof displayName !== 'string' ||
      displayName.trim().length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Code is incorrect or has been rotated.',
      );
    }
    if (!caller.phone) {
      // Phone-OTP is the only sign-in method that reaches this callable in
      // Phase 4. A missing phone token means the caller signed in via some
      // other provider (email / Google / anonymous) which we don't yet support
      // for teacher onboarding.
      throw new HttpsError(
        'failed-precondition',
        'Sign in with your phone number to join as a teacher.',
      );
    }

    const normCode = teacherCode.trim().toUpperCase();
    const schoolsRef = db().collection('schools');
    const matches = await schoolsRef
      .where('teacherCode', '==', normCode)
      .limit(1)
      .get();
    if (matches.empty) {
      throw new HttpsError(
        'invalid-argument',
        'Code is incorrect or has been rotated.',
      );
    }
    const schoolSnap = matches.docs[0];
    if (!schoolSnap) {
      throw new HttpsError(
        'invalid-argument',
        'Code is incorrect or has been rotated.',
      );
    }
    const schoolId = schoolSnap.id;

    // Idempotency: teacherId = caller.uid (see file header). If a doc already
    // exists for THIS user under THIS school, branch on its status.
    const teacherRef = schoolSnap.ref.collection('teachers').doc(caller.uid);
    const existingSnap = await teacherRef.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data() ?? {};
      if (existing.status === 'pending') {
        return {schoolId, teacherId: caller.uid, status: 'pending'};
      }
      if (existing.status === 'active') {
        throw new HttpsError(
          'failed-precondition',
          'You are already an active teacher at this school.',
        );
      }
      // rejected -> let them re-submit by overwriting (the principal may have
      // rotated the code and the teacher is retrying with the new one).
    }

    await teacherRef.set({
      userId: caller.uid,
      displayName: displayName.trim(),
      phone: caller.phone,
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
    });

    return {schoolId, teacherId: caller.uid, status: 'pending'};
  },
);
