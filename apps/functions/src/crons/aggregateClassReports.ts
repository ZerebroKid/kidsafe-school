/**
 * P5.1 -- nightly class-report aggregator.
 *
 * Pre-computes principal/teacher dashboard data so those UIs read one tiny
 * summary doc per class instead of scanning thousands of `quizAttempts` on
 * every load.
 *
 * Schedule: 02:00 IST daily. At that hour the school day that just ended is
 * complete, so the scheduled wrapper aggregates YESTERDAY (school TZ). The core
 * is date-parameterized so the manual/backfill script
 * (`scripts/runAggregateClassReports.ts`) can target any `YYYY-MM-DD`.
 *
 * Output per class with >= 1 attempt on the day:
 *   - `classReports/{classId}/daily/{date}` -- full rollup (avg score, attempted
 *     / passed students, per-topic stats sorted weakest-first).
 *   - `classReports/{classId}` -- merged pointer doc (schoolId, teacherIds,
 *     className, lastDailyDate) so a UI can resolve a class without a scan.
 *
 * `schoolId` + `teacherIds` are denormalised onto BOTH docs because
 * firestore/rules gate `classReports` reads on them (principal via
 * `belongsToSchool(schoolId)`, teacher via `myUid() in teacherIds`).
 *
 * The core is factored as `aggregateClassReportsForDate(database, date)` with an
 * injected Firestore so it can be unit-tested against an in-memory fake (mirrors
 * `onQuizAttemptWrite` / `importCurriculum`), no emulator required.
 *
 * Weak-topic flagging (the `weak: true` threshold + dedicated `weakTopics` doc +
 * teacher "Re-teach" callout) is P5.4; this cron already emits per-topic
 * `avgBestPercentage` sorted ascending so that work can build on it.
 */

import {onSchedule} from 'firebase-functions/v2/scheduler';
import {FieldValue, type Firestore} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {SCHOOL_TIMEZONE, yesterdayYmdInTz} from '../lib/schoolTime';

/** Firestore caps a WriteBatch at 500 ops; stay comfortably under it. */
const MAX_BATCH_OPS = 450;

/**
 * A topic is "weak" (re-teach candidate) when its class average best score is
 * below this percentage. Surfaced to teachers via the pointer doc's
 * `weakTopics` list (P5.4).
 */
const WEAK_TOPIC_THRESHOLD = 60;

export interface AggregateResult {
  date: string;
  classesWritten: number;
  attemptsScanned: number;
}

interface TopicAccumulator {
  topicId: string;
  topicName: string;
  subjectName: string;
  attempted: Set<string>;
  passed: Set<string>;
  bestSum: number;
  bestCount: number;
}

interface ClassAccumulator {
  schoolId: string;
  classId: string;
  attemptedStudents: Set<string>;
  passedStudents: Set<string>;
  totalAttempts: number;
  bestSum: number;
  bestCount: number;
  topics: Map<string, TopicAccumulator>;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Aggregate all `quizAttempts` whose `assignedDate == date` into per-class
 * `classReports` docs. Idempotent: re-running for the same date overwrites the
 * daily doc, so retries/backfills are safe.
 */
export async function aggregateClassReportsForDate(
  database: Firestore,
  date: string,
  opts?: {source?: 'cron' | 'script'},
): Promise<AggregateResult> {
  const source = opts?.source ?? 'script';

  const snap = await database
    .collection('quizAttempts')
    .where('assignedDate', '==', date)
    .get();

  // ---- Group attempts by class --------------------------------------------
  const byClass = new Map<string, ClassAccumulator>();
  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const classId = str(d.classId);
    const schoolId = str(d.schoolId);
    const childUid = str(d.childUid);
    if (!classId || !schoolId || !childUid) continue;

    let cls = byClass.get(classId);
    if (!cls) {
      cls = {
        schoolId,
        classId,
        attemptedStudents: new Set(),
        passedStudents: new Set(),
        totalAttempts: 0,
        bestSum: 0,
        bestCount: 0,
        topics: new Map(),
      };
      byClass.set(classId, cls);
    }

    const best = num(d.bestPercentage);
    const passed = d.passed === true;
    cls.totalAttempts += 1;
    cls.attemptedStudents.add(childUid);
    if (passed) cls.passedStudents.add(childUid);
    cls.bestSum += best;
    cls.bestCount += 1;

    const topicId = str(d.topicId) || 'unknown';
    let topic = cls.topics.get(topicId);
    if (!topic) {
      topic = {
        topicId,
        topicName: str(d.topicName) || topicId,
        subjectName: str(d.subjectName),
        attempted: new Set(),
        passed: new Set(),
        bestSum: 0,
        bestCount: 0,
      };
      cls.topics.set(topicId, topic);
    }
    topic.attempted.add(childUid);
    if (passed) topic.passed.add(childUid);
    topic.bestSum += best;
    topic.bestCount += 1;
  }

