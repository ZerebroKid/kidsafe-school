import type {Role, SubmitQuizAttemptOutput} from '@zerebro/shared-types';

/**
 * ZKid navigation type contracts.
 *
 * Phase 1.6 removed RoleSelector, SharedProfileSetup, ChildModeStackParamList,
 * the SharedPermissionsOnboarding parent screen, and the `deviceMode` Signup
 * param. ZKid is now a single-purpose child app.
 *
 * Phase 4 (Class 6–12 UI):
 *  - Added Main612TabParamList — 5-tab bottom nav for grade 7+ children.
 *  - Extended StudyStackParamList with SubjectList, SubjectDetail, TopicDetail.
 *  - Fun-mode tab list is preserved unchanged (MainTabParamList).
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

/** Fun-mode (grade ≤ 6) stack — replacing the bottom tabs. */
export type JuniorStackParamList = {
  KidHome: undefined;
  KidFun: undefined;
  KidCartoons: undefined;
  KidReels: undefined;
  KidGames: undefined;
  ZumiHome: {sessionDone?: boolean} | undefined;
  ZumiVoice: {
    assignmentId: string;
    curriculumId: string;
    chapterId: string;
    topicId: string;
    topicName: string;
  };
};

/**
 * Class 6–12 bottom tabs (grade 7+).
 * 5-tab nav: Home · Study · Quiz · Rewards · Profile.
 */
export type Main612TabParamList = {
  HomeTab612: undefined;
  StudyTab: undefined;
  QuizTab: undefined;
  RewardsTab: undefined;
  ProfileTab: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  ChooseWorld: undefined;
  FocusMode: undefined;
  ExamPredictor: undefined;
};

export type StudyStackParamList = {
  /** Class 6–12 subject list (grade 7+). Root for !isFunMode. */
  SubjectList: undefined;
  /** Subject detail — chapter list for a given subject. */
  SubjectDetail: {
    subjectName: string;
    subjectLabel: string;
  };
  /** Topic detail — 7-section journey for a single topic (Class 6–12). */
  TopicDetail: {
    assignmentId: string;
    curriculumId: string;
    chapterId: string;
    topicId: string;
    topicName: string;
    chapterName?: string;
    subjectName?: string;
  };
  StudyMission: undefined;
  /**
   * Fun-mode (grade ≤ 6) landing: opens Zumi the character directly.
   * `sessionDone` is set by ZumiVoice on the way back: true = the session
   * reached its natural end (celebrate), false/absent = aborted early.
   */
  ZumiHome: {sessionDone?: boolean} | undefined;
  TopicLearn: {
    assignmentId: string;
    curriculumId: string;
    chapterId: string;
    topicId: string;
    topicName: string;
    sectionNum?: number;
  };
  /** Zumi voice "Fun" session (grade <= 6 topics with a voiceStory). */
  ZumiVoice: {
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
  /** Reels — vertical short-video feed (Fun mode, grade <= 6). */
  Reels: undefined;
  FocusMode: undefined;
  ExamPredictor: undefined;
  Settings: undefined;
  ChooseWorld: undefined;
};
