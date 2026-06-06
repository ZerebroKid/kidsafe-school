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
import {validateGradeSections} from '../lib/createClassSections';

interface Input {
  inviteCode: string;
  displayName: string;
  /** @deprecated Use requestedGradeSections instead. */
  requestedGrades?: number[];
  /** Maps grade (as string) to section count. E.g. {"1":2,"8":1}. */
  requestedGradeSections?: Record<string, number>;
  /** Total students in the school. Used as Razorpay subscription quantity. */
  studentCount?: number;
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
    const {inviteCode, displayName, requestedGrades, requestedGradeSections, studentCount} =
      request.data ?? {};

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

    // Validate grade selections -- prefer the new sections map, fall back to
    // the legacy flat array for backward compatibility.
    let validatedSections: Record<string, number> | undefined;
    let validatedGrades: number[] | undefined;

    if (requestedGradeSections !== undefined) {
      const parsed = validateGradeSections(requestedGradeSections);
      if (!parsed) {
        throw new HttpsError(
          'invalid-argument',
          'requestedGradeSections must map grade (1-12) to section count (1-10).',
        );
      }
      validatedSections = parsed;
      validatedGrades = Object.keys(parsed)
        .map(Number)
        .sort((a, b) => a - b);
    } else if (requestedGrades !== undefined) {
      if (
        !Array.isArray(requestedGrades) ||
        requestedGrades.length === 0 ||
        !requestedGrades.every(
          g => typeof g === 'number' && Number.isInteger(g) && g >= 1 && g <= 12,
        )
      ) {
        throw new HttpsError(
          'invalid-argument',
          'requestedGrades must be a non-empty array of integers 1-12.',
        );
      }
      validatedGrades = [...new Set(requestedGrades)].sort((a, b) => a - b);
    }

    // Validate studentCount if provided (optional for backward compat).
    let validatedStudentCount: number | undefined;
    if (studentCount !== undefined) {
      if (
        typeof studentCount !== 'number' ||
        !Number.isInteger(studentCount) ||
        studentCount < 1 ||
        studentCount > 50000
      ) {
        throw new HttpsError(
          'invalid-argument',
          'studentCount must be an integer between 1 and 50,000.',
        );
      }
      validatedStudentCount = studentCount;
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
        if (validatedSections) {
          await principalRef.update({
            requestedGradeSections: validatedSections,
            requestedGrades: validatedGrades,
          });
        } else if (validatedGrades) {
          await principalRef.update({requestedGrades: validatedGrades});
        }
        if (validatedStudentCount !== undefined) {
          await schoolSnap.ref.update({studentCount: validatedStudentCount});
        }
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

    const principalPayload: Record<string, unknown> = {
      userId: caller.uid,
      displayName: displayName.trim(),
      phone: caller.phone,
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
    };
    if (validatedSections) {
      principalPayload.requestedGradeSections = validatedSections;
      principalPayload.requestedGrades = validatedGrades;
    } else if (validatedGrades) {
      principalPayload.requestedGrades = validatedGrades;
    }
    await principalRef.set(principalPayload);

    if (validatedStudentCount !== undefined) {
      await schoolSnap.ref.update({studentCount: validatedStudentCount});
    }

    return {schoolId, principalId: caller.uid, status: 'pending'};
  },
);
