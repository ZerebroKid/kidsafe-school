/**
 * Seed the Reels catalogue into Firestore.
 *
 * Reads a JSON file with `topics[]` and `reels[]` arrays and writes them to:
 *   - `reelTopics/{topicTag}`   — topic metadata + parent questions
 *   - `reelsCatalog/{reelId}`   — individual reel video entries
 *
 * Idempotent: re-running merges docs (upsert). `createdAt` is only stamped on
 * first creation.
 *
 * Usage (from monorepo root):
 *   pnpm seed:reels                                    # dry-run, emulator
 *   pnpm seed:reels -- --apply                         # apply, emulator
 *   pnpm seed:reels -- --apply --target=prod
 *   pnpm seed:reels -- --file=./content/reels/my_reels.json
 */

import * as fs from 'fs';
import * as path from 'path';

import {FieldValue, type Firestore} from 'firebase-admin/firestore';

import {initScriptAdmin, parseBaseFlags, type BaseFlags} from './lib/scriptInit';

const DEFAULT_FILE = path.resolve(
  __dirname,
  '../../../../content/reels/sample_reels.json',
);

interface SeedFlags extends BaseFlags {
  file: string;
}

interface RawTopic {
  topicTag: string;
  name: string;
  subject: string;
  parentQuestions: string[];
}

interface RawReel {
  reelId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  title: string;
  kind: 'topic' | 'fun';
  topicTag?: string;
  subject?: string;
  gradeBand: number[];
  durationSec: number;
}

interface RawData {
  topics: RawTopic[];
  reels: RawReel[];
}

function parseFlags(argv: string[]): SeedFlags {
  const base = parseBaseFlags(argv);
  let file = DEFAULT_FILE;
  for (const arg of argv) {
    if (arg.startsWith('--file=')) {
      file = path.resolve(arg.slice('--file='.length));
    }
  }
  return {...base, file};
}

function validate(data: RawData): string[] {
  const errors: string[] = [];
  const topicTags = new Set<string>();

  for (const t of data.topics) {
    if (!t.topicTag) errors.push('Topic missing topicTag');
    if (!t.name) errors.push(`Topic ${t.topicTag}: missing name`);
    if (!t.subject) errors.push(`Topic ${t.topicTag}: missing subject`);
    if (!Array.isArray(t.parentQuestions) || t.parentQuestions.length === 0) {
      errors.push(`Topic ${t.topicTag}: parentQuestions must be a non-empty array`);
    }
    topicTags.add(t.topicTag);
  }

  const reelIds = new Set<string>();
  for (const r of data.reels) {
    if (!r.reelId) errors.push('Reel missing reelId');
    if (reelIds.has(r.reelId)) errors.push(`Duplicate reelId: ${r.reelId}`);
    reelIds.add(r.reelId);
    if (!r.videoUrl) errors.push(`Reel ${r.reelId}: missing videoUrl`);
    if (!r.title) errors.push(`Reel ${r.reelId}: missing title`);
    if (!['topic', 'fun'].includes(r.kind)) {
      errors.push(`Reel ${r.reelId}: kind must be 'topic' or 'fun'`);
    }
    if (r.kind === 'topic' && !r.topicTag) {
      errors.push(`Reel ${r.reelId}: topic reel must have topicTag`);
    }
    if (r.kind === 'topic' && r.topicTag && !topicTags.has(r.topicTag)) {
      errors.push(`Reel ${r.reelId}: topicTag '${r.topicTag}' not in topics[]`);
    }
    if (!Array.isArray(r.gradeBand) || r.gradeBand.length === 0) {
      errors.push(`Reel ${r.reelId}: gradeBand must be a non-empty array`);
    }
  }

  return errors;
}

async function seed(db: Firestore, data: RawData, apply: boolean) {
  let topicsWritten = 0;
  let reelsWritten = 0;

  for (const t of data.topics) {
    const ref = db.collection('reelTopics').doc(t.topicTag);
    const doc = {
      topicTag: t.topicTag,
      name: t.name,
      subject: t.subject,
      parentQuestions: t.parentQuestions,
    };
    console.log(`  [topic] ${t.topicTag} — ${t.name} (${t.parentQuestions.length} questions)`);
    if (apply) {
      await ref.set(doc, {merge: true});
    }
    topicsWritten++;
  }

  for (const r of data.reels) {
    const ref = db.collection('reelsCatalog').doc(r.reelId);
    const existing = apply ? await ref.get() : null;
    const doc: Record<string, unknown> = {
      reelId: r.reelId,
      videoUrl: r.videoUrl,
      title: r.title,
      kind: r.kind,
      gradeBand: r.gradeBand,
      durationSec: r.durationSec,
      active: true,
    };
    if (r.thumbnailUrl) doc.thumbnailUrl = r.thumbnailUrl;
    if (r.topicTag) doc.topicTag = r.topicTag;
    if (r.subject) doc.subject = r.subject;
    if (!existing?.exists) {
      doc.createdAt = FieldValue.serverTimestamp();
    }
    console.log(`  [reel] ${r.reelId} — "${r.title}" (${r.kind}, ${r.gradeBand.join(',')})`);
    if (apply) {
      await ref.set(doc, {merge: true});
    }
    reelsWritten++;
  }

  return {topicsWritten, reelsWritten};
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  console.log(`\n=== seedReels ===`);
  console.log(`  file:   ${flags.file}`);
  console.log(`  target: ${flags.target}`);
  console.log(`  apply:  ${flags.apply}\n`);

  if (!fs.existsSync(flags.file)) {
    console.error(`[fatal] File not found: ${flags.file}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(flags.file, 'utf8')) as RawData;
  console.log(`Loaded ${raw.topics?.length ?? 0} topics, ${raw.reels?.length ?? 0} reels\n`);

  const errors = validate(raw);
  if (errors.length > 0) {
    console.error('[validation errors]');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  const {db} = initScriptAdmin(flags);
  const counts = await seed(db, raw, flags.apply);

  console.log(`\nDone: ${counts.topicsWritten} topics, ${counts.reelsWritten} reels`);
  if (!flags.apply) {
    console.log('(dry run — pass --apply to write)');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
