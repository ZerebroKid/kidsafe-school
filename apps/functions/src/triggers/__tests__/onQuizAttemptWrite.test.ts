/**
 * P4.10.2 -- unit tests for the reward-unlock trigger core.
 *
 * Uses the injected-fake-db style (like importCurriculum.test.ts): build a
 * tiny in-memory Firestore supporting collection().doc().get()/set() and a
 * chained where().where().get() for the rewardCatalog query, then call
 * `handleQuizAttemptWrite(db, ...)` directly. No emulator, no jest.mock.
 */

import {handleQuizAttemptWrite} from '../onQuizAttemptWrite';

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {serverTimestamp: () => '__serverTimestamp__'},
}));

interface FakeState {
  docs: Map<string, Record<string, unknown>>;
  writes: Array<{path: string; data: Record<string, unknown>}>;
}

function makeFakeDb(seed: Record<string, Record<string, unknown>> = {}): {
  db: any;
  state: FakeState;
} {
  const state: FakeState = {
    docs: new Map(Object.entries(seed)),
    writes: [],
  };

  function makeDocRef(collectionName: string, id: string): any {
    const path = `${collectionName}/${id}`;
    return {
      id,
      path,
      get: async () => ({
        exists: state.docs.has(path),
        id,
        data: () => state.docs.get(path),
      }),
      set: async (data: Record<string, unknown>) => {
        state.docs.set(path, {...(state.docs.get(path) ?? {}), ...data});
        state.writes.push({path, data});
      },
    };
  }

  function makeQuery(collectionName: string, filters: Array<[string, string, unknown]>): any {
    return {
      where: (field: string, op: string, value: unknown) =>
        makeQuery(collectionName, [...filters, [field, op, value]]),
      get: async () => {
        const docs: any[] = [];
        for (const [path, data] of state.docs.entries()) {
          if (!path.startsWith(`${collectionName}/`)) continue;
          const id = path.slice(collectionName.length + 1);
          if (id.includes('/')) continue; // top-level docs only
          let match = true;
          for (const [field, op, value] of filters) {
            if (op === '==' && data[field] !== value) {
              match = false;
              break;
            }
            if (op === 'array-contains') {
              const arr = data[field];
              if (!Array.isArray(arr) || !arr.includes(value)) {
                match = false;
                break;
              }
            }
          }
          if (match) docs.push({id, data: () => data});
        }
        return {empty: docs.length === 0, docs};
      },
    };
  }

  const db = {
    collection: (name: string) => ({
      doc: (id: string) => makeDocRef(name, id),
      where: (field: string, op: string, value: unknown) =>
        makeQuery(name, [[field, op, value]]),
    }),
  };

  return {db, state};
}

const ATTEMPT_ID = 'class_8a_types_of_forces_2026-05-29_child_u1';

function passedAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTEMPT_ID,
    childUid: 'child_u1',
    parentUid: 'parent_u1',
    schoolId: 'school_a',
    classId: 'class_8a',
    topicId: 'types_of_forces',
    subjectName: 'science',
    grade: 8,
    passed: true,
    ...overrides,
  };
}

