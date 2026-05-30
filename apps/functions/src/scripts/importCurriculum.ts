/**
 * P4.6.2 -- bulk-import curated curriculum JSON bundles into Firestore.
 *
 * Walks `content/{curriculumId}/{chapterDir}/topics/*.json`, validates each
 * topic against the Zod schema in `lib/topicContentSchema.ts`, and writes:
 *
 *   curriculum/{curriculumId}                              (one set)
 *   curriculum/{curriculumId}/chapters/{chapterId}         (one set per chapter)
 *   curriculum/{curriculumId}/chapters/{chapterId}/topics/{topicId} (one set per topic)
 *
 * Idempotency:
 *   - All writes use `set` with merge so re-running overwrites mutable fields
 *     without resetting `publishedAt` (which only sets the first time a topic
 *     transitions to status='published').
 *   - Doc ids are derived deterministically from folder + filename, so
 *     repeated imports converge on the same docs without orphaning.
 *
 * Validation:
 *   - Every topic JSON must pass `validateTopicContent` (Zod). The script
 *     prints the exact field path on failure and skips the file -- it does
 *     NOT abort the rest of the run, so one broken topic doesn't block a
 *     200-topic import. Exit code is 1 if ANY topic failed.
 *
 * Usage (from monorepo root):
 *   pnpm import:curriculum                         # dry-run, emulator
 *   pnpm import:curriculum -- --apply              # apply, emulator
 *   pnpm import:curriculum -- --apply --target=prod    # apply, prod
 *   pnpm import:curriculum -- --content=./content/cbse_8_science   # specific bundle
 *
 * Bundle layout (see content/README.md):
 *   content/
 *     cbse_8/
 *       cbse_8_science/
 *         curriculum.json                # CurriculumDoc shape
 *         force_pressure/
 *           chapter.json                 # ChapterDoc shape
 *           topics/
 *             types_of_forces.json       # TopicContent shape
 *             ...
 *       cbse_8_math/
 *         ...
 *
 * `curriculumId`, `chapterId`, and `topicId` are derived from the folder /
 * filename (lowercase snake_case). The script cross-checks that the
 * `curriculumId`, `chapterNo`, and `topicId` fields INSIDE each topic JSON
 * agree with the on-disk derivation -- mismatches are flagged as schema
 * errors so a copy-paste typo doesn't silently write the wrong path.
 */

import * as fs from 'fs';
import * as path from 'path';

import {FieldValue, type Firestore} from 'firebase-admin/firestore';
import type {ZodError} from 'zod';

import {initScriptAdmin, parseBaseFlags, type BaseFlags} from './lib/scriptInit';
import {validateTopicContent} from '../lib/topicContentSchema';

interface ImportFlags extends BaseFlags {
  /** Absolute or workspace-relative path to a single bundle or the parent `content/` folder. */
  contentPath: string;
}

interface ParsedCurriculum {
  id: string;
  doc: Record<string, unknown>;
}

interface ParsedChapter {
  curriculumId: string;
  chapterId: string;
  doc: Record<string, unknown>;
}

interface ParsedTopic {
  curriculumId: string;
  chapterId: string;
  topicId: string;
  doc: Record<string, unknown>;
}

interface Counts {
  curricula: number;
  chapters: number;
  topics: number;
  topicErrors: number;
}

function parseImportFlags(argv: string[]): ImportFlags {
  const base = parseBaseFlags(argv);
  // Default to the in-repo `content/` folder regardless of cwd. The script
  // is launched via `pnpm import:curriculum` which pnpm runs from
  // `apps/functions/`, so a naive `cwd/content` would miss the bundle.
  // `__dirname` is `apps/functions/dist/scripts/` after build -> four `..`
  // jumps land at the monorepo root.
  let contentPath = path.resolve(__dirname, '..', '..', '..', '..', 'content');
  for (const arg of argv) {
    if (arg.startsWith('--content=')) {
      const arg_path = arg.slice('--content='.length);
      contentPath = path.isAbsolute(arg_path)
        ? arg_path
        : path.resolve(process.cwd(), arg_path);
    }
  }
  return {...base, contentPath};
}

