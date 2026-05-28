import type {Role} from '@zerebro/shared-types';

/**
 * ZKid navigation type contracts.
 *
 * Phase 1.6 removed RoleSelector, SharedProfileSetup, ChildModeStackParamList,
 * the SharedPermissionsOnboarding parent screen, and the `deviceMode` Signup
 * param. ZKid is now a single-purpose child app.
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

export type ChildStackParamList = {
  Pairing: undefined;
  // P4.4 -- inserted between Pairing and PermissionsOnboarding. Mounted only
  // when the child has paired (users/{uid}.parentUid set) but has not yet
  // joined a school (users/{uid}.schoolIds is empty / missing). Once the
  // joinSchool callable populates schoolIds, this screen is bypassed forever.
  SchoolStep: undefined;
  PermissionsOnboarding: undefined;
  Status: undefined;
};
