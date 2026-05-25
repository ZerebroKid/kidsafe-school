// Entry point for ZConnect app code. Real implementation lands in P1.4.x
// (parent screens) and P4.3.x / P4.5.x (teacher mode).

import type {Role, UserDocStub} from '@zerebro/shared-types';

export type ZConnectUser = UserDocStub & {
  primaryRole: Extract<Role, 'parent' | 'teacher'>;
};