  // ---- Build + write report docs ------------------------------------------
  // Stage all writes, then commit in chunked batches so a class-heavy day stays
  // under the 500-op batch ceiling.
  type Write = {ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown>; merge: boolean};
  const writes: Write[] = [];

  for (const cls of byClass.values()) {
    // Read the class doc for teacherIds + roster + name (one point-get/class).
    const classRef = database
      .collection('schools')
      .doc(cls.schoolId)
      .collection('classes')
      .doc(cls.classId);
    const classSnap = await classRef.get();
    const classData = (classSnap.exists ? classSnap.data() : {}) as Record<
      string,
      unknown
    >;
    const teacherIds = Array.isArray(classData.teacherIds)
      ? (classData.teacherIds as unknown[]).filter(
          (t): t is string => typeof t === 'string',
        )
      : [];
    const rosterSize = Array.isArray(classData.studentChildUids)
      ? (classData.studentChildUids as unknown[]).filter(
          t => typeof t === 'string',
        ).length
      : 0;
    const className = str(classData.className);

    const topics = Array.from(cls.topics.values())
      .map(t => {
        const avgBestPercentage =
          t.bestCount > 0 ? Math.round(t.bestSum / t.bestCount) : 0;
        return {
          topicId: t.topicId,
          topicName: t.topicName,
          subjectName: t.subjectName,
          attemptedStudents: t.attempted.size,
          passedStudents: t.passed.size,
          avgBestPercentage,
          weak: avgBestPercentage < WEAK_TOPIC_THRESHOLD,
        };
      })
      .sort((a, b) => a.avgBestPercentage - b.avgBestPercentage);

    // Weak topics inherit the weakest-first ordering of `topics`.
    const weakTopics = topics.filter(t => t.weak);

    const dailyRef = database
      .collection('classReports')
      .doc(cls.classId)
      .collection('daily')
      .doc(date);

    writes.push({
      ref: dailyRef,
      merge: false,
      data: {
        date,
        schoolId: cls.schoolId,
        classId: cls.classId,
        teacherIds,
        rosterSize,
        attemptedStudents: cls.attemptedStudents.size,
        totalAttempts: cls.totalAttempts,
        passedStudents: cls.passedStudents.size,
        avgBestPercentage:
          cls.bestCount > 0 ? Math.round(cls.bestSum / cls.bestCount) : 0,
        topics,
        source,
        generatedAt: FieldValue.serverTimestamp(),
      },
    });

    const pointerRef = database.collection('classReports').doc(cls.classId);
    writes.push({
      ref: pointerRef,
      merge: true,
      data: {
        schoolId: cls.schoolId,
        classId: cls.classId,
        teacherIds,
        ...(className ? {className} : {}),
        lastDailyDate: date,
        // Always written (even []) so a recovered class clears its stale list.
        weakTopics,
        weakTopicsDate: date,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  for (let i = 0; i < writes.length; i += MAX_BATCH_OPS) {
    const batch = database.batch();
    for (const w of writes.slice(i, i + MAX_BATCH_OPS)) {
      batch.set(w.ref, w.data, {merge: w.merge});
    }
    await batch.commit();
  }

  return {
    date,
    classesWritten: byClass.size,
    attemptsScanned: snap.docs.length,
  };
}

/**
 * Scheduled entry point. Runs 02:00 IST daily and aggregates the school day
 * that just ended (yesterday in `Asia/Kolkata`).
 */
export const aggregateClassReports = onSchedule(
  {
    schedule: 'every day 02:00',
    timeZone: SCHOOL_TIMEZONE,
    region: 'asia-south1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const date = yesterdayYmdInTz(Date.now(), SCHOOL_TIMEZONE);
    const result = await aggregateClassReportsForDate(db(), date, {
      source: 'cron',
    });
    console.log(
      `[aggregateClassReports] date=${result.date} classes=${result.classesWritten} attempts=${result.attemptsScanned}`,
    );
  },
);
