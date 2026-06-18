/**
 * Seed the Zumi voice "Fun" content -- the 14 Class 3 Science discovery
 * stories -- into Firestore as published `TopicContent` docs.
 *
 * Each chapter in `content/voice_stories/class3_science_stories_FINAL.json`
 * becomes ONE topic under:
 *
 *   curriculum/cbse_3_science                                    (upsert)
 *   curriculum/cbse_3_science/chapters/{chapterId}               (upsert)
 *   curriculum/cbse_3_science/chapters/{chapterId}/topics/{topicId}
 *
 * The topic doc carries BOTH:
 *   - the standard `TopicContent` fields (explanation, examples, brainstorming,
 *     a small derived MCQ `quiz[]`) synthesised from the story so the doc is
 *     schema-valid, assignable, and degrades to the normal lesson screen, AND
 *   - the full `voiceStory` (the 10 stages) mapped from the curated JSON's
 *     actual field names to the normalised `VoiceStory` shape.
 *
 * The standard fields are validated with `validateTopicContent` (which now
 * knows about `voiceStory`). Idempotent: re-running merges and only stamps
 * `publishedAt` on the first publish, mirroring `importCurriculum.ts`.
 *
 * Usage (from monorepo root):
 *   pnpm seed:voice-stories                      # dry-run, emulator
 *   pnpm seed:voice-stories -- --apply           # apply, emulator
 *   pnpm seed:voice-stories -- --apply --target=prod
 *   pnpm seed:voice-stories -- --file=./content/voice_stories/class3_science_stories_FINAL.json
 */

import * as fs from 'fs';
import * as path from 'path';

import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import type {ZodError} from 'zod';

import {initScriptAdmin, parseBaseFlags, type BaseFlags} from './lib/scriptInit';
import {validateTopicContent} from '../lib/topicContentSchema';

const CURRICULUM_ID = 'cbse_3_science';
const GRADE = 3;
const SUBJECT = 'science';

interface SeedFlags extends BaseFlags {
  file: string;
}

