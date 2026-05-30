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
 * Error contract (mapped to HttpsError):
 *   - unauthenticated      -> caller not signed in
 *   - failed-precondition  -> caller signed in via non-phone provider (no phone token)
 *                             OR teacher already approved on this school
 *                             OR a selected subject is already taken by another teacher
 *   - invalid-argument     -> input fields missing OR teacherCode does not match
 *                             any school. Same code for both so a brute-forcer
 *                             can't probe for valid codes by reading error text.
 *   - internal             -> Firestore write failed; user can retry.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';

interface ClassSubject {
  classId: string;
  curriculumId: string;
}

interface Input {
  teacherCode: string;
  displayName: string;
  classSubjects?: ClassSubject[];
  /** @deprecated Use classSubjects instead. Kept for backward compat. */
  classIds?: string[];
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
    const {teacherCode, displayName, classSubjects, classIds} =
      request.data ?? {};

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
    const classesRef = schoolSnap.ref.collection('classes');

    // Build validated class-subject pairs.
    const validClassSubjects: ClassSubject[] = [];
    const validClassIds = new Set<string>();

    if (Array.isArray(classSubjects) && classSubjects.length > 0) {
      for (const cs of classSubjects) {
        if (
          !cs ||
          typeof cs.classId !== 'string' ||
          cs.classId.length === 0 ||
          typeof cs.curriculumId !== 'string' ||
          cs.curriculumId.length === 0
        ) {
          continue;
        }
        const cSnap = await classesRef.doc(cs.classId).get();
        if (!cSnap.exists) {
          throw new HttpsError(
            'invalid-argument',
            `Class ${cs.classId} does not exist in this school.`,
          );
        }
        // Check that this subject isn't already taken by another teacher.
        const classData = cSnap.data() ?? {};
        const existing =
          classData.subjectTeachers &&
          typeof classData.subjectTeachers === 'object'
            ? (classData.subjectTeachers as Record<string, string>)
            : {};
        const currentHolder = existing[cs.curriculumId];
        if (currentHolder && currentHolder !== caller.uid) {
          throw new HttpsError(
            'failed-precondition',
            `This subject is already assigned to another teacher in this class.`,
          );
        }
        validClassSubjects.push({
          classId: cs.classId,
          curriculumId: cs.curriculumId,
        });
        validClassIds.add(cs.classId);
      }
    } else if (Array.isArray(classIds) && classIds.length > 0) {
      // Backward compat: old clients that only send classIds
      for (const cid of classIds) {
        if (typeof cid !== 'string' || cid.trim().length === 0) continue;
        const cSnap = await classesRef.doc(cid).get();
        if (!cSnap.exists) {
          throw new HttpsError(
            'invalid-argument',
            `Class ${cid} does not exist in this school.`,
          );
        }
        validClassIds.add(cid);
      }
    }

    // Idempotency: teacherId = caller.uid (see file header).
    const teacherRef = schoolSnap.ref.collection('teachers').doc(caller.uid);
    const existingSnap = await teacherRef.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data() ?? {};
      if (existing.status === 'pending') {
        const patch: Record<string, unknown> = {};
        if (validClassSubjects.length > 0) {
          patch.requestedClassSubjects = validClassSubjects;
          patch.requestedClassIds = Array.from(validClassIds);
        } else if (validClassIds.size > 0) {
          patch.requestedClassIds = Array.from(validClassIds);
        }
        if (Object.keys(patch).length > 0) {
          await teacherRef.update(patch);
        }
        return {schoolId, teacherId: caller.uid, status: 'pending'};
      }
      if (existing.status === 'active') {
        throw new HttpsError(
          'failed-precondition',
          'You are already an active teacher at this school.',
        );
      }
    }

    await teacherRef.set({
      userId: caller.uid,
      displayName: displayName.trim(),
      phone: caller.phone,
      status: 'pending',
      requestedClassIds: Array.from(validClassIds),
      requestedClassSubjects: validClassSubjects,
      requestedAt: FieldValue.serverTimestamp(),
    });

    return {schoolId, teacherId: caller.uid, status: 'pending'};
  },
);
