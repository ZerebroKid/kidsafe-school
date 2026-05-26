/**
 * P4.2.4 -- principal claims a school by entering the manually-shared
 * inviteCode during first-time Zerebro Campus signup.
 *
 * Writes `schools/{schoolId}/principals/{principalId}` with status='pending'.
 * Does NOT grant any role -- the role grant happens later in `approvePrincipal`
 * after an admin reviews. The `users/{uid}.roles[]` array remains [] until
 * then (so the Campus dashboard guard keeps the principal on the pending
 * screen).
 *
 * principalId is intentionally the caller's uid (NOT an auto-id). This:
 *   1. Guarantees at most one pending claim per phone per school (the second
 *      claimSchool call from the same user simply returns the existing doc).
 *   2. Lets the principal-web pending screen subscribe via
 *      `doc(db,'schools',schoolId,'principals', myUid)` -- no need to first
 *      query for the principalId.
 *   3. Aligns with the rules' `belongsToSchool()` and self-read predicates
 *      which all key off `myUid()`.
 *
 * Error contract (mapped to HttpsError):
 *   - unauthenticated      -> caller not signed in
 *   - invalid-argument     -> input fields missing OR inviteCode does not match
 *                             any school. Same code for both so a brute-forcer
 *                             can't probe for valid codes by reading error text.
 *   - failed-precondition  -> school already has an active principal.
 *   - internal             -> Firestore write failed; user can retry.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';

interface Input {
  inviteCode: string;
  displayName: string;
}

interface Output {
  schoolId: string;
  principalId: string;
  status: 'pending';
}

export const claimSchool = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const {inviteCode, displayName} = request.data ?? {};

    if (
      typeof inviteCode !== 'string' ||
      inviteCode.trim().length === 0 ||
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
      // other provider (email link, anonymous) we don't support yet.
      throw new HttpsError(
        'failed-precondition',
        'Sign in with your phone number to claim a school.',
      );
    }

    const normCode = inviteCode.trim().toUpperCase();
    const schoolsRef = db().collection('schools');
    const matches = await schoolsRef
      .where('inviteCode', '==', normCode)
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
    const schoolData = schoolSnap.data();

    if (schoolData.principalUid) {
      throw new HttpsError(
        'failed-precondition',
        'This school already has an active principal. Ask the admin to rotate the code.',
      );
    }

    // Idempotency: principalId = caller.uid (see file header). If a pending
    // doc already exists for THIS user under THIS school, return it without
    // writing.
    const principalRef = schoolSnap.ref
      .collection('principals')
      .doc(caller.uid);
    const existingSnap = await principalRef.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data() ?? {};
      if (existing.status === 'pending') {
        return {schoolId, principalId: caller.uid, status: 'pending'};
      }
      if (existing.status === 'active') {
        throw new HttpsError(
          'failed-precondition',
          'You are already the active principal of this school.',
        );
      }
      // rejected -> let them re-submit by overwriting.
    }

    await principalRef.set({
      userId: caller.uid,
      displayName: displayName.trim(),
      phone: caller.phone,
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
    });

    return {schoolId, principalId: caller.uid, status: 'pending'};
  },
);
