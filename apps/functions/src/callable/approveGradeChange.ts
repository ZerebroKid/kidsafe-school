/**
 * Admin approves a pending grade-change request, merging the requested
 * grades into `schools/{schoolId}.activeGrades`.
 *
 * Transactionally:
 *   1. Validates the request is still 'pending'
 *   2. Merges `gradesToAdd` into the school's `activeGrades` (sorted, deduped)
 *   3. Marks the request as 'approved'
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller doesn't hold 'admin'
 *   - invalid-argument    -> missing fields
 *   - not-found           -> school or request doc doesn't exist
 *   - failed-precondition -> request is not pending
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';
import {
  createClassSections,
  currentAcademicYear,
} from '../lib/createClassSections';

interface Input {
  schoolId: string;
  requestId: string;
}

interface Output {
  ok: true;
}

export const approveGradeChange = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'admin');

    const {schoolId, requestId} = request.data ?? {};
    if (
      typeof schoolId !== 'string' || schoolId.length === 0 ||
      typeof requestId !== 'string' || requestId.length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'schoolId and requestId are required.',
      );
    }

    const schoolRef = db().collection('schools').doc(schoolId);
    const requestRef = schoolRef
      .collection('gradeChangeRequests')
      .doc(requestId);

    await db().runTransaction(async tx => {
      const [schoolSnap, reqSnap] = await Promise.all([
        tx.get(schoolRef),
        tx.get(requestRef),
      ]);

      if (!schoolSnap.exists) {
        throw new HttpsError('not-found', 'School not found.');
      }
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Grade change request not found.');
      }

      const reqData = reqSnap.data() ?? {};
      if (reqData.status !== 'pending') {
        throw new HttpsError(
          'failed-precondition',
          `Request is ${reqData.status}, not pending.`,
        );
      }

      const schoolData = schoolSnap.data() ?? {};
      const current: number[] = Array.isArray(schoolData.activeGrades)
        ? schoolData.activeGrades
        : [];
      const toAdd: number[] = Array.isArray(reqData.gradesToAdd)
        ? reqData.gradesToAdd
        : [];

      const merged = [...new Set([...current, ...toAdd])].sort((a, b) => a - b);

      tx.update(schoolRef, {activeGrades: merged});
      tx.update(requestRef, {
        status: 'approved',
        reviewedByUid: caller.uid,
        reviewedAt: FieldValue.serverTimestamp(),
      });

      // Auto-create class sections if the request carries a sections map.
      const sections: unknown = reqData.gradesSections;
      if (
        typeof sections === 'object' &&
        sections !== null &&
        !Array.isArray(sections) &&
        Object.keys(sections as Record<string, unknown>).length > 0
      ) {
        createClassSections(
          tx,
          schoolRef,
          sections as Record<string, number>,
          currentAcademicYear(),
        );
      }
    });

    return {ok: true};
  },
);
