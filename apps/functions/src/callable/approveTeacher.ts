/**
 * P4.3.6 -- principal approves a pending teacher join request.
 *
 * Transactionally:
 *   1. teachers/{teacherId}.status = 'active'
 *      + approvedByUid = callerUid, approvedAt = serverTimestamp
 *   2. users/{teacher.userId}.roles array-UNION 'teacher'
 *      (NEVER overwrite -- a parent-teacher keeps their parent role and the
 *       ZConnect RoleSwitcher pill appears for them on next render)
 *      + primaryRole = 'teacher' iff currently empty / unset / not in roles
 *
 * Single transaction so a partial failure (e.g. teacher's user doc gone
 * mid-flight) doesn't leave the system in a half-approved state.
 *
 * Defence-in-depth (school scope check): a principal of school A must not
 * approve a teacher under school B. The role check alone proves they hold
 * 'principal' somewhere; we additionally verify they're the principalUid of
 * THIS school.
 *
 * Mirrors `approvePrincipal.ts` -- only difference is the role being granted
 * ('teacher' vs 'principal') and that we do NOT stamp anything onto the
 * `schools/{id}` doc (a school can have many teachers; no denormalised
 * pointer is needed).
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller doesn't hold 'principal' OR is principal of a different school
 *   - invalid-argument    -> schoolId or teacherId missing
 *   - not-found           -> school or teacher doc doesn't exist
 *   - failed-precondition -> teacher not pending OR teacher's user doc no longer exists
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';

interface Input {
  schoolId: string;
  teacherId: string;
}

interface Output {
  ok: true;
}

export const approveTeacher = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'principal');

    const {schoolId, teacherId} = request.data ?? {};
    if (
      typeof schoolId !== 'string' ||
      schoolId.length === 0 ||
      typeof teacherId !== 'string' ||
      teacherId.length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'schoolId and teacherId are required.',
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

      // School scope: caller must be THIS school's principal.
      const school = schoolSnap.data() ?? {};
      if (school.principalUid !== caller.uid) {
        throw new HttpsError(
          'permission-denied',
          'You can only approve teachers for your own school.',
        );
      }

      const teacher = teacherSnap.data() ?? {};
      if (teacher.status !== 'pending') {
        throw new HttpsError(
          'failed-precondition',
          `Teacher request is ${teacher.status}, not pending.`,
        );
      }
      const teacherUid =
        typeof teacher.userId === 'string' ? teacher.userId : '';
      if (!teacherUid) {
        throw new HttpsError(
          'failed-precondition',
          'Teacher request is missing a userId.',
        );
      }

      const userRef = db().collection('users').doc(teacherUid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError(
          'failed-precondition',
          'Teacher user profile no longer exists.',
        );
      }

      const userData = userSnap.data() ?? {};
      const existingRoles: string[] = Array.isArray(userData.roles)
        ? userData.roles.filter((r: unknown): r is string => typeof r === 'string')
        : [];
      // primaryRole repair: set to 'teacher' iff currently empty / unset / not
      // a role they actually hold AFTER the union. For a parent-teacher, the
      // existing 'parent' primary is preserved (it's still in the resulting
      // roles, so the predicate is false).
      const primaryNeedsFix =
        typeof userData.primaryRole !== 'string' ||
        userData.primaryRole.length === 0 ||
        !existingRoles.includes(userData.primaryRole);

      // Read the teacher's requested class+subject pairs (new) or plain class IDs (legacy).
      interface ClassSubjectPair {
        classId: string;
        curriculumId: string;
      }
      const requestedClassSubjects: ClassSubjectPair[] = Array.isArray(
        teacher.requestedClassSubjects,
      )
        ? teacher.requestedClassSubjects.filter(
            (cs: unknown): cs is ClassSubjectPair =>
              !!cs &&
              typeof (cs as ClassSubjectPair).classId === 'string' &&
              typeof (cs as ClassSubjectPair).curriculumId === 'string',
          )
        : [];

      const requestedClassIds: string[] = Array.isArray(teacher.requestedClassIds)
        ? teacher.requestedClassIds.filter(
            (c: unknown): c is string => typeof c === 'string' && c.length > 0,
          )
        : [];

      // Collect unique class IDs from both sources.
      const allClassIds = new Set<string>(requestedClassIds);
      for (const cs of requestedClassSubjects) {
        allClassIds.add(cs.classId);
      }

      // Read all affected class docs to validate subject exclusivity.
      const classSnaps = new Map<
        string,
        FirebaseFirestore.DocumentSnapshot
      >();
      for (const classId of allClassIds) {
        const classRef = schoolRef.collection('classes').doc(classId);
        const snap = await tx.get(classRef);
        classSnaps.set(classId, snap);
      }

      // Validate that no requested subject is already taken by another teacher.
      for (const cs of requestedClassSubjects) {
        const snap = classSnaps.get(cs.classId);
        if (!snap || !snap.exists) continue;
        const classData = snap.data() ?? {};
        const existing =
          classData.subjectTeachers &&
          typeof classData.subjectTeachers === 'object'
            ? (classData.subjectTeachers as Record<string, string>)
            : {};
        const currentHolder = existing[cs.curriculumId];
        if (currentHolder && currentHolder !== teacherUid) {
          throw new HttpsError(
            'failed-precondition',
            'A requested subject is already assigned to another teacher. Ask the teacher to re-submit.',
          );
        }
      }

      tx.update(teacherRef, {
        status: 'active',
        approvedByUid: caller.uid,
        approvedAt: FieldValue.serverTimestamp(),
        ...(allClassIds.size > 0
          ? {assignedClassIds: Array.from(allClassIds)}
          : {}),
        ...(requestedClassSubjects.length > 0
          ? {assignedClassSubjects: requestedClassSubjects}
          : {}),
      });
      const userPatch: Record<string, unknown> = {
        roles: FieldValue.arrayUnion('teacher'),
      };
      if (primaryNeedsFix) userPatch.primaryRole = 'teacher';
      tx.set(userRef, userPatch, {merge: true});

      // Add teacher UID to each class's teacherIds AND subjectTeachers map.
      for (const classId of allClassIds) {
        const classRef = schoolRef.collection('classes').doc(classId);
        const subjectPatch: Record<string, FieldValue | string> = {
          teacherIds: FieldValue.arrayUnion(teacherUid),
        };
        for (const cs of requestedClassSubjects) {
          if (cs.classId === classId) {
            subjectPatch[`subjectTeachers.${cs.curriculumId}`] = teacherUid;
          }
        }
        tx.update(classRef, subjectPatch);
      }
    });

    return {ok: true};
  },
);
