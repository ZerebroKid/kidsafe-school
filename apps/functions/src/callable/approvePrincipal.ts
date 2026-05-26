/**
 * P4.2.6 -- admin approves a pending principal claim.
 *
 * Transactionally:
 *   1. principals/{principalId}.status = 'active'
 *      + approvedByUid = callerUid, approvedAt = serverTimestamp
 *   2. schools/{schoolId}.principalUid = principal.userId
 *      (denormalised pointer so belongsToSchool() in firestore.rules can
 *       evaluate without a subcollection lookup)
 *   3. users/{principal.userId}.roles arrayUnion 'principal'
 *      + primaryRole = 'principal' iff currently empty / unset / not in roles
 *
 * Single transaction so a partial failure (e.g. user doc gone mid-flight)
 * doesn't leave the system in a half-approved state.
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller doesn't hold 'admin'
 *   - invalid-argument    -> schoolId or principalId missing
 *   - not-found           -> school or principal doc doesn't exist
 *   - failed-precondition -> principal not pending, OR school already has an
 *                            active principalUid (race with a concurrent
 *                            approval of a sibling claim), OR principal's
 *                            user doc no longer exists
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';

interface Input {
  schoolId: string;
  principalId: string;
}

interface Output {
  ok: true;
}

export const approvePrincipal = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'admin');

    const {schoolId, principalId} = request.data ?? {};
    if (
      typeof schoolId !== 'string' ||
      schoolId.length === 0 ||
      typeof principalId !== 'string' ||
      principalId.length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'schoolId and principalId are required.',
      );
    }

    const schoolRef = db().collection('schools').doc(schoolId);
    const principalRef = schoolRef.collection('principals').doc(principalId);

    await db().runTransaction(async tx => {
      const [schoolSnap, principalSnap] = await Promise.all([
        tx.get(schoolRef),
        tx.get(principalRef),
      ]);

      if (!schoolSnap.exists) {
        throw new HttpsError('not-found', 'School not found.');
      }
      if (!principalSnap.exists) {
        throw new HttpsError('not-found', 'Principal claim not found.');
      }

      const principal = principalSnap.data() ?? {};
      if (principal.status !== 'pending') {
        throw new HttpsError(
          'failed-precondition',
          `Principal claim is ${principal.status}, not pending.`,
        );
      }
      const school = schoolSnap.data() ?? {};
      if (school.principalUid) {
        throw new HttpsError(
          'failed-precondition',
          'This school already has an active principal.',
        );
      }
      const principalUid =
        typeof principal.userId === 'string' ? principal.userId : '';
      if (!principalUid) {
        throw new HttpsError(
          'failed-precondition',
          'Principal claim is missing a userId.',
        );
      }

      const userRef = db().collection('users').doc(principalUid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError(
          'failed-precondition',
          'Principal user profile no longer exists.',
        );
      }

      const userData = userSnap.data() ?? {};
      const existingRoles: string[] = Array.isArray(userData.roles)
        ? userData.roles.filter((r: unknown): r is string => typeof r === 'string')
        : [];
      const primaryNeedsFix =
        typeof userData.primaryRole !== 'string' ||
        userData.primaryRole.length === 0 ||
        !existingRoles.includes(userData.primaryRole);

      tx.update(principalRef, {
        status: 'active',
        approvedByUid: caller.uid,
        approvedAt: FieldValue.serverTimestamp(),
      });
      tx.update(schoolRef, {principalUid});
      const userPatch: Record<string, unknown> = {
        roles: FieldValue.arrayUnion('principal'),
      };
      if (primaryNeedsFix) userPatch.primaryRole = 'principal';
      tx.set(userRef, userPatch, {merge: true});
    });

    return {ok: true};
  },
);
