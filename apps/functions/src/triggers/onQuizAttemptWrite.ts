/**
 * P4.10.2 -- reward unlock trigger.
 *
 * Fires on every write to `quizAttempts/{id}`. Unlocks a reward ONLY on the
 * attempt that first crosses the pass threshold (the `submitQuizAttempt`
 * callable flips `passed` sticky-true and stamps `firstPassedAt` exactly
 * once). Because retakes update the SAME attempt doc, we gate on the
 * `before.passed != true && after.passed == true` transition so a child who
 * keeps retaking after passing never unlocks a second reward.
 *
 * Idempotency: the reward unlock doc id == the attempt id, so a trigger
 * re-fire (Cloud Functions delivers at-least-once) is a no-op once the
 * unlock exists.
 *
 * Eligibility: match `moderationStatus == 'approved'` + `subjectTags
 * array-contains <subject>` + the attempt's `grade` being in the reward's
 * `grades` list. `subjectTags` are stored lowercased in the catalog, so we
 * lowercase the attempt's `subjectName` before the `array-contains` lookup;
 * the grade filter runs in memory over the subject matches (Firestore allows
 * only one `array-contains` per query). A random eligible reward is chosen; if
 * none match we simply write nothing (ZKid shows a friendly "you passed, no
 * reward today" fallback).
 *
 * The reward fields are denormalised onto the unlock doc so ZKid can render
 * the unlock without a follow-up `rewardCatalog` read.
 *
 * The core is factored into `handleQuizAttemptWrite(database, ...)` so it can
 * be unit-tested with an injected in-memory Firestore (mirrors the
 * importCurriculum test style) without the emulator.
 */

import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {FieldValue, type Firestore} from 'firebase-admin/firestore';

import {db} from '../lib/admin';

export interface HandleResult {
  unlocked: boolean;
  rewardId?: string;
  reason?:
    | 'not-first-pass'
    | 'already-unlocked'
    | 'no-subject'
    | 'no-grade'
    | 'no-eligible-reward'
    | 'deleted';
}

/**
 * Pure-ish core: given the attempt doc's before/after data, decide whether to
 * unlock a reward and (idempotently) write `rewardUnlocks/{attemptId}`.
 */
export async function handleQuizAttemptWrite(
  database: Firestore,
  attemptId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  options?: {pickIndex?: (count: number) => number},
): Promise<HandleResult> {
  if (!after) return {unlocked: false, reason: 'deleted'};

  const passedNow = after.passed === true;
  const passedBefore = before?.passed === true;
  // Only the transition into "passed" unlocks a reward (first pass).
  if (!passedNow || passedBefore) {
    return {unlocked: false, reason: 'not-first-pass'};
  }

  const unlockRef = database.collection('rewardUnlocks').doc(attemptId);
  const existing = await unlockRef.get();
  if (existing.exists) {
    return {unlocked: false, reason: 'already-unlocked'};
  }

  const subject = String(after.subjectName ?? '')
    .trim()
    .toLowerCase();
  if (!subject) {
    return {unlocked: false, reason: 'no-subject'};
  }

  // Grade-scoped matching: the attempt must carry a grade (denormalised from
  // the topic by `submitQuizAttempt`), and the reward's `grades` list must
  // include it. Attempts written before grade denormalisation -- or any reward
  // created before the `grades` field existed -- simply don't match.
  const grade = Number(after.grade);
  if (!Number.isFinite(grade)) {
    return {unlocked: false, reason: 'no-grade'};
  }

  const query = await database
    .collection('rewardCatalog')
    .where('moderationStatus', '==', 'approved')
    .where('subjectTags', 'array-contains', subject)
    .get();

  if (query.empty || query.docs.length === 0) {
    return {unlocked: false, reason: 'no-eligible-reward'};
  }

  // Firestore allows only one `array-contains` per query, so we filter the
  // subject-matched candidates by grade in memory (the result set is small).
  const docs = query.docs.filter(d => {
    const grades = d.data()?.grades;
    return Array.isArray(grades) && grades.includes(grade);
  });

  if (docs.length === 0) {
    return {unlocked: false, reason: 'no-eligible-reward'};
  }

  const pickIndex =
    options?.pickIndex ?? ((count: number) => Math.floor(Math.random() * count));
  const idx = Math.min(Math.max(pickIndex(docs.length), 0), docs.length - 1);
  const chosen = docs[idx]!;
  const reward = chosen.data() ?? {};

  await unlockRef.set({
    id: attemptId,
    attemptId,
    childUid: after.childUid,
    ...(after.parentUid ? {parentUid: after.parentUid} : {}),
    schoolId: after.schoolId,
    classId: after.classId,
    topicId: after.topicId,
    rewardId: chosen.id,
    rewardType: reward.type ?? 'youtube_link',
    rewardTitle: reward.title ?? 'Your reward',
    rewardUrl: reward.url ?? '',
    unlockedAt: FieldValue.serverTimestamp(),
  });

  return {unlocked: true, rewardId: chosen.id};
}

export const onQuizAttemptWrite = onDocumentWritten(
  {document: 'quizAttempts/{id}', region: 'asia-south1'},
  async event => {
    const attemptId = event.params.id;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    await handleQuizAttemptWrite(db(), attemptId, before, after);
  },
);
