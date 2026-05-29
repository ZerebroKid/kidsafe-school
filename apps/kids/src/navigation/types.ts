import type {Role, SubmitQuizAttemptOutput} from '@zerebro/shared-types';

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
    topicName: string;
  };
  QuizResult: {
    result: SubmitQuizAttemptOutput;
    topicName: string;
    // Re-entry params so a failed quiz can offer "Try again" without going back.
    assignmentId: string;
    curriculumId: string;
    chapterId: string;
    topicId: string;
  };
  RewardUnlock: {
    attemptId: string;
    topicName: string;
  };
  RewardWebView: {
    url: string;
    title?: string;
  };
  VideoPlayer: {
    videoUrl: string;
    title?: string;
  };
};
