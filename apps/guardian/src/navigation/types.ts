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

export type ParentStackParamList = {
  ParentTabs: undefined;
  ChildDetails: {childUid: string; childName: string};
};

export type ParentTabsParamList = {
  Children: undefined;
  Settings: undefined;
};

/**
 * P4.5 — ZConnect teacher mode stack.
 *
 * `TeacherHome` is the landing screen (today's assignments + Assign CTA);
 * `TeacherAssign` is the cascading topic picker screen that calls the
 * `assignTopic` callable. The home screen pushes the assign screen via
 * `navigation.navigate('TeacherAssign')` -- no params today, but the
 * `undefined` shape keeps the contract explicit.
 */
export type TeacherStackParamList = {
  TeacherHome: undefined;
  TeacherAssign: undefined;
  /** P4.11 -- per-class study report (aggregated charts + stats). */
  TeacherClassReport: {classId: string; className: string};
  /** P4.11 -- full per-student roster for a class (reached from the report). */
  TeacherClassStudents: {classId: string; className: string};
};
