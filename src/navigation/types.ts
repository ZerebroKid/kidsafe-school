import type {Role} from '../firebase/types';

export type AuthStackParamList = {
  RoleSelector: undefined;
  Login: undefined;
  Signup: {role: Role};
};

export type ParentStackParamList = {
  ParentTabs: undefined;
  ChildDetails: {childUid: string; childName: string};
  Schedule: {childUid: string; childName: string};
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
