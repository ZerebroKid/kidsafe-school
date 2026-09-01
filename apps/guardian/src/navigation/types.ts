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
  /** P4.3 -- new phone-OTP flow; ZConnect's default entry. */
  PhoneLogin: undefined;
  /**
   * P4.3 -- after `signInWithPhoneNumber` succeeds we navigate here with the
   * confirmation handle serialised as the verificationId so the next screen
   * can call `auth().PhoneAuthProvider.credential(verificationId, code)`.
   * (The full `confirmation` object isn't a plain serialisable object so we
   * can't pass it through React Navigation params; ferrying the
   * verificationId + phone preserves the type contract.)
   */
  PhoneConfirm: {verificationId: string; phone: string};
};

export type ParentTabsParamList = {
  ParentHomeTab: undefined;
  ParentControlsTab: {childUid?: string; childName?: string} | undefined;
  ParentReportsTab: {childUid?: string; childName?: string} | undefined;
  ParentSettingsTab: undefined;
  /** Legacy alias for backwards compatibility */
  Children: undefined;
  Settings: undefined;
};

export type ParentStackParamList = {
  ParentTabs: undefined;
  ChildDetails: {childUid: string; childName?: string; initialTab?: string};
  JoinSchool: undefined;
  ParentHome: undefined;
  ParentControls: {childUid?: string; childName?: string} | undefined;
  ParentReports: {childUid?: string; childName?: string} | undefined;
  ParentSettings: undefined;
  Controls: {childUid?: string; childName?: string} | undefined;
  Reports: {childUid?: string; childName?: string} | undefined;
  Settings: undefined;
  Schedule: {childUid?: string} | undefined;
  Apps: {childUid?: string} | undefined;
  Location: {childUid?: string} | undefined;
  ReelsInsights: {childUid?: string} | undefined;
  Study: {childUid?: string} | undefined;
  Pin: {childUid?: string} | undefined;
};

export type TeacherTabsParamList = {
  TeacherHomeTab: undefined;
  TeacherClassesTab: undefined;
  TeacherReportsTab: undefined;
  TeacherMoreTab: undefined;
};

/**
 * Teacher mode stack navigation contracts.
 */
export type TeacherStackParamList = {
  TeacherTabs: undefined;
  TeacherHome: undefined;
  TeacherClasses: undefined;
  TeacherClassDetail: {
    classId: string;
    className: string;
    subject?: string;
    grade?: number;
    section?: string;
    board?: string;
  };
  TeacherAssign:
    | {
        classId?: string;
        className?: string;
        curriculumId?: string;
        chapterId?: string;
        chapterName?: string;
        initialTopics?: Array<{
          id: string;
          name: string;
          chapterId?: string;
          chapterName?: string;
        }>;
      }
    | undefined;
  TeacherLiveQuiz: {
    classId: string;
    className: string;
    chapterName?: string;
    roomCode?: string;
  };
  TeacherDone: {
    kind: 'assign' | 'quiz';
    classId?: string;
    className: string;
    summary: string;
  };
  TeacherReports: undefined;
  TeacherClassReport: {classId: string; className: string};
  TeacherClassStudents: {classId: string; className: string};
  TeacherStudentsNeedingHelp: undefined;
  TeacherStudentDetail: {
    studentUid?: string;
    studentName: string;
    rollNo?: string;
    classId?: string;
    className?: string;
    score?: number;
  };
  TeacherNotifications: undefined;
  TeacherMore: undefined;
};
