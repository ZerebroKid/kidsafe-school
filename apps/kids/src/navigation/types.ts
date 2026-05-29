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
  SchoolStep: undefined;
  PermissionsOnboarding: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  StudyTab: undefined;
};

export type StudyStackParamList = {
  StudyMission: undefined;
  TopicLearn: {
    assignmentId: string;
    curriculumId: string;
    chapterId: string;
    topicId: string;
    topicName: string;
  };
  Quiz: {
    assignmentId: string;
    curriculumId: string;
    chapterId: string;
    topicId: string;
  };
  VideoPlayer: {
    videoUrl: string;
    title?: string;
  };
};
