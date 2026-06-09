/**
 * Generator for CBSE Class 8 Math Chapter 2 (Powers) topic JSON files.
 * Run: node scripts/generate-cbse-8-math-powers.js
 */
const fs = require('fs');
const path = require('path');
const {z} = require('zod');

const OUT_DIR = path.join(
  __dirname,
  '..',
  'content',
  'cbse_8',
  'cbse_8_math',
  'powers',
  'topics',
);

const HTTPS_URL = /^https:\/\//;
const BASE = {
  curriculumId: 'cbse_8_math',
  grade: 8,
  subject: 'math',
  chapterNo: 2,
  chapterName: 'Powers',
  status: 'published',
  curatedBy: 'content_team',
};

const VIDEOS = {
  intro: 'https://www.youtube.com/watch?v=Vp8katZHA1g',
  figureItOut: 'https://www.youtube.com/watch?v=5uUry2gPqSk',
  part2: 'https://www.youtube.com/watch?v=23OvTcFQUyg',
  fullChapter: 'https://www.youtube.com/watch?v=3ahRLeWJeZo',
};

// --- schema (mirrors packages/shared-types/src/schemas/topicContent.ts) ---
const QuizQuestionSchema = z
  .object({
    questionId: z.string().min(1).max(120),
    type: z.literal('mcq'),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().optional(),
  })
  .refine(
    q => q.correctIndex < q.options.length,
    q => ({message: `correctIndex out of range`, path: ['correctIndex']}),
  );

const TopicContentSchema = z.object({
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
  brainstorming: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        videoUrl: z.string().regex(HTTPS_URL).optional(),
      }),
    )
    .min(1),
  misconceptions: z
    .array(z.object({wrong: z.string().min(1), correct: z.string().min(1)}))
    .min(1)
    .optional(),
  realLifeConnections: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        videoUrl: z.string().regex(HTTPS_URL).optional(),
      }),
    )
    .min(1)
    .optional(),
  activities: z
    .array(
      z.object({
        title: z.string().min(1),
        instructions: z.string().min(1),
        videoUrl: z.string().regex(HTTPS_URL).optional(),
      }),
    )
    .min(1)
    .optional(),
  workedProblems: z
    .array(
      z.object({
        problemId: z.string().min(1),
        question: z.string().min(1),
        conceptsUsed: z.array(z.string().min(1)).optional(),
        steps: z.array(z.string().min(1)).min(1),
        answer: z.string().min(1),
        commonMistake: z.string().optional(),
      }),
    )
    .min(1)
    .optional(),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        content: z.string().min(1),
        videoUrl: z.string().regex(HTTPS_URL).optional(),
      }),
    )
    .min(1)
    .optional(),
  quiz: z.array(QuizQuestionSchema).min(1).max(20),
  status: z.enum(['draft', 'published']).default('published'),
  curatedBy: z.string().min(1),
  publishedAt: z.union([z.number(), z.record(z.unknown())]).optional(),
});

// --- helpers ---
function mcq(id, question, options, correctIndex, explanation) {
  return {questionId: id, type: 'mcq', question, options, correctIndex, explanation};
}

function bs(question, answer, videoUrl) {
  const item = {question, answer};
  if (videoUrl) item.videoUrl = videoUrl;
  return item;
}

function wp(problemId, question, steps, answer, extra = {}) {
  return {problemId, question, steps, answer, ...extra};
}

function teachingExtras({misconceptions, realLifeConnections, activities}) {
  return {misconceptions, realLifeConnections, activities};
}

function makeQuiz7(prefix, items) {
  return items.map((item, i) =>
    mcq(`${prefix}_q${i + 1}`, item.q, item.o, item.c, item.e),
  );
}

// --- topic definitions loaded from data module ---
const {TOPICS} = require('./generate-cbse-8-math-powers-data');

function main() {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  const created = [];
  const issues = [];

  for (const topic of TOPICS) {
    const file = path.join(OUT_DIR, `${topic.topicId}.json`);
    const payload = {...BASE, ...topic};
    const result = TopicContentSchema.safeParse(payload);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          file: `${topic.topicId}.json`,
          path: issue.path.join('.'),
          message: issue.message,
        });
      }
      continue;
    }
    fs.writeFileSync(file, JSON.stringify(result.data, null, 2) + '\n');
    created.push(`${topic.topicId}.json`);
  }

  console.log(`\nCreated ${created.length} topic files in:\n  ${OUT_DIR}\n`);
  for (const f of created) console.log(`  ✓ ${f}`);
  if (issues.length) {
    console.log(`\nValidation issues (${issues.length}):`);
    for (const i of issues) console.log(`  ✗ ${i.file} → ${i.path}: ${i.message}`);
  } else {
    console.log('\nAll files passed schema validation.');
  }
}

main();
