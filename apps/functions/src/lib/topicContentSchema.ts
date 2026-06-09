/**
 * P4.6.1 -- LOCAL DUPLICATE of the canonical TopicContent Zod schema.
 *
 * WHY DUPLICATE INSTEAD OF IMPORTING from `@zerebro/shared-types`:
 *   Same reason as `sharedTypes.ts` (read that file's header first).
 *   Firebase Cloud Build runs `npm install` against this directory's
 *   `package.json` and cannot resolve pnpm workspace specifiers like
 *   `workspace:*`. Even if today's only consumer is a NEVER-DEPLOYED
 *   script (`scripts/importCurriculum.ts`), the next callable that wants
 *   to validate topic JSON server-side would force us to either:
 *     a) ship a broken deploy (Cloud Build can't resolve shared-types), or
 *     b) duplicate the schema then.
 *   We do (b) up front to keep the policy consistent.
 *
 * DRIFT POLICY: any change here MUST be mirrored in the canonical schema
 * at [packages/shared-types/src/schemas/topicContent.ts](../../../../packages/shared-types/src/schemas/topicContent.ts).
 * The shape is small (one file, < 150 lines) so the maintenance cost is
 * tiny relative to the deploy-time pain a drift would cause.
 */

import {z} from 'zod';

const HTTPS_URL = /^https:\/\//;

export const QuizQuestionSchema = z
  .object({
    questionId: z.string().min(1).max(120),
    type: z.literal('mcq'),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().optional(),
  })
  .refine(q => q.correctIndex < q.options.length, q => ({
    message: `correctIndex (${q.correctIndex}) out of range for options.length=${q.options.length}`,
    path: ['correctIndex'],
  }));

export const BrainstormingItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  videoUrl: z.string().regex(HTTPS_URL).optional(),
});

export const MisconceptionItemSchema = z.object({
  wrong: z.string().min(1),
  correct: z.string().min(1),
});

export const RealLifeConnectionItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  videoUrl: z.string().regex(HTTPS_URL).optional(),
});

export const ActivityItemSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
  videoUrl: z.string().regex(HTTPS_URL).optional(),
});

export const WorkedProblemSchema = z.object({
  problemId: z.string().min(1),
  question: z.string().min(1),
  conceptsUsed: z.array(z.string().min(1)).optional(),
  steps: z.array(z.string().min(1)).min(1),
  answer: z.string().min(1),
  commonMistake: z.string().optional(),
});

export const TopicSectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
  videoUrl: z.string().regex(HTTPS_URL).optional(),
});

export const TopicContentSchema = z.object({
  curriculumId: z.string().min(1).regex(/^[a-z0-9_]+$/),
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  chapterNo: z.number().int().min(1),
  chapterName: z.string().min(1),
  topicId: z.string().min(1).regex(/^[a-z0-9_]+$/),
  topicName: z.string().min(1),
  explanation: z.string().min(20),
  examples: z.array(z.string().min(1)).min(1),
  videoUrl: z.string().regex(HTTPS_URL).optional(),
  brainstorming: z.array(BrainstormingItemSchema).min(1),
  misconceptions: z.array(MisconceptionItemSchema).min(1).optional(),
  realLifeConnections: z.array(RealLifeConnectionItemSchema).min(1).optional(),
  activities: z.array(ActivityItemSchema).min(1).optional(),
  workedProblems: z.array(WorkedProblemSchema).min(1).optional(),
  sections: z.array(TopicSectionSchema).min(1).optional(),
  quiz: z.array(QuizQuestionSchema).min(1).max(20),
  status: z.enum(['draft', 'published']).default('published'),
  curatedBy: z.string().min(1),
  publishedAt: z.union([z.number(), z.record(z.unknown())]).optional(),
});

export type ValidatedTopicContent = z.infer<typeof TopicContentSchema>;

/** Throws ZodError with field paths on first failure. */
export function validateTopicContent(raw: unknown): ValidatedTopicContent {
  return TopicContentSchema.parse(raw);
}
