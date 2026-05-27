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

      tx.update(teacherRef, {
        status: 'active',
        approvedByUid: caller.uid,
        approvedAt: FieldValue.serverTimestamp(),
      });
      const userPatch: Record<string, unknown> = {
        roles: FieldValue.arrayUnion('teacher'),
      };
      if (primaryNeedsFix) userPatch.primaryRole = 'teacher';
      tx.set(userRef, userPatch, {merge: true});
    });

    return {ok: true};
  },
);
