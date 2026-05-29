/**
 * P4.9.2 -- unit tests for the `submitQuizAttempt` callable.
 *
 * Same hand-rolled in-memory Firestore fake as `assignTopic.test.ts`: mock
 * `../../lib/admin` (db) + `../../lib/auth` (requireAuth/requireRole) so the
 * tests run without the emulator. The fake supports point gets, set/merge,
 * and a runTransaction that re-reads via the same ref.
 *
 * Focus: server-authoritative grading (tampered selections can't inflate the
 * score), retake-aware upsert (best/last tracking + sticky `passed` +
 * one-shot `firstPass`), and the authorization gates.
 */

// ---- mocks (must be declared BEFORE any import that they shadow) ---------

const fakeStore: {
  docs: Map<string, Record<string, unknown>>;
  writes: Array<{path: string; data: Record<string, unknown>}>;
} = {docs: new Map(), writes: []};

function makeDocRef(parts: string[]): any {
  const path = parts.join('/');
  return {
    id: parts[parts.length - 1],
    path,
    get: async () => makeDocSnap(path),
    set: async (data: Record<string, unknown>) => {
      fakeStore.docs.set(path, {...(fakeStore.docs.get(path) ?? {}), ...data});
      fakeStore.writes.push({path, data});
    },
    update: async (data: Record<string, unknown>) => {
      fakeStore.docs.set(path, {...(fakeStore.docs.get(path) ?? {}), ...data});
      fakeStore.writes.push({path, data});
    },
    collection: (name: string) => makeCollectionRef([...parts, name]),
  };
}

function makeDocSnap(path: string) {
  const data = fakeStore.docs.get(path);
  return {
    exists: data !== undefined,
    id: path.split('/').pop()!,
    data: () => data,
    ref: makeDocRef(path.split('/')),
  };
}

function makeCollectionRef(parts: string[]): any {
  return {
    doc: (id: string) => makeDocRef([...parts, id]),
    where: () => makeCollectionRef(parts),
  };
}

const fakeDb = {
  collection: (name: string) => makeCollectionRef([name]),
  runTransaction: async (fn: (tx: any) => Promise<unknown>) => {
    const tx = {
      get: async (ref: any) => ref.get(),
      set: (ref: any, data: Record<string, unknown>) => ref.set(data),
      update: (ref: any, data: Record<string, unknown>) => ref.update(data),
    };
    return fn(tx);
  },
};

jest.mock('../../lib/admin', () => ({
  db: () => fakeDb,
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__serverTimestamp__',
  },
}));

let mockRoleAllowed = true;
jest.mock('../../lib/auth', () => ({
  requireAuth: (req: any) => ({uid: req.auth?.uid, phone: '+919999999999'}),
  requireRole: async () => {
    if (!mockRoleAllowed) {
      const {HttpsError} = require('firebase-functions/v2/https');
      throw new HttpsError(
        'permission-denied',
        'This action requires the child role.',
      );
    }
  },
}));

// ---- imports under test ---------------------------------------------------

import {submitQuizAttempt} from '../submitQuizAttempt';

// ---- helpers --------------------------------------------------------------

const CHILD_UID = 'child_u1';
const PARENT_UID = 'parent_u1';
const SCHOOL_ID = 'school_a';
const CLASS_ID = 'class_8a';
const CHAPTER_ID = 'force_pressure';
const TOPIC_ID = 'types_of_forces';
const CURRICULUM_ID = 'cbse_8_science';
const TEACHER_UID = 'teacher_u1';
const ASSIGNMENT_ID = `${CLASS_ID}_${TOPIC_ID}_2026-05-29`;
const ATTEMPT_ID = `${ASSIGNMENT_ID}_${CHILD_UID}`;

