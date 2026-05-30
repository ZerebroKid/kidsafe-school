/**
 * P5.1 -- unit tests for the class-report aggregator core.
 *
 * Injected-fake-db style (like onQuizAttemptWrite.test.ts): a tiny in-memory
 * Firestore that supports the exact surface the core touches --
 *   collection('quizAttempts').where('assignedDate','==',x).get()
 *   collection('schools').doc(s).collection('classes').doc(c).get()
 *   collection('classReports').doc(c).collection('daily').doc(date)  (write target)
 *   collection('classReports').doc(c)                                (write target)
 *   batch().set(ref, data, {merge}).commit()
 * -- then call `aggregateClassReportsForDate(db, date)` directly. No emulator.
 */

import {aggregateClassReportsForDate} from '../aggregateClassReports';

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {serverTimestamp: () => '__ts__'},
}));

interface FakeState {
  docs: Map<string, Record<string, unknown>>;
  writes: Array<{path: string; data: Record<string, unknown>; merge: boolean}>;
}

function makeFakeDb(seed: Record<string, Record<string, unknown>> = {}): {
  db: any;
  state: FakeState;
} {
  const state: FakeState = {docs: new Map(Object.entries(seed)), writes: []};

  function makeDocRef(path: string): any {
    const id = path.slice(path.lastIndexOf('/') + 1);
    return {
      id,
      path,
      collection: (name: string) => makeCollection(`${path}/${name}`),
      get: async () => ({
        exists: state.docs.has(path),
        id,
        data: () => state.docs.get(path),
      }),
      set: async (data: Record<string, unknown>, options?: {merge?: boolean}) => {
        const merge = options?.merge === true;
        state.docs.set(path, merge ? {...(state.docs.get(path) ?? {}), ...data} : data);
        state.writes.push({path, data, merge});
      },
    };
  }

  function makeCollection(prefix: string): any {
    return {
      doc: (id: string) => makeDocRef(`${prefix}/${id}`),
      where: (field: string, op: string, value: unknown) =>
        makeQuery(prefix, [[field, op, value]]),
    };
  }

  function makeQuery(prefix: string, filters: Array<[string, string, unknown]>): any {
    return {
      where: (field: string, op: string, value: unknown) =>
        makeQuery(prefix, [...filters, [field, op, value]]),
      get: async () => {
        const docs: any[] = [];
        for (const [path, data] of state.docs.entries()) {
          if (!path.startsWith(`${prefix}/`)) continue;
          const rest = path.slice(prefix.length + 1);
          if (rest.includes('/')) continue; // direct children only
          let match = true;
          for (const [field, op, value] of filters) {
            if (op === '==' && data[field] !== value) {
              match = false;
              break;
            }
          }
          if (match) docs.push({id: rest, data: () => data});
        }
        return {empty: docs.length === 0, docs, size: docs.length};
      },
    };
  }

  const db = {
    collection: (name: string) => makeCollection(name),
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set: (ref: any, data: Record<string, unknown>, options?: {merge?: boolean}) => {
          ops.push(() => ref.set(data, options));
        },
        commit: async () => {
          for (const op of ops) await op();
        },
      };
    },
  };

  return {db, state};
}

const DATE = '2026-05-29';

function attempt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    assignedDate: DATE,
    schoolId: 'school_a',
    classId: 'class_8a',
    childUid: 'child_1',
    topicId: 'forces',
    topicName: 'Forces',
    subjectName: 'science',
    bestPercentage: 80,
    passed: true,
    ...overrides,
  };
}

const CLASS_8A = {
  'schools/school_a/classes/class_8a': {
    className: 'Class 8A',
    teacherIds: ['teacher_1', 'teacher_2'],
    studentChildUids: ['child_1', 'child_2', 'child_3'],
  },
};

function dailyDoc(state: FakeState, classId = 'class_8a', date = DATE) {
  return state.docs.get(`classReports/${classId}/daily/${date}`)!;
}
function pointerDoc(state: FakeState, classId = 'class_8a') {
  return state.docs.get(`classReports/${classId}`)!;
}

