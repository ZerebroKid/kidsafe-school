/**
 * P4.5 -- unit tests for the `assignTopic` callable.
 *
 * Approach: mock `../../lib/admin` with a minimal in-memory Firestore that
 * supports the operations the callable uses (collection().doc(), get(),
 * runTransaction with tx.get + tx.set, and collectionGroup().where().get()).
 * Mock `../../lib/auth.requireRole` to flip on demand. This avoids needing
 * the Firestore emulator running and keeps the tests fast.
 *
 * The mock is intentionally minimal -- it supports ONLY what assignTopic
 * does today. If new callables want to share this scaffolding we'll factor
 * out a richer fake into `lib/__tests_helpers__/fakeFirestore.ts`.
 */

// ---- mocks (must be declared BEFORE any import that they shadow) ---------

const fakeStore: {
  docs: Map<string, Record<string, unknown>>;
  writes: Array<{path: string; data: Record<string, unknown>}>;
} = {docs: new Map(), writes: []};

function pathKey(parts: string[]): string {
  return parts.join('/');
}

function makeDocRef(parts: string[]): any {
  const path = pathKey(parts);
  return {
    id: parts[parts.length - 1],
    path,
    parent: {
      parent:
        parts.length >= 3
          ? makeDocRef(parts.slice(0, parts.length - 2))
          : null,
    },
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
    where: () => makeCollectionRef(parts), // ignore filtering, tx callable doesn't use
  };
}

function makeCollectionGroup(name: string): any {
  // Records the filter expressions so individual tests can assert teacher
  // matching. Returns docs whose path matches `/teachers/{id}` where the
  // doc's `userId` field equals the where()'d uid (and status == 'active').
  let filters: Array<{field: string; op: string; value: unknown}> = [];
  const builder: any = {
    where(field: string, op: string, value: unknown) {
      filters = [...filters, {field, op, value}];
      return builder;
    },
    async get() {
      const docs: any[] = [];
      for (const [path, data] of fakeStore.docs.entries()) {
        if (!path.includes(`/${name}/`) && !path.startsWith(`${name}/`)) continue;
        let match = true;
        for (const f of filters) {
          if (f.op === '==' && data[f.field] !== f.value) {
            match = false;
            break;
          }
        }
        if (match) docs.push(makeDocSnap(path));
      }
      return {empty: docs.length === 0, docs};
    },
  };
  return builder;
}

