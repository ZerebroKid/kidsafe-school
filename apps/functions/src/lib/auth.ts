/**
 * Auth + role helpers for v2 onCall handlers.
 *
 * Mirrors the semantics of `isAdmin() / isPrincipal() / hasRole(role)` in
 * [firestore/rules](../../../../firestore/rules) so a callable's rejection
 * always matches what a direct Firestore write would have rejected too.
 *
 * Roles live in `users/{uid}.roles[]` (v2 schema, post-P3 migration). We do
 * NOT use Firebase custom claims for role enforcement; the canonical source
 * of truth is the Firestore doc so we can mutate roles transactionally from
 * the same write that mutates business data (e.g. approvePrincipal also
 * stamps schools/{id}.principalUid in the same batch).
 */

import {HttpsError, type CallableRequest} from 'firebase-functions/v2/https';

import type {Role} from './sharedTypes';
import {db} from './admin';

export interface AuthedCaller {
  uid: string;
  /** From `request.auth.token.phone_number` (Firebase Phone Auth populates this). */
  phone: string | null;
}

/**
 * Assert the caller is signed in and return their uid + phone. Throws
 * `HttpsError('unauthenticated', ...)` for anonymous callers so callable
 * clients get a clean error toast instead of a 200 with no payload.
 */
export function requireAuth(request: CallableRequest<unknown>): AuthedCaller {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to continue.');
  }
  const phoneToken = request.auth.token.phone_number;
  const phone =
    typeof phoneToken === 'string' && phoneToken.length > 0 ? phoneToken : null;
  return {uid: request.auth.uid, phone};
}

/**
 * Read the caller's `users/{uid}.roles[]` and throw `permission-denied` if it
 * does not include `role`. Tolerates the v1 single-`role` field for orphan
 * accounts that somehow escaped the P3 migration -- mirrors the same
 * fallback the Firestore rules `rolesOfSelf()` helper uses.
 */
export async function requireRole(uid: string, role: Role): Promise<void> {
  const snap = await db().collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'User profile missing.');
  }
  const data = snap.data() ?? {};
  const roles: unknown = data.roles;
  const legacy: unknown = data.role;
  const normalised: string[] = Array.isArray(roles)
    ? roles.filter((r): r is string => typeof r === 'string')
    : typeof legacy === 'string'
      ? [legacy]
      : [];
  if (!normalised.includes(role)) {
    throw new HttpsError(
      'permission-denied',
      `This action requires the ${role} role.`,
    );
  }
}
