/**
 * Principal requests to add new grades to their school's activeGrades.
 *
 * Writes `schools/{schoolId}/gradeChangeRequests/{autoId}` with status='pending'.
 * The change takes effect only after an admin approves via `approveGradeChange`.
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller doesn't hold 'principal' or isn't this school's principal
 *   - invalid-argument    -> missing/invalid fields, or all requested grades already active
 *   - failed-precondition -> a pending request already exists for some of these grades
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';
import {validateGradeSections} from '../lib/createClassSections';

interface Input {
  schoolId: string;
  /** @deprecated Use gradesSections instead. */
  gradesToAdd: number[];
  /** Maps grade (as string) to section count. E.g. {"9":2,"10":3}. */
  gradesSections?: Record<string, number>;
}

interface Output {
  requestId: string;
  status: 'pending';
}

export const requestGradeChange = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'principal');

    const {schoolId, gradesToAdd, gradesSections} = request.data ?? {};

    if (typeof schoolId !== 'string' || schoolId.length === 0) {
      throw new HttpsError('invalid-argument', 'schoolId is required.');
    }

    // Prefer the new sections map; fall back to the flat array for compat.
    let validatedSections: Record<string, number> | undefined;
    let effectiveGrades: number[];

    if (gradesSections !== undefined) {
      const parsed = validateGradeSections(gradesSections);
      if (!parsed) {
        throw new HttpsError(
          'invalid-argument',
          'gradesSections must map grade (1-12) to section count (1-10).',
        );
      }
      validatedSections = parsed;
      effectiveGrades = Object.keys(parsed).map(Number);
    } else if (
      Array.isArray(gradesToAdd) &&
      gradesToAdd.length > 0 &&
      gradesToAdd.every(
        g => typeof g === 'number' && Number.isInteger(g) && g >= 1 && g <= 12,
      )
    ) {
      effectiveGrades = gradesToAdd;
    } else {
      throw new HttpsError(
        'invalid-argument',
        'gradesToAdd or gradesSections is required.',
      );
    }

    const schoolRef = db().collection('schools').doc(schoolId);
    const schoolSnap = await schoolRef.get();
    if (!schoolSnap.exists) {
      throw new HttpsError('not-found', 'School not found.');
    }

    const schoolData = schoolSnap.data() ?? {};
    if (schoolData.principalUid !== caller.uid) {
      throw new HttpsError(
        'permission-denied',
        'You are not the principal of this school.',
      );
    }

    const currentGrades: number[] = Array.isArray(schoolData.activeGrades)
      ? schoolData.activeGrades
      : [];

    const deduped = [...new Set(effectiveGrades)].sort((a, b) => a - b);
    const newOnly = deduped.filter(g => !currentGrades.includes(g));
    if (newOnly.length === 0) {
      throw new HttpsError(
        'invalid-argument',
        'All requested grades are already active in this school.',
      );
    }

    // Build the sections map for new-only grades.
    let newSections: Record<string, number> | undefined;
    if (validatedSections) {
      newSections = {};
      for (const g of newOnly) {
        newSections[String(g)] = validatedSections[String(g)] ?? 1;
      }
    }

    const requestRef = schoolRef.collection('gradeChangeRequests').doc();
    const payload: Record<string, unknown> = {
      id: requestRef.id,
      requestedByUid: caller.uid,
      gradesToAdd: newOnly,
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
    };
    if (newSections) {
      payload.gradesSections = newSections;
    }
    await requestRef.set(payload);

    return {requestId: requestRef.id, status: 'pending'};
  },
);
