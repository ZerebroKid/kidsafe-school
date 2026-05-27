/**
 * P4.3 -- principal rejects a pending teacher join request.
 *
 * Sets `teachers/{teacherId}.status = 'rejected'` and records the reason.
 * Does NOT touch `users/{uid}.roles[]` -- a rejected teacher still has
 * roles=[] and ZConnect's RoleOnboardingGate will route them back to the
 * intent picker so they can re-submit with a fresh code if the principal
 * asks them to.
 *
 * `approvedByUid` + `approvedAt` are reused for the decision-time audit on
 * reject too (one timestamp field for "decision made", same convention as
 * `rejectPrincipal.ts`).
 *
 * Defence-in-depth school-scope check identical to `approveTeacher`.
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller doesn't hold 'principal' OR is principal of a different school
 *   - invalid-argument    -> schoolId, teacherId, or reason missing/empty
 *   - not-found           -> teacher doc doesn't exist
 *   - failed-precondition -> teacher request is not pending
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';

interface Input {
  schoolId: string;
  teacherId: string;
  reason: string;
}

interface Output {
  ok: true;
}

export const rejectTeacher = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'principal');

    const {schoolId, teacherId, reason} = request.data ?? {};
    if (
      typeof schoolId !== 'string' ||
      schoolId.length === 0 ||
      typeof teacherId !== 'string' ||
      teacherId.length === 0 ||
      typeof reason !== 'string' ||
      reason.trim().length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'schoolId, teacherId, and reason are required.',
      );
    }

    const schoolRef = db().collection('schools').doc(schoolId);
    const teacherRef = schoolRef.collection('teachers').doc(teacherId);

    await db().runTransaction(async tx => {
      const [schoolSnap, teacherSnap] = await Promise.all([
        tx.get(schoolRef),
        tx.get(teacherRef),
      ]);

      if (!schoolSnap.exists) {
        throw new HttpsError('not-found', 'School not found.');
      }
      if (!teacherSnap.exists) {
        throw new HttpsError('not-found', 'Teacher request not found.');
      }

      const school = schoolSnap.data() ?? {};
      if (school.principalUid !== caller.uid) {
        throw new HttpsError(
          'permission-denied',
          'You can only reject teachers for your own school.',
        );
      }

      const data = teacherSnap.data() ?? {};
      if (data.status !== 'pending') {
        throw new HttpsError(
          'failed-precondition',
          `Teacher request is ${data.status}, not pending.`,
        );
      }
      tx.update(teacherRef, {
        status: 'rejected',
        rejectedReason: reason.trim(),
        approvedByUid: caller.uid,
        approvedAt: FieldValue.serverTimestamp(),
      });
    });

    return {ok: true};
  },
);
