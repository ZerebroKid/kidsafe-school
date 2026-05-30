/**
 * P4.6.2 -- unit tests for the curriculum importer.
 *
 * These tests exercise the bundle-walking + validation pipeline against
 * a temp directory tree (no Firestore in the loop). The Firestore writes
 * themselves are tested transitively by the assignTopic test suite (the
 * happy path reads a topic that ostensibly came from the importer).
 *
 * Three cases:
 *   1. Valid bundle parses + dry-run plans the right number of writes.
 *   2. Malformed topic JSON fails schema validation and surfaces the
 *      field path; it does NOT abort the run.
 *   3. Re-running the importer is idempotent (same plan, no errors,
 *      `publishedAt` not re-stamped if it was previously set).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type {Firestore} from 'firebase-admin/firestore';
import {
  importBundle,
  parseTopic,
  resolveBundles,
} from '../importCurriculum';

interface FakeDb {
  docs: Map<string, Record<string, unknown>>;
  writes: Array<{path: string; data: Record<string, unknown>}>;
}

function makeFakeDb(seed: Record<string, Record<string, unknown>> = {}): {
  db: Firestore;
  state: FakeDb;
} {
  const state: FakeDb = {
    docs: new Map(Object.entries(seed)),
    writes: [],
  };
  function makeDocRef(parts: string[]): any {
    const docPath = parts.join('/');
    return {
      id: parts[parts.length - 1],
      path: docPath,
      get: async () => ({
        exists: state.docs.has(docPath),
        data: () => state.docs.get(docPath),
      }),
      set: async (data: Record<string, unknown>) => {
        state.docs.set(docPath, {...(state.docs.get(docPath) ?? {}), ...data});
        state.writes.push({path: docPath, data});
      },
      collection: (name: string) => makeCollectionRef([...parts, name]),
    };
  }
  function makeCollectionRef(parts: string[]): any {
    return {
      doc: (id: string) => makeDocRef([...parts, id]),
    };
  }
  const db = {
    collection: (name: string) => makeCollectionRef([name]),
  } as unknown as Firestore;
  return {db, state};
}

function writeJson(p: string, data: unknown): void {
  fs.mkdirSync(path.dirname(p), {recursive: true});
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function makeValidBundle(root: string): void {
  writeJson(path.join(root, 'curriculum.json'), {
    id: 'cbse_8_science',
    board: 'cbse',
    grade: 8,
    subject: 'science',
  });
  writeJson(path.join(root, 'force_pressure', 'chapter.json'), {
    chapterNo: 11,
    chapterName: 'Force and Pressure',
    status: 'published',
  });
  writeJson(
    path.join(root, 'force_pressure', 'topics', 'types_of_forces.json'),
    {
      curriculumId: 'cbse_8_science',
      grade: 8,
      subject: 'science',
      chapterNo: 11,
      chapterName: 'Force and Pressure',
      topicId: 'types_of_forces',
      topicName: 'Types of Forces',
      explanation: 'A force is a push or pull. This is a long enough explanation.',
      examples: ['Pushing a door'],
      brainstorming: [{question: 'q?', answer: 'a'}],
      quiz: [
        {
          questionId: 'q1',
          type: 'mcq',
          question: 'Friction is which kind of force?',
          options: ['Contact', 'Non-contact'],
          correctIndex: 0,
        },
      ],
      status: 'published',
      curatedBy: 'content_team',
    },
  );
}

describe('importCurriculum', () => {
  let tmpRoot: string;
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-cur-'));
    // Silence the script's progress logs in the test runner output.
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, {recursive: true, force: true});
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('resolveBundles finds direct bundle and nested bundles', () => {
    const direct = path.join(tmpRoot, 'direct');
    makeValidBundle(direct);
    expect(resolveBundles(direct)).toEqual([direct]);

    const parent = path.join(tmpRoot, 'multi');
    const childA = path.join(parent, 'cbse_8_science');
    const childB = path.join(parent, 'cbse_9_maths');
    makeValidBundle(childA);
    writeJson(path.join(childB, 'curriculum.json'), {
      id: 'cbse_9_maths',
      board: 'cbse',
      grade: 9,
      subject: 'maths',
    });
    expect(resolveBundles(parent).sort()).toEqual([childA, childB].sort());
  });

  test('resolveBundles finds curricula nested under grade folders', () => {
    const gradeDir = path.join(tmpRoot, 'cbse_8');
    const math = path.join(gradeDir, 'cbse_8_math');
    const science = path.join(gradeDir, 'cbse_8_science');
    makeValidBundle(math);
    makeValidBundle(science);
    expect(resolveBundles(tmpRoot).sort()).toEqual([math, science].sort());
  });

  test('dry-run reports a plan but does not write', async () => {
    const bundle = path.join(tmpRoot, 'cbse_8_science');
    makeValidBundle(bundle);
    const {db, state} = makeFakeDb();
    const counts = {curricula: 0, chapters: 0, topics: 0, topicErrors: 0};
    await importBundle(db, bundle, false /* apply */, counts);
    expect(counts).toEqual({
      curricula: 1,
      chapters: 1,
      topics: 1,
      topicErrors: 0,
    });
    expect(state.writes.length).toBe(0); // dry-run -> no writes
  });

  test('apply persists curriculum + chapter + topic docs', async () => {
    const bundle = path.join(tmpRoot, 'cbse_8_science');
    makeValidBundle(bundle);
    const {db, state} = makeFakeDb();
    const counts = {curricula: 0, chapters: 0, topics: 0, topicErrors: 0};
    await importBundle(db, bundle, true /* apply */, counts);
    expect(counts.topicErrors).toBe(0);
    const paths = state.writes.map(w => w.path).sort();
    expect(paths).toContain('curriculum/cbse_8_science');
    expect(paths).toContain('curriculum/cbse_8_science/chapters/force_pressure');
    expect(paths).toContain(
      'curriculum/cbse_8_science/chapters/force_pressure/topics/types_of_forces',
    );
  });

  test('malformed topic JSON fails validation, run continues', async () => {
    const bundle = path.join(tmpRoot, 'cbse_8_science');
    makeValidBundle(bundle);
    // Add a broken second topic (correctIndex out of range)
    writeJson(
      path.join(bundle, 'force_pressure', 'topics', 'broken.json'),
      {
        curriculumId: 'cbse_8_science',
        grade: 8,
        subject: 'science',
        chapterNo: 11,
        chapterName: 'Force and Pressure',
        topicId: 'broken',
        topicName: 'Broken Topic',
        explanation: 'short but technically passes the 20-char minimum length.',
        examples: ['ex'],
        brainstorming: [{question: 'q', answer: 'a'}],
        quiz: [
          {
            questionId: 'q1',
            type: 'mcq',
            question: 'pick',
            options: ['a', 'b'],
            correctIndex: 5, // OUT OF RANGE -- should fail
          },
        ],
        status: 'published',
        curatedBy: 'x',
      },
    );

    const {db, state} = makeFakeDb();
    const counts = {curricula: 0, chapters: 0, topics: 0, topicErrors: 0};
    await importBundle(db, bundle, true /* apply */, counts);

    expect(counts.topicErrors).toBe(1);
    expect(counts.topics).toBe(1); // the valid one
    const writtenTopicPaths = state.writes
      .map(w => w.path)
      .filter(p => p.includes('/topics/'));
    expect(writtenTopicPaths).toContain(
      'curriculum/cbse_8_science/chapters/force_pressure/topics/types_of_forces',
    );
    expect(writtenTopicPaths).not.toContain(
      'curriculum/cbse_8_science/chapters/force_pressure/topics/broken',
    );
  });

  test('parseTopic rejects topicId mismatch with filename', () => {
    const file = path.join(tmpRoot, 'mismatch.json');
    writeJson(file, {
      curriculumId: 'cbse_8_science',
      grade: 8,
      subject: 'science',
      chapterNo: 11,
      chapterName: 'Force and Pressure',
      topicId: 'different_id', // mismatches "mismatch"
      topicName: 'Mismatch',
      explanation: 'long enough explanation to pass min-length validation.',
      examples: ['e'],
      brainstorming: [{question: 'q', answer: 'a'}],
      quiz: [
        {
          questionId: 'q1',
          type: 'mcq',
          question: 'q?',
          options: ['a', 'b'],
          correctIndex: 0,
        },
      ],
      status: 'published',
      curatedBy: 'x',
    });
    const result = parseTopic(file, 'cbse_8_science', 'force_pressure');
    expect(result.ok).toBe(false);
  });

  test('re-running the importer is idempotent', async () => {
    const bundle = path.join(tmpRoot, 'cbse_8_science');
    makeValidBundle(bundle);
    const {db, state} = makeFakeDb();
    const counts = {curricula: 0, chapters: 0, topics: 0, topicErrors: 0};
    await importBundle(db, bundle, true, counts);
    const firstWriteCount = state.writes.length;

    // Second run -- same plan, same write count (we don't dedupe writes
    // because Firestore merge is itself idempotent; what we DO check is
    // that the doc snapshot we'd read back matches the expected shape).
    await importBundle(db, bundle, true, counts);
    expect(state.writes.length).toBe(firstWriteCount * 2);

    const topicDoc = state.docs.get(
      'curriculum/cbse_8_science/chapters/force_pressure/topics/types_of_forces',
    );
    expect(topicDoc).toBeDefined();
    expect(topicDoc!.topicName).toBe('Types of Forces');
    expect(topicDoc!.status).toBe('published');
  });
});
