// Auth helpers stub — Phase 1.3.4 fills with real getCurrentUserDoc, signIn etc.
// Phase 3.2.2 extends to return roles[] with backwards-compat fallback.

import type { Role, UserDocStub } from '@zerebro/shared-types';

export type CurrentUser = Pick<UserDocStub, 'uid' | 'roles' | 'primaryRole'> | null;

export async function getCurrentUser(): Promise<CurrentUser> {
  throw new Error('not implemented — wired in Phase 1.3.4');
}

export function hasRole(_user: CurrentUser, _role: Role): boolean {
  throw new Error('not implemented — wired in Phase 3.2.2');
}
