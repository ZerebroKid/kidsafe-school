import type {DeviceMode, Role} from '../firebase/types';

export type AuthStackParamList = {
  RoleSelector: undefined;
  Login: undefined;
  /**
   * `deviceMode` is only meaningful when `role === 'parent'`. It distinguishes the standard
   * two-device flow from the new shared-phone flow. Child signups always leave it undefined.
   */
  Signup: {role: Role; deviceMode?: DeviceMode};
};

export type ParentStackParamList = {
  ParentTabs: undefined;
  ChildDetails: {childUid: string; childName: string};
  /** Shared-phone first-time setup. Asks the parent for the child's display name. */
  SharedProfileSetup: undefined;
  /** Shared-phone permissions wizard (same OnboardingWizard the child uses on two-device). */
  SharedPermissionsOnboarding: undefined;
};

export type ParentTabsParamList = {
  Children: undefined;
  Settings: undefined;
};

export type ChildStackParamList = {
  Pairing: undefined;
  PermissionsOnboarding: undefined;
  Status: undefined;
};

/**
 * The locked "Child Mode" kiosk routed by `RootNavigator` whenever the device is in shared
 * mode and the parent has flipped Child Mode on. Lives entirely outside the parent
 * navigator so the child cannot back-swipe into it.
 */
export type ChildModeStackParamList = {
  ChildMode: undefined;
  ExitPin: undefined;
  ForgotPin: undefined;
  ChildModeEnded: undefined;
};