const fakeDb = {
  collection: (name: string) => makeCollectionRef([name]),
  collectionGroup: makeCollectionGroup,
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

let mockRoleAllowed = true;
jest.mock('../../lib/auth', () => ({
  requireAuth: (req: any) => ({uid: req.auth?.uid, phone: '+919999999999'}),
  requireRole: async () => {
    if (!mockRoleAllowed) {
      const {HttpsError} = require('firebase-functions/v2/https');
      throw new HttpsError('permission-denied', 'This action requires the teacher role.');
    }
  },
}));

// ---- imports under test ---------------------------------------------------

import {assignTopic} from '../assignTopic';

// ---- helpers --------------------------------------------------------------

const TEACHER_UID = 'teacher_u1';
const OTHER_TEACHER_UID = 'teacher_other';
const SCHOOL_ID = 'school_a';
const CLASS_ID = 'class_8a';
const CHAPTER_ID = 'force_pressure';
const TOPIC_ID = 'types_of_forces';
const CURRICULUM_ID = 'cbse_8_science';

function seedBasic(opts?: {topicStatus?: 'published' | 'draft'; teacherIds?: string[]}) {
  fakeStore.docs.clear();
  fakeStore.writes.length = 0;

  fakeStore.docs.set(`schools/${SCHOOL_ID}`, {
    name: 'Test School',
    principalUid: 'principal_p1',
  });
  fakeStore.docs.set(`schools/${SCHOOL_ID}/teachers/${TEACHER_UID}`, {
    userId: TEACHER_UID,
    displayName: 'Test Teacher',
    status: 'active',
  });
  fakeStore.docs.set(`schools/${SCHOOL_ID}/classes/${CLASS_ID}`, {
    grade: 8,
    section: 'A',
    className: '8A',
    teacherIds: opts?.teacherIds ?? [TEACHER_UID],
    studentChildUids: [],
  });
  fakeStore.docs.set(`curriculum/${CURRICULUM_ID}`, {
    id: CURRICULUM_ID,
    board: 'cbse',
    grade: 8,
    subject: 'science',
  });
  fakeStore.docs.set(
    `curriculum/${CURRICULUM_ID}/chapters/${CHAPTER_ID}/topics/${TOPIC_ID}`,
    {
      topicName: 'Types of Forces',
      status: opts?.topicStatus ?? 'published',
    },
  );
}

function callablePayload(uid = TEACHER_UID, dueAtOverride?: number) {
  return {
    auth: {uid, token: {phone_number: '+919999999999'}},
    data: {
      schoolId: SCHOOL_ID,
      classId: CLASS_ID,
      curriculumId: CURRICULUM_ID,
      chapterId: CHAPTER_ID,
      topicId: TOPIC_ID,
      dueAt: dueAtOverride ?? Date.now() + 60 * 60 * 1000,
    },
  } as any;
}

async function invoke(req: any): Promise<any> {
  // v2 onCall handlers can be invoked via .run({...request}) but the public
  // API only re-exports the wrapped fn; reach into the handler directly.
  const handler = (assignTopic as any).__endpoint
    ? (assignTopic as any).run
    : (assignTopic as any);
  // firebase-functions/v2 exposes the handler via `run` on the returned obj
  // for HTTPS callables in v2; fall back to calling directly for legacy.
  if (typeof handler === 'function') return handler(req);
  return (assignTopic as any)(req);
}

beforeEach(() => {
  mockRoleAllowed = true;
});

describe('assignTopic', () => {
  test('happy path writes a deterministic assignment doc', async () => {
    seedBasic();
    const out = await invoke(callablePayload());
    expect(out.alreadyExisted).toBe(false);
    expect(out.assignmentId).toMatch(
      new RegExp(`^${CLASS_ID}_${TOPIC_ID}_\\d{4}-\\d{2}-\\d{2}$`),
    );
    const writes = fakeStore.writes.filter(w =>
      w.path.startsWith('studyAssignments/'),
    );
    expect(writes.length).toBe(1);
    const written = writes[0]!.data;
    expect(written.schoolId).toBe(SCHOOL_ID);
    expect(written.classId).toBe(CLASS_ID);
    expect(written.topicId).toBe(TOPIC_ID);
    expect(written.topicName).toBe('Types of Forces');
    expect(written.curriculumId).toBe(CURRICULUM_ID);
    expect(written.subjectName).toBe('science');
    expect(written.assignedByTeacherUid).toBe(TEACHER_UID);
    expect(written.status).toBe('active');
  });

  test('non-teacher caller -> permission-denied', async () => {
    seedBasic();
    mockRoleAllowed = false;
    await expect(invoke(callablePayload())).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  test('teacher not in class.teacherIds -> permission-denied', async () => {
    seedBasic({teacherIds: [OTHER_TEACHER_UID]});
    await expect(invoke(callablePayload())).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  test('draft topic -> failed-precondition', async () => {
    seedBasic({topicStatus: 'draft'});
    await expect(invoke(callablePayload())).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  test('duplicate same-day assignment -> failed-precondition', async () => {
    seedBasic();
    const first = await invoke(callablePayload());
    expect(first.assignmentId).toBeTruthy();
    await expect(invoke(callablePayload())).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  test('dueAt > now + 30d -> invalid-argument', async () => {
    seedBasic();
    const tooFar = Date.now() + 31 * 24 * 60 * 60 * 1000;
    await expect(invoke(callablePayload(TEACHER_UID, tooFar))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  test('dueAt in the past -> invalid-argument', async () => {
    seedBasic();
    const past = Date.now() - 60 * 60 * 1000;
    await expect(invoke(callablePayload(TEACHER_UID, past))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });
});