interface Counts {
  chapters: number;
  topics: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Raw JSON shapes (the curated field names, NOT the normalised VoiceStory)
// ---------------------------------------------------------------------------

interface RawAnimation {
  search_query?: string;
  trigger?: string;
  show?: string;
  state_name?: string;
  description?: string;
}

interface RawQuizQuestion {
  order: number;
  type?: string;
  question_text: string;
  expected_concepts?: string[];
  correct_indicator?: string;
  response_correct?: string;
  response_partial?: string;
  response_incorrect?: string;
}

interface RawChapter {
  chapter_number: number;
  chapter_title: string;
  unit?: string;
  ncert_topics?: string[];
  animations?: Record<string, RawAnimation>;
  stage_1_hook?: {ai_system_context?: string};
  stage_2_predict?: {ai_system_context?: string};
  stage_3_wrong_answer_trap?: {script?: string; lottie_trigger?: string};
  stage_4_experiment?: {
    instruction_script?: string;
    wait_seconds?: number;
    follow_up_script?: string;
    rive_trigger?: string;
  };
  stage_5_visualization?: {script?: string; lottie_trigger?: string};
  stage_6_discovery?: {lead_question_script?: string; celebration_script?: string};
  stage_7_concept_reveal?: {script?: string; rive_trigger?: string};
  stage_8_exam_mode?: {
    intro_script?: string;
    ncert_definition?: string;
    key_points?: string[];
    keywords?: string[];
    memory_trick?: string;
    lottie_trigger?: string;
  };
  stage_9_quiz?: {questions?: RawQuizQuestion[]};
  stage_10_closing?: {
    ai_context_high_score?: string;
    ai_context_mid_score?: string;
    ai_context_low_score?: string;
    parent_try_tonight?: string;
  };
}

interface RawFile {
  chapters?: RawChapter[];
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

function parseSeedFlags(argv: string[]): SeedFlags {
  const base = parseBaseFlags(argv);
  // Default path: monorepo-root content folder. After build, __dirname is
  // apps/functions/dist/scripts -> four `..` to the repo root.
  let file = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'content',
    'voice_stories',
    'class3_science_stories_FINAL.json',
  );
  for (const arg of argv) {
    if (arg.startsWith('--file=')) {
      const p = arg.slice('--file='.length);
      file = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    }
  }
  return {...base, file};
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** lowercase snake_case slug constrained to the schema's `^[a-z0-9_]+$`. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/** Parse the stage number out of an animation key like `stage_3_lottie`. */
function stageNumberFromKey(key: string): number {
  const m = key.match(/stage_(\d+)/);
  return m ? Number(m[1]) : 0;
}

interface NormalisedAnimation {
  key: string;
  stageNumber: number;
  type: 'lottie' | 'rive';
  trigger?: string;
  searchQuery?: string;
  show?: string;
  stateName?: string;
  description?: string;
}

function normaliseAnimations(
  raw: Record<string, RawAnimation> | undefined,
): NormalisedAnimation[] {
  if (!raw) return [];
  return Object.entries(raw).map(([key, val]) => {
    const isRive = key.toLowerCase().includes('rive') || !!val.state_name;
    const base: NormalisedAnimation = {
      key,
      stageNumber: stageNumberFromKey(key),
      type: isRive ? 'rive' : 'lottie',
    };
    if (val.trigger) base.trigger = val.trigger;
    if (isRive) {
      if (val.state_name) base.stateName = val.state_name;
      if (val.description) base.description = val.description;
    } else {
      if (val.search_query) base.searchQuery = val.search_query;
      if (val.show) base.show = val.show;
    }
    return base;
  });
}

/**
 * Resolve a stage's `*_trigger` value to the matching animation KEY. Triggers
 * reference either the animation key directly (e.g. `stage_3_lottie`) or a
 * Rive `state_name` (e.g. `sort_game`, `concept_zoom`). Returns undefined when
 * nothing matches so the screen simply plays no animation.
 */
function resolveAnimationKey(
  trigger: string | undefined,
  anims: NormalisedAnimation[],
): string | undefined {
  if (!trigger) return undefined;
  const byKey = anims.find(a => a.key === trigger);
  if (byKey) return byKey.key;
  const byState = anims.find(a => a.stateName === trigger);
  return byState?.key;
}

function str(v: string | undefined, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
}

function buildVoiceStory(chapter: RawChapter, chapterId: string) {
  const anims = normaliseAnimations(chapter.animations);
  const questions = chapter.stage_9_quiz?.questions ?? [];

  const voiceQuiz = questions.map((q, idx) => ({
    questionId: `${chapterId}_q${q.order ?? idx + 1}`,
    order: typeof q.order === 'number' ? q.order : idx + 1,
    ...(q.type ? {type: q.type} : {}),
    questionText: str(q.question_text),
    expectedConcepts: Array.isArray(q.expected_concepts)
      ? q.expected_concepts
      : [],
    correctIndicator: str(q.correct_indicator),
    responseCorrect: str(q.response_correct),
    ...(q.response_partial ? {responsePartial: q.response_partial} : {}),
    responseIncorrect: str(q.response_incorrect),
  }));

  const s4 = chapter.stage_4_experiment ?? {};
  const s8 = chapter.stage_8_exam_mode ?? {};
  const s10 = chapter.stage_10_closing ?? {};

  const story: Record<string, unknown> = {
    hookContext: str(chapter.stage_1_hook?.ai_system_context),
    predictContext: str(chapter.stage_2_predict?.ai_system_context),
    wrongAnswerTrapScript: str(chapter.stage_3_wrong_answer_trap?.script),
    experimentInstruction: str(s4.instruction_script),
    experimentWaitSeconds:
      typeof s4.wait_seconds === 'number' ? s4.wait_seconds : 20,
    experimentFollowUp: str(s4.follow_up_script),
    visualizationScript: str(chapter.stage_5_visualization?.script),
    discoveryLeadQuestion: str(chapter.stage_6_discovery?.lead_question_script),
    discoveryCelebration: str(chapter.stage_6_discovery?.celebration_script),
    conceptRevealScript: str(chapter.stage_7_concept_reveal?.script),
    examModeIntro: str(s8.intro_script),
    ncertDefinition: str(s8.ncert_definition),
    keyPoints: Array.isArray(s8.key_points) ? s8.key_points : [],
    keywords: Array.isArray(s8.keywords) ? s8.keywords : [],
    memoryTrick: str(s8.memory_trick),
    voiceQuiz,
    closingHighScoreContext: str(s10.ai_context_high_score),
    closingMidScoreContext: str(s10.ai_context_mid_score),
    closingLowScoreContext: str(s10.ai_context_low_score),
    parentTryTonight: str(s10.parent_try_tonight),
    animations: anims,
  };

  // Optional animation keys (resolved to actual animation keys).
  const trapKey = resolveAnimationKey(
    chapter.stage_3_wrong_answer_trap?.lottie_trigger,
    anims,
  );
  if (trapKey) story.trapLottieKey = trapKey;
  const expRive = resolveAnimationKey(s4.rive_trigger, anims);
  if (expRive) story.experimentRiveKey = expRive;
  const visKey = resolveAnimationKey(
    chapter.stage_5_visualization?.lottie_trigger,
    anims,
  );
  if (visKey) story.visualizationLottieKey = visKey;
  const crRive = resolveAnimationKey(
    chapter.stage_7_concept_reveal?.rive_trigger,
    anims,
  );
  if (crRive) story.conceptRevealRiveKey = crRive;
  const examKey = resolveAnimationKey(s8.lottie_trigger, anims);
  if (examKey) story.examLottieKey = examKey;

  return story;
}

/** Synthesize the standard (non-voice) lesson fields from the story. */
function buildStandardFields(chapter: RawChapter, topicName: string) {
  const s8 = chapter.stage_8_exam_mode ?? {};
  const keywords = Array.isArray(s8.keywords) ? s8.keywords : [];
  const keyPoints = Array.isArray(s8.key_points) ? s8.key_points : [];
  const ncertTopics = Array.isArray(chapter.ncert_topics)
    ? chapter.ncert_topics
    : [];

  const definition = str(
    s8.ncert_definition,
    `${topicName} is a CBSE Class 3 Science chapter taught through a story-based discovery experience with Zumi.`,
  );
  const explanation = `${definition} ${str(
    chapter.stage_7_concept_reveal?.script,
    '',
  )}`
    .trim()
    .slice(0, 4000);

  const examples =
    keyPoints.length > 0
      ? keyPoints
      : ncertTopics.length > 0
        ? ncertTopics
        : [`Key idea of ${topicName} for Class 3 Science.`];

  // Brainstorming from the spoken quiz (question -> correct response).
  const questions = chapter.stage_9_quiz?.questions ?? [];
  const brainstorming =
    questions.length > 0
      ? questions.slice(0, 4).map(q => ({
          question: str(q.question_text, `Question about ${topicName}`).replace(
            /\{child_name\}/g,
            'dost',
          ),
          answer: str(
            q.response_correct,
            str(q.correct_indicator, 'Discuss with Zumi in the Fun session.'),
          ).replace(/\{child_name\}/g, 'dost'),
        }))
      : [
          {
            question: `What do we learn in ${topicName}?`,
            answer: definition,
          },
        ];

  // A small, valid MCQ quiz so the topic is schema-valid and has a non-voice
  // fallback. (Class 3 kids get the voice quiz; this is the safety net.)
  const primaryKeyword = str(keywords[0], topicName);
  const quiz = [
    {
      questionId: 'q1',
      type: 'mcq' as const,
      question: `Which statement best describes "${topicName}"?`,
      options: [
        'It is unrelated to the Class 3 syllabus',
        'It is a core idea in this chapter',
        'It only appears in higher grades',
        'It is optional for exams',
      ],
      correctIndex: 1,
      explanation: definition.slice(0, 480),
    },
    {
      questionId: 'q2',
      type: 'mcq' as const,
      question: `Is chapter mein hum mostly kis baare mein seekhte hain?`,
      options: [primaryKeyword, 'Kuch nahi', 'Sirf maths', 'Sirf English'],
      correctIndex: 0,
      explanation: str(s8.memory_trick, definition).slice(0, 480),
    },
    {
      questionId: 'q3',
      type: 'mcq' as const,
      question: `"${topicName}" achhe se samajhne ka best tareeka kya hai?`,
      options: [
        'Examples aur practice se',
        'Bina samjhe ratta lagana',
        'Topic skip karna',
        'Notes ignore karna',
      ],
      correctIndex: 0,
      explanation: 'Practice aur examples se concept pakka hota hai.',
    },
    {
      questionId: 'q4',
      type: 'mcq' as const,
      question: 'Ye topic kaunse subject ka hai?',
      options: ['English', 'Science', 'Social Science', 'Computer'],
      correctIndex: 1,
      explanation: 'Ye Class 3 Science ka chapter hai.',
    },
  ];

  return {explanation, examples, brainstorming, quiz};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseSeedFlags(process.argv.slice(2));
  const {db} = initScriptAdmin(flags);

  console.log(
    `[start] mode=${flags.apply ? 'APPLY' : 'DRY-RUN'} target=${flags.target} file=${flags.file}`,
  );

  if (!fs.existsSync(flags.file)) {
    console.error(`[fatal] voice stories file not found: ${flags.file}`);
    process.exit(1);
  }

  let parsed: RawFile;
  try {
    parsed = JSON.parse(fs.readFileSync(flags.file, 'utf8')) as RawFile;
  } catch (err) {
    console.error(`[fatal] invalid JSON: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  const chapters = parsed.chapters ?? [];
  if (chapters.length === 0) {
    console.error('[fatal] no chapters[] in file.');
    process.exit(1);
  }

  if (flags.target === 'prod' && flags.apply) {
    console.log('[apply] WAITING 5s before prod writes -- Ctrl-C to abort');
    await new Promise(r => setTimeout(() => r(undefined), 5000));
  }

  // Upsert the curriculum doc (idempotent -- usually already exists).
  await upsertDoc(
    db.collection('curriculum').doc(CURRICULUM_ID),
    {id: CURRICULUM_ID, board: 'cbse', grade: GRADE, subject: SUBJECT},
    flags.apply,
    `curriculum/${CURRICULUM_ID}`,
  );

  const counts: Counts = {chapters: 0, topics: 0, errors: 0};

  for (const chapter of chapters) {
    const chapterTitle = str(chapter.chapter_title, `Chapter ${chapter.chapter_number}`);
    const chapterId = slugify(chapterTitle);
    const topicId = chapterId; // one topic per chapter (the whole story)
    const chapterNo =
      typeof chapter.chapter_number === 'number' ? chapter.chapter_number : 1;

    if (!chapterId) {
      console.error(`  [error] chapter "${chapterTitle}" -> empty slug, skipping`);
      counts.errors += 1;
      continue;
    }

    // Chapter doc.
    await upsertDoc(
      db
        .collection('curriculum')
        .doc(CURRICULUM_ID)
        .collection('chapters')
        .doc(chapterId),
      {chapterNo, chapterName: chapterTitle, status: 'published'},
      flags.apply,
      `curriculum/${CURRICULUM_ID}/chapters/${chapterId}`,
    );
    counts.chapters += 1;

    // Topic doc (standard fields + voiceStory).
    const standard = buildStandardFields(chapter, chapterTitle);
    const voiceStory = buildVoiceStory(chapter, chapterId);
    const topicDoc: Record<string, unknown> = {
      curriculumId: CURRICULUM_ID,
      grade: GRADE,
      subject: SUBJECT,
      chapterNo,
      chapterName: chapterTitle,
      topicId,
      topicName: chapterTitle,
      explanation: standard.explanation,
      examples: standard.examples,
      brainstorming: standard.brainstorming,
      quiz: standard.quiz,
      status: 'published',
      curatedBy: 'content_team',
      voiceStory,
    };

    // Validate the FULL doc (the local schema now knows voiceStory). On
    // failure print the field path and skip just this topic.
    try {
      validateTopicContent(topicDoc);
    } catch (err) {
      const zerr = err as ZodError;
      console.error(`  [error] topic ${topicId}: validation failed`);
      if (zerr?.issues) {
        for (const issue of zerr.issues) {
          console.error(`     - ${issue.path.join('.')}: ${issue.message}`);
        }
      } else {
        console.error(`     - ${(err as Error).message}`);
      }
      counts.errors += 1;
      continue;
    }

    await upsertTopic(db, CURRICULUM_ID, chapterId, topicId, topicDoc, flags.apply);
    counts.topics += 1;
  }

  console.log(
    `[done] ${flags.apply ? 'applied' : 'dry-run'} -- chapters=${counts.chapters} topics=${counts.topics} errors=${counts.errors}`,
  );
  if (counts.errors > 0) process.exit(1);
}

async function upsertDoc(
  ref: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>,
  apply: boolean,
  label: string,
): Promise<void> {
  const snap = await ref.get();
  console.log(`  [plan] ${label} (${snap.exists ? 'update' : 'create'})`);
  if (!apply) return;
  await ref.set(data, {merge: true});
}

async function upsertTopic(
  db: Firestore,
  curriculumId: string,
  chapterId: string,
  topicId: string,
  doc: Record<string, unknown>,
  apply: boolean,
): Promise<void> {
  const ref = db
    .collection('curriculum')
    .doc(curriculumId)
    .collection('chapters')
    .doc(chapterId)
    .collection('topics')
    .doc(topicId);
  const snap = await ref.get();
  const exists = snap.exists;
  const prevStatus = exists ? (snap.data()?.status as string | undefined) : undefined;

  const payload: Record<string, unknown> = {...doc};
  // Stamp publishedAt only on the first publish (mirrors importCurriculum).
  if (!exists || prevStatus !== 'published') {
    payload.publishedAt = FieldValue.serverTimestamp();
  } else {
    delete payload.publishedAt;
  }

  console.log(
    `  [plan] curriculum/${curriculumId}/chapters/${chapterId}/topics/${topicId} (${exists ? 'update' : 'create'}, voiceStory)`,
  );
  if (!apply) return;
  await ref.set(payload, {merge: true});
}

if (require.main === module) {
  main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}

export {parseSeedFlags, buildVoiceStory, buildStandardFields, slugify};
