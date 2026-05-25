import type {Role} from '@zerebro/shared-types';

/**
 * ZConnect (parent + teacher) navigation type contracts.
 *
 * Phase 1.6 removed the v1 shared-mode types (`DeviceMode`, `SharedProfileSetup`,
 * `SharedPermissionsOnboarding`, `ChildModeStackParamList`). The route names
 * still exist in the legacy `@zerebro/shared-types` to keep historical Firestore
 * docs typed; once Phase 1.6.x finishes the schema cleanup they'll be gone
 * from the shared package too.
 */

export type AuthStackParamList = {
  Login: undefined;
  Signup: {role: Role};
};

export type ParentStackParamList = {
  ParentTabs: undefined;
  ChildDetails: {childUid: string; childName: string};
};

export type ParentTabsParamList = {
  Children: undefined;
  Settings: undefined;
};