async function main(): Promise<void> {
  const flags = parseImportFlags(process.argv.slice(2));
  const {db} = initScriptAdmin(flags);

  console.log(
    `[start] mode=${flags.apply ? 'APPLY' : 'DRY-RUN'} target=${flags.target} content=${flags.contentPath}`,
  );

  if (!fs.existsSync(flags.contentPath)) {
    console.error(`[fatal] content path does not exist: ${flags.contentPath}`);
    process.exit(1);
  }

  if (flags.target === 'prod' && flags.apply) {
    console.log('[apply] WAITING 5s before prod writes -- Ctrl-C to abort');
    await new Promise(r => setTimeout(r, 5000));
  }

  const bundles = resolveBundles(flags.contentPath);
  if (bundles.length === 0) {
    console.warn(
      `[warn] no curriculum bundles found under ${flags.contentPath}. ` +
        `Each bundle is a folder containing a curriculum.json file.`,
    );
    process.exit(2);
  }

  const counts: Counts = {curricula: 0, chapters: 0, topics: 0, topicErrors: 0};
  for (const bundle of bundles) {
    console.log(`[bundle] ${bundle}`);
    await importBundle(db, bundle, flags.apply, counts);
  }

  console.log(
    `[done] ${flags.apply ? 'applied' : 'dry-run'} -- curricula=${counts.curricula} chapters=${counts.chapters} topics=${counts.topics} errors=${counts.topicErrors}`,
  );
  if (counts.topicErrors > 0) process.exit(1);
}

/**
 * If `contentPath` itself is a bundle (contains `curriculum.json`), use it
 * directly. Otherwise walk sub-folders recursively and collect every directory
 * that contains a `curriculum.json` (e.g. `content/cbse_8/cbse_8_math`).
 */
function resolveBundles(contentPath: string): string[] {
  const direct = path.join(contentPath, 'curriculum.json');
  if (fs.existsSync(direct)) return [contentPath];

  const out: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const child = path.join(dir, entry.name);
      if (fs.existsSync(path.join(child, 'curriculum.json'))) {
        out.push(child);
      } else {
        walk(child);
      }
    }
  }

  walk(contentPath);
  return out.sort();
}

async function importBundle(
  db: Firestore,
  bundlePath: string,
  apply: boolean,
  counts: Counts,
): Promise<void> {
  const curriculum = parseCurriculum(bundlePath);
  counts.curricula += 1;

  const chapters = listChapters(bundlePath, curriculum.id);
  console.log(
    `  [parse] curriculum=${curriculum.id} chapters=${chapters.length}`,
  );

  await upsertCurriculum(db, curriculum, apply);

  for (const chapter of chapters) {
    counts.chapters += 1;
    await upsertChapter(db, chapter, apply);

    const topicsDir = path.join(bundlePath, chapter.chapterId, 'topics');
    const topicFiles = fs.existsSync(topicsDir)
      ? fs
          .readdirSync(topicsDir)
          .filter(f => f.endsWith('.json'))
          .sort()
      : [];

    for (const file of topicFiles) {
      const result = parseTopic(
        path.join(topicsDir, file),
        curriculum.id,
        chapter.chapterId,
      );
      if (!result.ok) {
        counts.topicErrors += 1;
        continue;
      }
      counts.topics += 1;
      await upsertTopic(db, result.topic, apply);
    }
  }
}

function parseCurriculum(bundlePath: string): ParsedCurriculum {
  const file = path.join(bundlePath, 'curriculum.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const folderId = path.basename(bundlePath);
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    throw new Error(`${file}: missing "id" field`);
  }
  if (raw.id !== folderId) {
    throw new Error(
      `${file}: id "${raw.id}" disagrees with folder name "${folderId}"`,
    );
  }
  if (typeof raw.board !== 'string' || raw.board.length === 0) {
    throw new Error(`${file}: missing "board" field`);
  }
  if (typeof raw.grade !== 'number') {
    throw new Error(`${file}: missing "grade" field (number)`);
  }
  if (typeof raw.subject !== 'string' || raw.subject.length === 0) {
    throw new Error(`${file}: missing "subject" field`);
  }
  return {id: raw.id, doc: raw};
}

