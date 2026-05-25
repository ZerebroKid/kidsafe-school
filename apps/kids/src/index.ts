// Entry point for ZKid app code. Real implementation lands in P1.3.1.
// For now this exists to verify monorepo Metro + TS resolution works.

import type {Role, UserDocStub} from '@zerebro/shared-types';
import {todayIso} from '@zerebro/shared-utils';

export type ZKidUser = UserDocStub & {primaryRole: Extract<Role, 'child'>};

export const ZKID_BOOTED_AT = todayIso();