describe('handleQuizAttemptWrite', () => {
  test('first pass picks an eligible reward and writes the unlock', async () => {
    const {db, state} = makeFakeDb({
      'rewardCatalog/r1': {
        type: 'youtube_link',
        title: 'Cool science clip',
        url: 'https://youtube.com/watch?v=abc',
        subjectTags: ['science'],
        grades: [8],
        moderationStatus: 'approved',
      },
    });

    const res = await handleQuizAttemptWrite(
      db,
      ATTEMPT_ID,
      {passed: false},
      passedAttempt(),
      {pickIndex: () => 0},
    );

    expect(res.unlocked).toBe(true);
    expect(res.rewardId).toBe('r1');
    const unlock = state.docs.get(`rewardUnlocks/${ATTEMPT_ID}`)!;
    expect(unlock.attemptId).toBe(ATTEMPT_ID);
    expect(unlock.childUid).toBe('child_u1');
    expect(unlock.parentUid).toBe('parent_u1');
    expect(unlock.rewardId).toBe('r1');
    expect(unlock.rewardTitle).toBe('Cool science clip');
    expect(unlock.rewardUrl).toBe('https://youtube.com/watch?v=abc');
    expect(unlock.unlockedAt).toBe('__serverTimestamp__');
  });

  test('not a first-pass transition -> no unlock', async () => {
    const {db, state} = makeFakeDb({
      'rewardCatalog/r1': {
        type: 'youtube_link',
        title: 'x',
        url: 'y',
        subjectTags: ['science'],
        moderationStatus: 'approved',
      },
    });

    // already passed before -> retake after pass should NOT re-unlock
    const res = await handleQuizAttemptWrite(
      db,
      ATTEMPT_ID,
      {passed: true},
      passedAttempt(),
    );
    expect(res.unlocked).toBe(false);
    expect(res.reason).toBe('not-first-pass');
    expect(state.docs.has(`rewardUnlocks/${ATTEMPT_ID}`)).toBe(false);
  });

  test('idempotent: existing unlock doc -> no second write', async () => {
    const {db, state} = makeFakeDb({
      'rewardCatalog/r1': {
        type: 'youtube_link',
        title: 'x',
        url: 'y',
        subjectTags: ['science'],
        moderationStatus: 'approved',
      },
      [`rewardUnlocks/${ATTEMPT_ID}`]: {id: ATTEMPT_ID, rewardId: 'r1'},
    });

    const res = await handleQuizAttemptWrite(
      db,
      ATTEMPT_ID,
      {passed: false},
      passedAttempt(),
    );
    expect(res.unlocked).toBe(false);
    expect(res.reason).toBe('already-unlocked');
    expect(state.writes.length).toBe(0);
  });

  test('no eligible reward (wrong subject / not approved) -> no unlock', async () => {
    const {db, state} = makeFakeDb({
      'rewardCatalog/r1': {
        subjectTags: ['maths'],
        moderationStatus: 'approved',
        type: 'youtube_link',
        title: 'x',
        url: 'y',
      },
      'rewardCatalog/r2': {
        subjectTags: ['science'],
        moderationStatus: 'pending',
        type: 'youtube_link',
        title: 'x',
        url: 'y',
      },
    });

    const res = await handleQuizAttemptWrite(
      db,
      ATTEMPT_ID,
      {passed: false},
      passedAttempt(),
    );
    expect(res.unlocked).toBe(false);
    expect(res.reason).toBe('no-eligible-reward');
    expect(state.docs.has(`rewardUnlocks/${ATTEMPT_ID}`)).toBe(false);
  });

  test('subject matching is case-insensitive', async () => {
    const {db} = makeFakeDb({
      'rewardCatalog/r1': {
        subjectTags: ['science'],
        grades: [8],
        moderationStatus: 'approved',
        type: 'youtube_link',
        title: 'x',
        url: 'y',
      },
    });

    const res = await handleQuizAttemptWrite(
      db,
      ATTEMPT_ID,
      {passed: false},
      passedAttempt({subjectName: 'Science'}),
      {pickIndex: () => 0},
    );
    expect(res.unlocked).toBe(true);
  });

  test('same subject but different grade -> no unlock', async () => {
    const {db, state} = makeFakeDb({
      'rewardCatalog/r1': {
        subjectTags: ['science'],
        grades: [6, 7],
        moderationStatus: 'approved',
        type: 'youtube_link',
        title: 'x',
        url: 'y',
      },
    });

    const res = await handleQuizAttemptWrite(
      db,
      ATTEMPT_ID,
      {passed: false},
      passedAttempt({grade: 8}),
      {pickIndex: () => 0},
    );
    expect(res.unlocked).toBe(false);
    expect(res.reason).toBe('no-eligible-reward');
    expect(state.docs.has(`rewardUnlocks/${ATTEMPT_ID}`)).toBe(false);
  });

  test('attempt missing grade -> no-grade', async () => {
    const {db, state} = makeFakeDb({
      'rewardCatalog/r1': {
        subjectTags: ['science'],
        grades: [8],
        moderationStatus: 'approved',
        type: 'youtube_link',
        title: 'x',
        url: 'y',
      },
    });

    const res = await handleQuizAttemptWrite(
      db,
      ATTEMPT_ID,
      {passed: false},
      passedAttempt({grade: undefined}),
      {pickIndex: () => 0},
    );
    expect(res.unlocked).toBe(false);
    expect(res.reason).toBe('no-grade');
    expect(state.docs.has(`rewardUnlocks/${ATTEMPT_ID}`)).toBe(false);
  });

  test('reward without a grades list is not eligible', async () => {
    const {db, state} = makeFakeDb({
      'rewardCatalog/r1': {
        subjectTags: ['science'],
        moderationStatus: 'approved',
        type: 'youtube_link',
        title: 'legacy reward, no grades',
        url: 'y',
      },
    });

    const res = await handleQuizAttemptWrite(
      db,
      ATTEMPT_ID,
      {passed: false},
      passedAttempt(),
      {pickIndex: () => 0},
    );
    expect(res.unlocked).toBe(false);
    expect(res.reason).toBe('no-eligible-reward');
    expect(state.docs.has(`rewardUnlocks/${ATTEMPT_ID}`)).toBe(false);
  });

  test('deleted attempt doc -> no-op', async () => {
    const {db} = makeFakeDb();
    const res = await handleQuizAttemptWrite(db, ATTEMPT_ID, {passed: true}, undefined);
    expect(res.unlocked).toBe(false);
    expect(res.reason).toBe('deleted');
  });
});