// A 5-question quiz; correct indices are [0,1,2,3,0].
function seedBasic(opts?: {
  childClassId?: string;
  assignmentStatus?: 'active' | 'cancelled';
  quizLength?: number;
}) {
  fakeStore.docs.clear();
  fakeStore.writes.length = 0;

  fakeStore.docs.set(`studyAssignments/${ASSIGNMENT_ID}`, {
    id: ASSIGNMENT_ID,
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    curriculumId: CURRICULUM_ID,
    chapterId: CHAPTER_ID,
    topicId: TOPIC_ID,
    topicName: 'Types of Forces',
    subjectName: 'science',
    assignedByTeacherUid: TEACHER_UID,
    assignedDate: '2026-05-29',
    status: opts?.assignmentStatus ?? 'active',
  });

  fakeStore.docs.set(`children/${CHILD_UID}`, {
    classId: {schoolId: SCHOOL_ID, classId: opts?.childClassId ?? CLASS_ID},
  });

  fakeStore.docs.set(`users/${CHILD_UID}`, {
    roles: ['child'],
    parentUid: PARENT_UID,
  });

  const correct = [0, 1, 2, 3, 0];
  const len = opts?.quizLength ?? 5;
  const quiz = correct.slice(0, len).map((c, i) => ({
    questionId: `q${i + 1}`,
    type: 'mcq',
    question: `Question ${i + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: c,
    explanation: `Because ${i + 1}.`,
  }));

  fakeStore.docs.set(
    `curriculum/${CURRICULUM_ID}/chapters/${CHAPTER_ID}/topics/${TOPIC_ID}`,
    {topicName: 'Types of Forces', status: 'published', quiz},
  );
}

function payload(
  answers: Array<{questionId: string; selectedIndex: number}>,
  uid = CHILD_UID,
) {
  return {
    auth: {uid, token: {phone_number: '+919999999999'}},
    data: {assignmentId: ASSIGNMENT_ID, answers},
  } as any;
}

const allCorrect = [
  {questionId: 'q1', selectedIndex: 0},
  {questionId: 'q2', selectedIndex: 1},
  {questionId: 'q3', selectedIndex: 2},
  {questionId: 'q4', selectedIndex: 3},
  {questionId: 'q5', selectedIndex: 0},
];

async function invoke(req: any): Promise<any> {
  const handler = (submitQuizAttempt as any).run ?? submitQuizAttempt;
  return (handler as (r: any) => Promise<any>)(req);
}

beforeEach(() => {
  mockRoleAllowed = true;
});

describe('submitQuizAttempt', () => {
  test('all-correct submission scores 100% and passes', async () => {
    seedBasic();
    const out = await invoke(payload(allCorrect));
    expect(out.score).toBe(5);
    expect(out.total).toBe(5);
    expect(out.percentage).toBe(100);
    expect(out.passed).toBe(true);
    expect(out.firstPass).toBe(true);
    expect(out.attemptId).toBe(ATTEMPT_ID);
    expect(out.results.every((r: any) => r.isCorrect)).toBe(true);

    const writes = fakeStore.writes.filter(w =>
      w.path.startsWith('quizAttempts/'),
    );
    expect(writes.length).toBe(1);
    const doc = fakeStore.docs.get(`quizAttempts/${ATTEMPT_ID}`)!;
    expect(doc.passed).toBe(true);
    expect(doc.attemptCount).toBe(1);
    expect(doc.bestScore).toBe(5);
    expect(doc.childUid).toBe(CHILD_UID);
    expect(doc.parentUid).toBe(PARENT_UID);
    expect(doc.assignedByTeacherUid).toBe(TEACHER_UID);
    expect(doc.firstPassedAt).toBe('__serverTimestamp__');
  });

  test('partial-correct below 60% does not pass', async () => {
    seedBasic();
    // 2/5 = 40%
    const out = await invoke(
      payload([
        {questionId: 'q1', selectedIndex: 0},
        {questionId: 'q2', selectedIndex: 1},
        {questionId: 'q3', selectedIndex: 0},
        {questionId: 'q4', selectedIndex: 0},
        {questionId: 'q5', selectedIndex: 3},
      ]),
    );
    expect(out.score).toBe(2);
    expect(out.percentage).toBe(40);
    expect(out.passed).toBe(false);
    expect(out.firstPass).toBe(false);
  });

  test('tampered selectedIndex cannot inflate score (server re-grades)', async () => {
    seedBasic();
    // Client claims everything is index 0; only q1 + q5 are actually 0.
    const out = await invoke(
      payload([
        {questionId: 'q1', selectedIndex: 0},
        {questionId: 'q2', selectedIndex: 0},
        {questionId: 'q3', selectedIndex: 0},
        {questionId: 'q4', selectedIndex: 0},
        {questionId: 'q5', selectedIndex: 0},
      ]),
    );
    expect(out.score).toBe(2);
    expect(out.passed).toBe(false);
  });

  test('forged extra answers for unknown questions are ignored', async () => {
    seedBasic();
    const out = await invoke(
      payload([
        ...allCorrect,
        {questionId: 'does_not_exist', selectedIndex: 0},
      ]),
    );
    expect(out.score).toBe(5);
    expect(out.total).toBe(5);
  });

  test('retake: best/last tracked, passed sticky, firstPass only once', async () => {
    seedBasic();
    // Attempt 1: fail (40%).
    const a1 = await invoke(
      payload([
        {questionId: 'q1', selectedIndex: 0},
        {questionId: 'q2', selectedIndex: 1},
        {questionId: 'q3', selectedIndex: 0},
        {questionId: 'q4', selectedIndex: 0},
        {questionId: 'q5', selectedIndex: 3},
      ]),
    );
    expect(a1.passed).toBe(false);
    expect(a1.firstPass).toBe(false);

    // Attempt 2: pass (100%). firstPass true.
    const a2 = await invoke(payload(allCorrect));
    expect(a2.passed).toBe(true);
    expect(a2.firstPass).toBe(true);

    // Attempt 3: fail again (40%) -- passed stays sticky-true, firstPass false.
    const a3 = await invoke(
      payload([
        {questionId: 'q1', selectedIndex: 0},
        {questionId: 'q2', selectedIndex: 1},
        {questionId: 'q3', selectedIndex: 0},
        {questionId: 'q4', selectedIndex: 0},
        {questionId: 'q5', selectedIndex: 3},
      ]),
    );
    expect(a3.passed).toBe(false); // this attempt's result
    expect(a3.firstPass).toBe(false);

    const doc = fakeStore.docs.get(`quizAttempts/${ATTEMPT_ID}`)!;
    expect(doc.attemptCount).toBe(3);
    expect(doc.passed).toBe(true); // sticky across retakes
    expect(doc.bestScore).toBe(5);
    expect(doc.bestPercentage).toBe(100);
    expect(doc.lastScore).toBe(2); // latest attempt
    expect(doc.lastPercentage).toBe(40);
  });

  test('non-child caller -> permission-denied', async () => {
    seedBasic();
    mockRoleAllowed = false;
    await expect(invoke(payload(allCorrect))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  test('child not in the assignment class -> permission-denied', async () => {
    seedBasic({childClassId: 'class_other'});
    await expect(invoke(payload(allCorrect))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  test('cancelled assignment -> failed-precondition', async () => {
    seedBasic({assignmentStatus: 'cancelled'});
    await expect(invoke(payload(allCorrect))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  test('missing assignmentId -> invalid-argument', async () => {
    seedBasic();
    const req = {
      auth: {uid: CHILD_UID, token: {}},
      data: {answers: allCorrect},
    } as any;
    await expect(invoke(req)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });
});