describe('aggregateClassReportsForDate', () => {
  test('writes a daily doc + pointer doc carrying schoolId and teacherIds', async () => {
    const {db, state} = makeFakeDb({
      'quizAttempts/a1': attempt(),
      ...CLASS_8A,
    });

    const res = await aggregateClassReportsForDate(db, DATE, {source: 'cron'});

    expect(res).toEqual({date: DATE, classesWritten: 1, attemptsScanned: 1});

    const daily = dailyDoc(state);
    expect(daily.date).toBe(DATE);
    expect(daily.schoolId).toBe('school_a');
    expect(daily.classId).toBe('class_8a');
    expect(daily.teacherIds).toEqual(['teacher_1', 'teacher_2']);
    expect(daily.rosterSize).toBe(3);
    expect(daily.source).toBe('cron');
    expect(daily.generatedAt).toBe('__ts__');

    const ptr = pointerDoc(state);
    expect(ptr.schoolId).toBe('school_a');
    expect(ptr.teacherIds).toEqual(['teacher_1', 'teacher_2']);
    expect(ptr.className).toBe('Class 8A');
    expect(ptr.lastDailyDate).toBe(DATE);
  });

  test('groups by class and counts distinct students even with multiple topics', async () => {
    const {db, state} = makeFakeDb({
      // child_1 attempts two topics; child_2 one topic -> 2 distinct students.
      'quizAttempts/a1': attempt({childUid: 'child_1', topicId: 'forces', bestPercentage: 90}),
      'quizAttempts/a2': attempt({childUid: 'child_1', topicId: 'pressure', topicName: 'Pressure', bestPercentage: 50, passed: false}),
      'quizAttempts/a3': attempt({childUid: 'child_2', topicId: 'forces', bestPercentage: 70}),
      // a different class on the same day
      'quizAttempts/b1': attempt({classId: 'class_8b', childUid: 'child_9', bestPercentage: 40, passed: false}),
      ...CLASS_8A,
      'schools/school_a/classes/class_8b': {
        className: 'Class 8B',
        teacherIds: ['teacher_3'],
        studentChildUids: ['child_9'],
      },
    });

    const res = await aggregateClassReportsForDate(db, DATE);
    expect(res.classesWritten).toBe(2);
    expect(res.attemptsScanned).toBe(4);

    const a = dailyDoc(state, 'class_8a');
    expect(a.totalAttempts).toBe(3);
    expect(a.attemptedStudents).toBe(2); // child_1, child_2 distinct
    expect(a.passedStudents).toBe(2); // both passed >=1 topic
    // avg of 90,50,70 = 70
    expect(a.avgBestPercentage).toBe(70);

    const b = dailyDoc(state, 'class_8b');
    expect(b.totalAttempts).toBe(1);
    expect(b.attemptedStudents).toBe(1);
    expect(b.passedStudents).toBe(0);
  });

  test('per-topic stats sorted weakest-first by avgBestPercentage', async () => {
    const {db, state} = makeFakeDb({
      'quizAttempts/a1': attempt({topicId: 'strong', topicName: 'Strong', bestPercentage: 95}),
      'quizAttempts/a2': attempt({childUid: 'child_2', topicId: 'weak', topicName: 'Weak', bestPercentage: 30, passed: false}),
      'quizAttempts/a3': attempt({childUid: 'child_3', topicId: 'mid', topicName: 'Mid', bestPercentage: 60}),
      ...CLASS_8A,
    });

    await aggregateClassReportsForDate(db, DATE);
    const topics = dailyDoc(state).topics as Array<Record<string, unknown>>;
    expect(topics.map(t => t.topicId)).toEqual(['weak', 'mid', 'strong']);
    expect(topics[0]).toMatchObject({
      topicId: 'weak',
      topicName: 'Weak',
      subjectName: 'science',
      attemptedStudents: 1,
      passedStudents: 0,
      avgBestPercentage: 30,
      weak: true,
    });
    // 60 is NOT weak (strict `<` threshold); 95 is strong.
    expect(topics.map(t => t.weak)).toEqual([true, false, false]);
  });

  test('pointer weakTopics holds only <60 topics, weakest-first, with date', async () => {
    const {db, state} = makeFakeDb({
      'quizAttempts/a1': attempt({topicId: 'strong', topicName: 'Strong', bestPercentage: 95}),
      'quizAttempts/a2': attempt({childUid: 'child_2', topicId: 'weak', topicName: 'Weak', bestPercentage: 30, passed: false}),
      'quizAttempts/a3': attempt({childUid: 'child_3', topicId: 'edge', topicName: 'Edge', bestPercentage: 60}),
      'quizAttempts/a4': attempt({childUid: 'child_1', topicId: 'low', topicName: 'Low', bestPercentage: 45, passed: false}),
      ...CLASS_8A,
    });

    await aggregateClassReportsForDate(db, DATE);
    const ptr = pointerDoc(state);
    const weak = ptr.weakTopics as Array<Record<string, unknown>>;
    // Only 'weak' (30) and 'low' (45); 'edge' (60) and 'strong' (95) excluded.
    expect(weak.map(t => t.topicId)).toEqual(['weak', 'low']);
    expect(weak.every(t => t.weak === true)).toBe(true);
    expect(ptr.weakTopicsDate).toBe(DATE);
  });

  test('all-strong class writes an empty weakTopics list', async () => {
    const {db, state} = makeFakeDb({
      'quizAttempts/a1': attempt({topicId: 't1', bestPercentage: 80}),
      'quizAttempts/a2': attempt({childUid: 'child_2', topicId: 't2', bestPercentage: 60}),
      ...CLASS_8A,
    });
    await aggregateClassReportsForDate(db, DATE);
    expect(pointerDoc(state).weakTopics).toEqual([]);
  });

  test('recovered class clears its previous weakTopics on re-run', async () => {
    const {db, state} = makeFakeDb({
      'quizAttempts/a1': attempt({topicId: 't1', bestPercentage: 30, passed: false}),
      ...CLASS_8A,
    });
    await aggregateClassReportsForDate(db, DATE);
    expect((pointerDoc(state).weakTopics as unknown[]).length).toBe(1);

    // Scores recover above threshold; re-run must clear the stale weak list.
    state.docs.set('quizAttempts/a1', attempt({topicId: 't1', bestPercentage: 85}));
    await aggregateClassReportsForDate(db, DATE);
    expect(pointerDoc(state).weakTopics).toEqual([]);
  });

  test('avgBestPercentage rounds the mean', async () => {
    const {db, state} = makeFakeDb({
      'quizAttempts/a1': attempt({topicId: 't', childUid: 'child_1', bestPercentage: 80}),
      'quizAttempts/a2': attempt({topicId: 't', childUid: 'child_2', bestPercentage: 81}),
      ...CLASS_8A,
    });
    await aggregateClassReportsForDate(db, DATE);
    // mean(80,81)=80.5 -> 81
    expect(dailyDoc(state).avgBestPercentage).toBe(81);
  });

  test('idempotent: re-running the same date overwrites (no merge) the daily doc', async () => {
    const seed = {
      'quizAttempts/a1': attempt({bestPercentage: 80}),
      ...CLASS_8A,
    };
    const {db, state} = makeFakeDb(seed);
    await aggregateClassReportsForDate(db, DATE);
    expect(dailyDoc(state).avgBestPercentage).toBe(80);

    // Mutate the attempt and re-run -> daily doc reflects the new value, not a merge.
    state.docs.set('quizAttempts/a1', attempt({bestPercentage: 40}));
    await aggregateClassReportsForDate(db, DATE);
    expect(dailyDoc(state).avgBestPercentage).toBe(40);
    expect(dailyDoc(state).totalAttempts).toBe(1);
  });

  test('classes with zero attempts produce no doc', async () => {
    const {db, state} = makeFakeDb({
      // no quizAttempts at all
      ...CLASS_8A,
    });
    const res = await aggregateClassReportsForDate(db, DATE);
    expect(res).toEqual({date: DATE, classesWritten: 0, attemptsScanned: 0});
    expect(state.docs.has(`classReports/class_8a/daily/${DATE}`)).toBe(false);
    expect(state.docs.has('classReports/class_8a')).toBe(false);
  });

  test('attempts for a different date are ignored', async () => {
    const {db, state} = makeFakeDb({
      'quizAttempts/a1': attempt({assignedDate: '2026-05-28'}),
      ...CLASS_8A,
    });
    const res = await aggregateClassReportsForDate(db, DATE);
    expect(res.attemptsScanned).toBe(0);
    expect(state.docs.has(`classReports/class_8a/daily/${DATE}`)).toBe(false);
  });

  test('missing class doc -> empty teacherIds, rosterSize 0, still writes daily doc', async () => {
    const {db, state} = makeFakeDb({
      'quizAttempts/a1': attempt(),
      // no schools/school_a/classes/class_8a doc
    });
    const res = await aggregateClassReportsForDate(db, DATE);
    expect(res.classesWritten).toBe(1);
    const daily = dailyDoc(state);
    expect(daily.teacherIds).toEqual([]);
    expect(daily.rosterSize).toBe(0);
    // pointer doc omits className when class doc is absent
    expect(pointerDoc(state).className).toBeUndefined();
  });
});
