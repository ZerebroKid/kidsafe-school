/**
 * P4.4.4 -- child joins a school by submitting the parent-shared `inviteCode`
 * + their grade + section during ZKid first-time signup.
 *
 * UNLIKE principal/teacher there is NO approval gate (§14 of the tech spec).
 * If the inviteCode is valid AND a class with the given grade+section exists,
 * the role is granted in the SAME transaction that links the child to the
 * class roster.
 *
 * Single transaction writes:
 *   1. children/{caller.uid} set (merge): {parentUid, classId: {schoolId, classId}}
 *      -- `parentUid` is carried over from `users/{uid}.parentUid` in case the
 *      children doc doesn't yet exist (today it's created lazily by the child
 *      sync engine AFTER permissions; this callable runs BEFORE permissions).
 *   2. schools/{schoolId}/classes/{classId}.studentChildUids arrayUnion uid
 *   3. users/{caller.uid}.roles arrayUnion 'child'
 *      + schoolIds arrayUnion schoolId
 *      + primaryRole = 'child' iff currently empty / unset / not in roles
 *
 * Precondition (deviates from spec text but spec-compatible):
 *   Spec says "reject if children/{caller.uid} doesn't exist". We instead
 *   check `users/{caller.uid}.parentUid` because pairing today only writes
 *   to the user doc (not the children doc). The intent is identical:
 *   "must have paired with a parent before joining a school".
 *
 * Idempotency: if user already has `roles array-contains 'child'` AND
 * `schoolIds array-contains schoolId` AND `children/{uid}.classId.classId`
 * matches, returns success without writing.
 *
 * Error contract:
 *   - unauthenticated      -> caller not signed in
 *   - invalid-argument     -> inputs missing/wrong type OR inviteCode invalid
 *   - failed-precondition  -> child not paired with a parent yet
 *                              OR school has no active principal yet
 *                              OR no class exists for {grade, section}
 *   - internal             -> Firestore write failed; user can retry.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';

interface Input {
  inviteCode: string;
  grade: number;
  section: string;
}

interface Output {
  schoolId: string;
  classId: string;
  alreadyJoined: boolean;
}

export const joinSchool = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const {inviteCode, grade, section} = request.data ?? {};

    if (
      typeof inviteCode !== 'string' ||
      inviteCode.trim().length === 0 ||
      typeof grade !== 'number' ||
      !Number.isFinite(grade) ||
      grade < 1 ||
      grade > 12 ||
      typeof section !== 'string' ||
      section.trim().length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'School code, grade, and section are required.',
      );
    }

    const normCode = inviteCode.trim().toUpperCase();
    const normSection = section.trim().toUpperCase();

    const matches = await db()
      .collection('schools')
      .where('inviteCode', '==', normCode)
      .limit(1)
      .get();
    if (matches.empty) {
      throw new HttpsError(
        'invalid-argument',
        'School code is incorrect or has been rotated.',
      );
    }
    const schoolSnap = matches.docs[0];
    if (!schoolSnap) {
      throw new HttpsError(
        'invalid-argument',
        'School code is incorrect or has been rotated.',
      );
    }
    const schoolId = schoolSnap.id;
    const schoolData = schoolSnap.data();
    if (!schoolData.principalUid) {
      throw new HttpsError(
        'failed-precondition',
        'This school is not fully set up yet. Ask your parent to wait for the principal to finish signup.',
      );
    }

    // Look up the class. Section is stored case-sensitively in the doc; the
    // principal-web class creation form upper-cases it (P4.3) so we compare
    // against the upper form. If a school somehow has a lower-case section
    // doc from earlier seed data, the lookup will miss -- the friendly error
    // tells the user what to ask their school.
    const classMatches = await schoolSnap.ref
      .collection('classes')
      .where('grade', '==', grade)
      .where('section', '==', normSection)
      .limit(1)
      .get();
    if (classMatches.empty) {
      throw new HttpsError(
        'failed-precondition',
        `Ask your school to add Class ${grade}${normSection}.`,
      );
    }
    const classSnap = classMatches.docs[0];
    if (!classSnap) {
      throw new HttpsError(
        'failed-precondition',
        `Ask your school to add Class ${grade}${normSection}.`,
      );
    }
    const classId = classSnap.id;

    const userRef = db().collection('users').doc(caller.uid);
    const childRef = db().collection('children').doc(caller.uid);
    const classRef = classSnap.ref;

    const alreadyJoined = await db().runTransaction(async tx => {
      const [userSnap, childSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(childRef),
      ]);

      if (!userSnap.exists) {
        throw new HttpsError(
          'failed-precondition',
          'User profile missing -- please sign out and back in.',
        );
      }
      const userData = userSnap.data() ?? {};
      const parentUid =
        typeof userData.parentUid === 'string' && userData.parentUid.length > 0
          ? userData.parentUid
          : null;
      if (!parentUid) {
        throw new HttpsError(
          'failed-precondition',
          'Pair with your parent before joining a school.',
        );
      }

      const existingRoles: string[] = Array.isArray(userData.roles)
        ? userData.roles.filter((r: unknown): r is string => typeof r === 'string')
        : [];
      const existingSchoolIds: string[] = Array.isArray(userData.schoolIds)
        ? userData.schoolIds.filter(
            (s: unknown): s is string => typeof s === 'string',
          )
        : [];

      const childData = childSnap.exists ? childSnap.data() ?? {} : {};
      const childClassRef = childData.classId as
        | {schoolId?: unknown; classId?: unknown}
        | undefined;
      const childClassIdMatches =
        !!childClassRef &&
        childClassRef.schoolId === schoolId &&
        childClassRef.classId === classId;

      if (
        existingRoles.includes('child') &&
        existingSchoolIds.includes(schoolId) &&
        childClassIdMatches
      ) {
        return true;
      }

      const primaryNeedsFix =
        typeof userData.primaryRole !== 'string' ||
        userData.primaryRole.length === 0 ||
        !existingRoles.includes(userData.primaryRole);

      tx.set(
        childRef,
        {
          parentUid,
          classId: {schoolId, classId},
        },
        {merge: true},
      );

      tx.set(
        classRef,
        {studentChildUids: FieldValue.arrayUnion(caller.uid)},
        {merge: true},
      );

      const userPatch: Record<string, unknown> = {
        roles: FieldValue.arrayUnion('child'),
        schoolIds: FieldValue.arrayUnion(schoolId),
      };
      if (primaryNeedsFix) userPatch.primaryRole = 'child';
      tx.set(userRef, userPatch, {merge: true});

      return false;
    });

    return {schoolId, classId, alreadyJoined};
  },
);
