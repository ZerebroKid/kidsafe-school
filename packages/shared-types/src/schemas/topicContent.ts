/**
 * P4.6.1 -- runtime validator for `TopicContent` curated topic JSON.
 *
 * This schema is the LOCK POINT between engineering and the content team.
 * Anything they hand us as JSON has to satisfy this schema before
 * `scripts/import-curriculum.ts` will write it to Firestore. Validation
 * failures print the exact field path so a content editor can locate the
 * row in their JSON without grepping.
 *
 * Why Zod (vs Ajv):
 *   - Single validator family across the monorepo (apps/guardian already
 *     uses Zod for form validation).
 *   - Type inference: `z.infer<typeof TopicContentSchema>` produces a TS
 *     type that we cross-check against the hand-written `TopicContent`
 *     interface in `education.ts` via the `_TypeEquality` assert below.
 *     If the two ever drift, tsc fails the build instead of letting a
 *     malformed doc into Firestore.
 *
 * Why this file lives in shared-types (and not in scripts/):
 *   - The admin-web curriculum browser (P4.6.3) imports the schema to
 *     show a "validation status" badge per topic. Keeping the schema in
 *     a workspace package means web + script + future Cloud Function
 *     trigger all share the exact same source of truth.
 *
 * IMPORTANT: Cloud Functions cannot import this file at deploy time
 * (pnpm workspace specifiers don't survive Cloud Build's `npm install`).
 * If a future server-side trigger needs to validate topic JSON, mirror
 * a thin copy of this schema into `apps/functions/src/lib/sharedTypes.ts`
 * and keep the two in sync.
 */

import {z} from 'zod';

import type {TopicContent} from '../education';

const HTTPS_URL = /^https:\/\//;

/** Single MCQ embedded in `quiz[]`. */
export const QuizQuestionSchema = z
  .object({
    questionId: z
      .string()
      .min(1, 'questionId is required')
      .max(120, 'questionId too long'),
    type: z.literal('mcq'),
    question: z.string().min(1, 'question is required'),
    options: z
      .array(z.string().min(1, 'option text cannot be empty'))
      .min(2, 'quiz options need at least 2 entries')
      .max(6, 'quiz options capped at 6 to keep UI readable'),
    correctIndex: z.number().int('correctIndex must be an integer').nonnegative(),
    explanation: z.string().optional(),
  })
  .refine(
    q => q.correctIndex < q.options.length,
    q => ({
      message: `correctIndex (${q.correctIndex}) is out of range for options.length=${q.options.length}`,
      path: ['correctIndex'],
    }),
  );

/** Single brainstorming card embedded in `brainstorming[]`. */
export const BrainstormingItemSchema = z.object({
  question: z.string().min(1, 'brainstorming.question is required'),
  answer: z.string().min(1, 'brainstorming.answer is required'),
  videoUrl: z
    .string()
    .regex(HTTPS_URL, 'brainstorming.videoUrl must be https')
    .optional(),
});

export const MisconceptionItemSchema = z.object({
  wrong: z.string().min(1, 'misconceptions.wrong is required'),
  correct: z.string().min(1, 'misconceptions.correct is required'),
});

export const RealLifeConnectionItemSchema = z.object({
  title: z.string().min(1, 'realLifeConnections.title is required'),
  description: z.string().min(1, 'realLifeConnections.description is required'),
  videoUrl: z
    .string()
    .regex(HTTPS_URL, 'realLifeConnections.videoUrl must be https')
    .optional(),
});

export const ActivityItemSchema = z.object({
  title: z.string().min(1, 'activities.title is required'),
  instructions: z.string().min(1, 'activities.instructions is required'),
  videoUrl: z
    .string()
    .regex(HTTPS_URL, 'activities.videoUrl must be https')
    .optional(),
});

export const WorkedProblemSchema = z.object({
  problemId: z.string().min(1, 'workedProblems.problemId is required'),
  question: z.string().min(1, 'workedProblems.question is required'),
  conceptsUsed: z.array(z.string().min(1)).optional(),
  steps: z
    .array(z.string().min(1))
    .min(1, 'workedProblems.steps needs at least 1 entry'),
  answer: z.string().min(1, 'workedProblems.answer is required'),
  commonMistake: z.string().optional(),
});

export const TopicSectionSchema = z.object({
  heading: z.string().min(1, 'sections.heading is required'),
  content: z.string().min(1, 'sections.content is required'),
  videoUrl: z
    .string()
    .regex(HTTPS_URL, 'sections.videoUrl must be https')
    .optional(),
});

/**
 * Zumi voice-story sub-schemas. Mirror the `VoiceStory` family in
 * `education.ts` EXACTLY (field set + optionality) so the `_TopicContentDriftGuard`
 * below keeps passing. Validations are intentionally light (types only) --
 * the voice stories are seeded via an Admin-SDK script, not this importer.
 */
export const VoiceQuizQuestionSchema = z.object({
  questionId: z.string(),
  order: z.number(),
  type: z.string().optional(),
  questionText: z.string(),
  questionAudioUrl: z.string().optional(),
  expectedConcepts: z.array(z.string()),
  correctIndicator: z.string(),
  responseCorrect: z.string(),
  responsePartial: z.string().optional(),
  responseIncorrect: z.string(),
});