function listChapters(bundlePath: string, curriculumId: string): ParsedChapter[] {
  const out: ParsedChapter[] = [];
  for (const entry of fs.readdirSync(bundlePath, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const chapterDir = path.join(bundlePath, entry.name);
    const chapterFile = path.join(chapterDir, 'chapter.json');
    if (!fs.existsSync(chapterFile)) continue;
    const raw = JSON.parse(fs.readFileSync(chapterFile, 'utf8'));
    if (typeof raw.chapterNo !== 'number') {
      throw new Error(`${chapterFile}: missing "chapterNo" field`);
    }
    if (typeof raw.chapterName !== 'string' || raw.chapterName.length === 0) {
      throw new Error(`${chapterFile}: missing "chapterName" field`);
    }
    if (raw.status !== 'draft' && raw.status !== 'published') {
      raw.status = 'published';
    }
    out.push({curriculumId, chapterId: entry.name, doc: raw});
  }
  out.sort((a, b) => Number(a.doc.chapterNo) - Number(b.doc.chapterNo));
  return out;
}

function parseTopic(
  file: string,
  expectedCurriculumId: string,
  expectedChapterId: string,
): {ok: true; topic: ParsedTopic} | {ok: false} {
  const topicId = path.basename(file, '.json');
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(
      `  [error] ${file}: invalid JSON -- ${(err as Error).message}`,
    );
    return {ok: false};
  }

  try {
    const validated = validateTopicContent(raw);
    // Cross-check the embedded ids against the folder layout.
    if (validated.curriculumId !== expectedCurriculumId) {
      console.error(
        `  [error] ${file}: curriculumId "${validated.curriculumId}" disagrees with folder "${expectedCurriculumId}"`,
      );
      return {ok: false};
    }
    if (validated.topicId !== topicId) {
      console.error(
        `  [error] ${file}: topicId "${validated.topicId}" disagrees with filename "${topicId}"`,
      );
      return {ok: false};
    }
    return {
      ok: true,
      topic: {
        curriculumId: expectedCurriculumId,
        chapterId: expectedChapterId,
        topicId,
        doc: validated as unknown as Record<string, unknown>,
      },
    };
  } catch (err) {
    const zerr = err as ZodError;
    if (zerr?.issues) {
      console.error(`  [error] ${file}: validation failed`);
      for (const issue of zerr.issues) {
        console.error(`     - ${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      console.error(`  [error] ${file}: ${(err as Error).message}`);
    }
    return {ok: false};
  }
}

async function upsertCurriculum(
  db: Firestore,
  curriculum: ParsedCurriculum,
  apply: boolean,
): Promise<void> {
  const ref = db.collection('curriculum').doc(curriculum.id);
  const snap = await ref.get();
  const verb = snap.exists ? 'update' : 'create';
  console.log(`  [plan] curriculum/${curriculum.id} (${verb})`);
  if (!apply) return;
  await ref.set(curriculum.doc, {merge: true});
}

async function upsertChapter(
  db: Firestore,
  chapter: ParsedChapter,
  apply: boolean,
): Promise<void> {
  const ref = db
    .collection('curriculum')
    .doc(chapter.curriculumId)
    .collection('chapters')
    .doc(chapter.chapterId);
  const snap = await ref.get();
  const verb = snap.exists ? 'update' : 'create';
  console.log(
    `  [plan] curriculum/${chapter.curriculumId}/chapters/${chapter.chapterId} (${verb})`,
  );
  if (!apply) return;
  await ref.set(chapter.doc, {merge: true});
}

async function upsertTopic(
  db: Firestore,
  topic: ParsedTopic,
  apply: boolean,
): Promise<void> {
  const ref = db
    .collection('curriculum')
    .doc(topic.curriculumId)
    .collection('chapters')
    .doc(topic.chapterId)
    .collection('topics')
    .doc(topic.topicId);
  const snap = await ref.get();
  const exists = snap.exists;
  const prevStatus = exists ? (snap.data()?.status as string | undefined) : undefined;
  const newStatus = topic.doc.status as string;

  // Only stamp publishedAt on the FIRST transition into 'published'. If the
  // doc was already published we preserve the existing timestamp; if it's
  // still draft we omit the field entirely.
  const payload: Record<string, unknown> = {...topic.doc};
  if (newStatus === 'published' && prevStatus !== 'published') {
    payload.publishedAt = FieldValue.serverTimestamp();
  } else if (newStatus !== 'published') {
    delete payload.publishedAt;
  } else {
    // Already published -- preserve, don't include in patch.
    delete payload.publishedAt;
  }

  const verb = exists ? 'update' : 'create';
  console.log(
    `  [plan] curriculum/${topic.curriculumId}/chapters/${topic.chapterId}/topics/${topic.topicId} (${verb}, status=${newStatus})`,
  );
  if (!apply) return;
  await ref.set(payload, {merge: true});
}

// Re-export the bundle iterator + helpers for the test harness. Wrapped in
// an `if (require.main === module)` guard so importing this file in Jest
// doesn't kick off main().
if (require.main === module) {
  main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}

export {
  parseCurriculum,
  listChapters,
  parseTopic,
  resolveBundles,
  importBundle,
  parseImportFlags,
};
