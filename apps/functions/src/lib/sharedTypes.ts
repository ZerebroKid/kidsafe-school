/**
 * Local copies of the few shared types this Functions package needs.
 *
 * WHY DUPLICATE INSTEAD OF IMPORTING from `@zerebro/shared-types`:
 *   Firebase Functions deploys upload only this directory (`apps/functions/`)
 *   to Cloud Build, which then runs `npm install` against the uploaded
 *   `package.json`. npm cannot resolve pnpm workspace specifiers like
 *   `workspace:*`, so even a type-only `import` forces us to keep the dep
 *   in `package.json`, which breaks Cloud Build. A `paths` mapping to
 *   `../../packages/shared-types` is rejected by tsc because the file
 *   ends up outside `rootDir`. The path of least resistance is to keep a
 *   small, well-fenced duplicate here -- this file is the ONLY allowed
 *   place to do so. Drift policy: any change here MUST be mirrored in
 *   [packages/shared-types/src/education.ts](../../../../packages/shared-types/src/education.ts)
 *   (and `firestore.ts` for `Role`).
 */

export type Role = 'admin' | 'principal' | 'teacher' | 'parent' | 'child';

// ---------------------------------------------------------------------------
// P4.5.1 -- assignTopic I/O contracts. Mirror of the same interfaces in
// @zerebro/shared-types/education.ts -- keep these IN SYNC.
// ---------------------------------------------------------------------------

export interface AssignTopicInput {
  schoolId: string;
  classId: string;
  curriculumId: string;
  chapterId: string;
  topicId: string;
  /** Epoch ms in UTC. Must be >= now AND <= now + 30 days (callable-enforced). */
  dueAt: number;
}

export interface AssignTopicOutput {
  assignmentId: string;
  alreadyExisted: boolean;
}

// ---------------------------------------------------------------------------
// P4.9.2 -- submitQuizAttempt I/O contracts. Mirror of the same interfaces in
// @zerebro/shared-types/education.ts -- keep these IN SYNC.
// ---------------------------------------------------------------------------

export interface QuizAnswerInput {
  questionId: string;
  selectedIndex: number;
}

/** Mirror of @zerebro/shared-types VoiceAnswerInput. */
export interface VoiceAnswerInput {
  questionId: string;
  transcript: string;
}

export interface SubmitQuizAttemptInput {
  assignmentId: string;
  answers: QuizAnswerInput[];
  mode?: 'mcq' | 'voice';
  voiceAnswers?: VoiceAnswerInput[];
}

/** Mirror of @zerebro/shared-types VoiceQuizQuestion (server reads from voiceStory). */
export interface VoiceQuizQuestion {
  questionId: string;
  order: number;
  type?: string;
  questionText: string;
  questionAudioUrl?: string;
  expectedConcepts: string[];
  correctIndicator: string;
  responseCorrect: string;
  responsePartial?: string;
  responseIncorrect: string;
}

/** Mirror of @zerebro/shared-types VoiceQuestionResult. */
export interface VoiceQuestionResult {
  questionId: string;
  transcript: string;
  result: 'correct' | 'partial' | 'incorrect';
  score: number;
  reasoning?: string;
}

/** Server-written authoritative verdict for one voice quiz answer. */
export interface VoiceEvalRecord {
  result: 'correct' | 'partial' | 'incorrect';
  score: number;
  transcript: string;
  reasoning?: string;
  evaluatedAt: number;
}

// ---------------------------------------------------------------------------
// Zumi Phase A — session signals (mirror of zumiTranscriptStore types).
// ---------------------------------------------------------------------------

export interface ZumiIncomingSignals {
  emptyResponseCount?: number;
  speechDurationMs?: number;
  pauseCount?: number;
  speakingSpeedWpm?: number;
}

export interface ZumiSessionSignals {
  emptyResponseCount: number;
  totalUserTurns: number;
  lastSpeechDurationMs?: number;
  lastPauseCount?: number;
  lastSpeakingSpeedWpm?: number;
  engagementScore: number;
}

export interface QuizQuestionResult {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation?: string;
}

export interface SubmitQuizAttemptOutput {
  attemptId: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  firstPass: boolean;
  results: QuizQuestionResult[];
}

// ---------------------------------------------------------------------------
// P4.10.2 -- reward types the onQuizAttemptWrite trigger needs. Mirror of
// RewardType / RewardDoc fields in @zerebro/shared-types/education.ts.
// ---------------------------------------------------------------------------

export type RewardType = 'youtube_link' | 'game_link' | 'article_link';

// ---------------------------------------------------------------------------
// Phase 5 -- Subscription types. Mirror of interfaces in
// packages/shared-types/src/subscription.ts -- keep IN SYNC.
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired';

export interface SubscriptionDoc {
  razorpaySubscriptionId: string;
  razorpayCustomerId: string | null;
  razorpayPlanId: string;
  status: SubscriptionStatus;
  quantity: number;
  amountPerStudent: number;
  totalAmount: number;
  currentPeriodStart: unknown;
  currentPeriodEnd: unknown;
  nextChargeAt: unknown;
  lastChargeFailedAt: unknown;
  gracePeriodEnd: unknown;
  pendingQuantity: number | null;
  hasScheduledChanges: boolean;
  manuallyActivated: boolean;
  manuallyActivatedBy: string | null;
  manuallyActivatedUntil: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  cancelledAt: unknown;
}

export interface CreateSubscriptionInput {
  schoolId: string;
}

export interface CreateSubscriptionOutput {
  subscriptionId: string;
  shortUrl: string;
  amount: number;
  quantity: number;
  alreadyActive?: boolean;
}

export interface GetSubscriptionStatusInput {
  schoolId: string;
}

export interface GetSubscriptionStatusOutput {
  exists: boolean;
  isActive: boolean;
  subscription: SubscriptionDoc | null;
  graceRemainingHours: number | null;
  studentCount: number | null;
}

export interface UpdateStudentCountInput {
  schoolId: string;
  newCount: number;
}

export interface UpdateStudentCountOutput {
  newCount: number;
  effectiveFrom: 'next_cycle' | 'immediate';
  newMonthlyAmount: number;
}

export interface CancelSubscriptionInput {
  schoolId: string;
  reason?: string;
}

export interface CancelSubscriptionOutput {
  cancelled: boolean;
  alreadyCancelled?: boolean;
  cancelledAt: unknown;
}

export interface AdminActivateInput {
  schoolId: string;
  until: string | number | null;
}

export interface AdminActivateOutput {
  activated: boolean;
  deactivated: boolean;
  activatedUntil: unknown;
}