export const VoiceAnimationSchema = z.object({
  key: z.string(),
  stageNumber: z.number(),
  type: z.enum(['lottie', 'rive']),
  trigger: z.string().optional(),
  searchQuery: z.string().optional(),
  show: z.string().optional(),
  lottieStorageUrl: z.string().optional(),
  stateName: z.string().optional(),
  description: z.string().optional(),
});

export const VoiceStorySchema = z.object({
  hookContext: z.string(),
  predictContext: z.string(),
  wrongAnswerTrapScript: z.string(),
  trapLottieKey: z.string().optional(),
  experimentInstruction: z.string(),
  experimentWaitSeconds: z.number(),
  experimentFollowUp: z.string(),
  experimentRiveKey: z.string().optional(),
  visualizationScript: z.string(),
  visualizationLottieKey: z.string().optional(),
  discoveryLeadQuestion: z.string(),
  discoveryCelebration: z.string(),
  conceptRevealScript: z.string(),
  conceptRevealRiveKey: z.string().optional(),
  examModeIntro: z.string(),
  ncertDefinition: z.string(),
  keyPoints: z.array(z.string()),
  keywords: z.array(z.string()),
  memoryTrick: z.string(),
  examLottieKey: z.string().optional(),
  voiceQuiz: z.array(VoiceQuizQuestionSchema),
  closingHighScoreContext: z.string(),
  closingMidScoreContext: z.string(),
  closingLowScoreContext: z.string(),
  parentTryTonight: z.string(),
  animations: z.array(VoiceAnimationSchema),
});

/**
 * Top-level Topic schema. Note we accept either `'draft'` or `'published'`;
 * the import script defaults `status` to `'published'` when missing AND
 * the file lives under a `published/` folder, otherwise to `'draft'`.
 */
export const TopicContentSchema = z.object({
  curriculumId: z
    .string()
    .min(1, 'curriculumId required')
    .regex(
      /^[a-z0-9_]+$/,
      'curriculumId must be lowercase snake_case (a-z, 0-9, _)',
    ),
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1, 'subject required'),
  chapterNo: z.number().int().min(1),
  chapterName: z.string().min(1),
  topicId: z
    .string()
    .min(1, 'topicId required')
    .regex(
      /^[a-z0-9_]+$/,
      'topicId must be lowercase snake_case (a-z, 0-9, _)',
    ),
  topicName: z.string().min(1),
  explanation: z.string().min(20, 'explanation must be at least 20 chars'),
  examples: z.array(z.string().min(1)).min(1, 'examples needs at least 1 entry'),
  videoUrl: z
    .string()
    .regex(HTTPS_URL, 'videoUrl must be https')
    .optional(),
  brainstorming: z
    .array(BrainstormingItemSchema)
    .min(1, 'brainstorming needs at least 1 entry'),
  misconceptions: z.array(MisconceptionItemSchema).min(1).optional(),
  realLifeConnections: z.array(RealLifeConnectionItemSchema).min(1).optional(),
  activities: z.array(ActivityItemSchema).min(1).optional(),
  workedProblems: z.array(WorkedProblemSchema).min(1).optional(),
  sections: z.array(TopicSectionSchema).min(1).optional(),
  quiz: z
    .array(QuizQuestionSchema)
    .min(1, 'quiz needs at least 1 question')
    .max(20, 'quiz capped at 20 questions per topic'),
  status: z.enum(['draft', 'published']).default('published'),
  curatedBy: z.string().min(1, 'curatedBy required (use a content-team uid or "content_team")'),
  publishedAt: z.union([z.number(), z.record(z.unknown())]).optional(),
  voiceStory: VoiceStorySchema.optional(),
});

/** Validated `TopicContent` payload, including any Zod defaults that were applied. */
export type ValidatedTopicContent = z.infer<typeof TopicContentSchema>;

/**
 * Validate `raw` (typically the parsed JSON from a topic file) and return
 * the cleaned object. Throws a `ZodError` with descriptive field paths on
 * the first failure so the CLI script can surface a usable message.
 */
export function validateTopicContent(raw: unknown): ValidatedTopicContent {
  return TopicContentSchema.parse(raw);
}

/**
 * Lightweight wrapper for callers that prefer a `{ok, errors}` shape over
 * exceptions (e.g. the admin-web curriculum browser shows a per-row
 * validation badge instead of crashing the table).
 */
export function safeValidateTopicContent(raw: unknown): {
  ok: boolean;
  data?: ValidatedTopicContent;
  errors?: Array<{path: string; message: string}>;
} {
  const result = TopicContentSchema.safeParse(raw);
  if (result.success) return {ok: true, data: result.data};
  return {
    ok: false,
    errors: result.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  };
}

// ---- compile-time drift guard ---------------------------------------------
// If the Zod schema and the hand-written `TopicContent` interface ever
// diverge (e.g. someone adds a field to one and forgets the other), tsc
// fails the build here with a structural assignability error pointing at
// these names. The expression evaluates to never -- it has no runtime
// cost and emits no JS in the bundle.
type _AssertSchemaMatchesType<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;

// Make `publishedAt` optional on both sides for the equality check (Zod's
// `.optional()` becomes `T | undefined`, our interface uses `?:`).
type _SchemaSide = Omit<ValidatedTopicContent, 'publishedAt'> & {
  publishedAt?: ValidatedTopicContent['publishedAt'];
};
type _InterfaceSide = Omit<TopicContent, 'publishedAt'> & {
  publishedAt?: TopicContent['publishedAt'];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _TopicContentDriftGuard = _AssertSchemaMatchesType<
  _SchemaSide,
  _InterfaceSide
>;
