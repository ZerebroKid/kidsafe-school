/**
 * P4.4.2 -- parent joins a school by submitting the principal-shared
 * `inviteCode` during ZConnect first-time signup.
 *
 * UNLIKE the principal/teacher flow there is NO approval gate (§14 of the
 * tech spec). If the inviteCode is valid, the role is granted in the SAME
 * transaction that writes the parent doc. This is safe because the only
 * access "parent" grants is "I can manage MY OWN child" (already gated by
 * the parent-child pairing flow), and parents are read-only at the school
 * level.
 *
 * Single transaction writes:
 *   1. schools/{schoolId}/parents/{caller.uid} -- {userId, phone, displayName, joinedAt}
 *   2. users/{caller.uid}.roles arrayUnion 'parent'
 *      + schoolIds arrayUnion schoolId
 *      + primaryRole = 'parent' iff currently empty / not in roles
 *
 * Idempotency: if user already has `roles array-contains 'parent'` AND
 * `schoolIds array-contains schoolId`, returns success without writing.
 * Lets a glitchy network or double-tap retry safely.
 *
 * Error contract (mapped to HttpsError):
 *   - unauthenticated      -> caller not signed in
 *   - failed-precondition  -> non-phone provider, OR school has no active
 *                              principal yet (school isn't fully set up)
 *   - invalid-argument     -> input fields missing OR inviteCode invalid.
 *                              Same code for both so a brute-forcer can't
 *                              probe for valid codes via error text.
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
  alreadyJoined: boolean;
}

export const joinSchoolAsParent = onCall<Input, Promise<Output>>(
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
      throw new HttpsError(
        'failed-precondition',
        'Sign in with your phone number to join as a parent.',
      );
    }

    const normCode = inviteCode.trim().toUpperCase();
    const matches = await db()
      .collection('schools')
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
    if (!schoolData.principalUid) {
      // A school with no active principal isn't ready to accept parents.
      // We could relax this later, but the spec is explicit (§P4.4.2).
      throw new HttpsError(
        'failed-precondition',
        'This school is not fully set up yet. Ask the principal to finish signup first.',
      );
    }

    const schoolRef = schoolSnap.ref;
    const parentRef = schoolRef.collection('parents').doc(caller.uid);
    const userRef = db().collection('users').doc(caller.uid);

    const alreadyJoined = await db().runTransaction(async tx => {
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() ?? {} : {};
      const existingRoles: string[] = Array.isArray(userData.roles)
        ? userData.roles.filter((r: unknown): r is string => typeof r === 'string')
        : [];
      const existingSchoolIds: string[] = Array.isArray(userData.schoolIds)
        ? userData.schoolIds.filter(
            (s: unknown): s is string => typeof s === 'string',
          )
        : [];

      if (
        existingRoles.includes('parent') &&
        existingSchoolIds.includes(schoolId)
      ) {
        return true;
      }

      // primaryRole repair: set to 'parent' iff currently empty / unset /
      // not a role they actually hold. For a parent-teacher this preserves
      // 'teacher' or whatever was already set.
      const primaryNeedsFix =
        typeof userData.primaryRole !== 'string' ||
        userData.primaryRole.length === 0 ||
        !existingRoles.includes(userData.primaryRole);

      tx.set(
        parentRef,
        {
          userId: caller.uid,
          phone: caller.phone,
          displayName: displayName.trim(),
          joinedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );

      const userPatch: Record<string, unknown> = {
        roles: FieldValue.arrayUnion('parent'),
        schoolIds: FieldValue.arrayUnion(schoolId),
      };
      if (primaryNeedsFix) userPatch.primaryRole = 'parent';
      tx.set(userRef, userPatch, {merge: true});

      return false;
    });

    return {schoolId, alreadyJoined};
  },
);
