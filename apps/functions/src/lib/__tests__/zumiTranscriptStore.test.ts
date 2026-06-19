/**
 * Unit tests for `zumiTranscriptStore` — in-memory Firestore fake + mocked Gemini summarize.
 */

const fakeStore: {
  docs: Map<string, Record<string, unknown>>;
} = {docs: new Map()};

function makeDocRef(parts: string[]) {
  const path = parts.join('/');
  return {
    id: parts[parts.length - 1],
    path,
    get: async () => makeDocSnap(path),
    set: async (data: Record<string, unknown>) => {
      fakeStore.docs.set(path, {...data});
    },
    update: async (data: Record<string, unknown>) => {
      const prev = fakeStore.docs.get(path) ?? {};
      fakeStore.docs.set(path, {...prev, ...data});
    },
  };
}

function makeDocSnap(path: string) {
  const data = fakeStore.docs.get(path);
  return {
    exists: data !== undefined,
    id: path.split('/').pop()!,
    data: () => data,
  };
}

function makeCollectionRef(parts: string[]) {
  return {
    doc: (id: string) => makeDocRef([...parts, id]),
  };
}

jest.mock('../admin', () => ({
  db: () => ({
    collection: (name: string) => makeCollectionRef([name]),
  }),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__ts__',
  },
}));

const summarizeTranscript = jest.fn(
  async (existing: string, evicted: {content: string}[]) => {
    const chunk = evicted.map(e => e.content).join(' ');
    return `${existing} ${chunk}`.trim().slice(0, 800);
  },
);

jest.mock('../zumiAi', () => ({
  summarizeTranscript: (existing: string, evicted: {content: string}[]) =>
    summarizeTranscript(existing, evicted),
}));

import {
  RECENT_TURNS_CAP,
  SUMMARIZE_WHEN_LENGTH,
  appendTurn,
  computeEngagementScore,
  ensureSession,
  finalizeSession,
  loadPromptContext,
  shouldStoreTranscriptEntry,
  updateSignals,
  CONTENT_MAX_CHARS,
} from '../zumiTranscriptStore';
import type {VoiceContext} from '../zumiSession';

const CHILD = 'child_1';
const SESSION = 'sess_test_1';

const mockCtx: VoiceContext = {
  assignmentId: 'assign_1',
  schoolId: 'school_1',
  classId: 'class_1',
  curriculumId: 'cbse_3_science',
  chapterId: 'ch_1',
  topicId: 'topic_1',
  topicName: 'Classification',
  grade: 3,
  childName: 'Aaru',
  voiceStory: {
    hookContext: 'hook',
    predictContext: 'predict',
    discoveryLeadQuestion: 'q',
    discoveryCelebration: 'yay',
    closingHighScoreContext: 'high',
    closingMidScoreContext: 'mid',
    closingLowScoreContext: 'low',
    parentTryTonight: 'try',
    voiceQuiz: [],
  },
};

beforeEach(() => {
  fakeStore.docs.clear();
  summarizeTranscript.mockClear();
});

describe('shouldStoreTranscriptEntry', () => {
  it('stores user turns', () => {
    expect(
      shouldStoreTranscriptEntry({
        role: 'user',
        content: 'Mera naam Aaru hai',
        ts: 1,
      }),
    ).toBe(true);
  });

  it('drops empty content', () => {
    expect(
      shouldStoreTranscriptEntry({role: 'user', content: '   ', ts: 1}),
    ).toBe(false);
  });

  it('drops generic assistant filler', () => {
    expect(
      shouldStoreTranscriptEntry({
        role: 'assistant',
        content: 'Great job!',
        ts: 1,
        kind: 'primary',
      }),
    ).toBe(false);
    expect(
      shouldStoreTranscriptEntry({
        role: 'assistant',
        content: 'Awesome',
        ts: 1,
      }),
    ).toBe(false);
    expect(
      shouldStoreTranscriptEntry({
        role: 'assistant',
        content: "Let's continue",
        ts: 1,
      }),
    ).toBe(false);
  });

  it('keeps instructional assistant content', () => {
    expect(
      shouldStoreTranscriptEntry({
        role: 'assistant',
        content:
          'Classification matlab cheezein unki quality dekh ke groups mein rakhna.',
        ts: 1,
        kind: 'primary',
      }),
    ).toBe(true);
  });

  it('always keeps follow_up and quiz_feedback kinds', () => {
    expect(
      shouldStoreTranscriptEntry({
        role: 'assistant',
        content: 'Great job!',
        ts: 1,
        kind: 'follow_up',
      }),
    ).toBe(true);
    expect(
      shouldStoreTranscriptEntry({
        role: 'assistant',
        content: 'Shabaash!',
        ts: 1,
        kind: 'quiz_feedback',
      }),
    ).toBe(true);
  });

  it('clamps content at CONTENT_MAX_CHARS', () => {
    const long = 'a'.repeat(300);
    expect(
      shouldStoreTranscriptEntry({role: 'user', content: long, ts: 1}),
    ).toBe(true);
    expect(CONTENT_MAX_CHARS).toBe(250);
  });
});

describe('computeEngagementScore', () => {
  it('returns 0–100', () => {
    const score = computeEngagementScore({
      emptyResponseCount: 0,
      totalUserTurns: 5,
      engagementScore: 0,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('penalizes empty responses', () => {
    const low = computeEngagementScore({
      emptyResponseCount: 3,
      totalUserTurns: 2,
      engagementScore: 0,
    });
    const high = computeEngagementScore({
      emptyResponseCount: 0,
      totalUserTurns: 2,
      engagementScore: 0,
    });
    expect(low).toBeLessThan(high);
  });
});

describe('ensureSession + appendTurn', () => {
  it('creates session doc idempotently', async () => {
    await ensureSession(SESSION, CHILD, mockCtx);
    await ensureSession(SESSION, CHILD, mockCtx);
    const snap = fakeStore.docs.get(`zumiSessions/${SESSION}`);
    expect(snap).toBeDefined();
    expect(snap?.childUid).toBe(CHILD);
    expect(snap?.status).toBe('active');
  });

  it('rejects wrong owner on append', async () => {
    await ensureSession(SESSION, CHILD, mockCtx);
    await expect(
      appendTurn(SESSION, 'other_child', {
        role: 'user',
        content: 'hi',
        ts: Date.now(),
      }),
    ).rejects.toMatchObject({code: 'permission-denied'});
  });

  it('appends user and assistant turns', async () => {
    await ensureSession(SESSION, CHILD, mockCtx);
    await appendTurn(SESSION, CHILD, {
      role: 'user',
      content: 'Namaste',
      ts: 1,
    });
    await appendTurn(SESSION, CHILD, {
      role: 'assistant',
      content: 'Hi dost! Tumhara naam kya hai?',
      ts: 2,
      kind: 'primary',
    });
    const snap = fakeStore.docs.get(`zumiSessions/${SESSION}`)!;
    const transcript = snap.transcript as {role: string; content: string}[];
    expect(transcript).toHaveLength(2);
    expect(transcript[0].role).toBe('user');
  });

  it('skips filler assistant turns', async () => {
    await ensureSession(SESSION, CHILD, mockCtx);
    await appendTurn(SESSION, CHILD, {
      role: 'assistant',
      content: 'Very good',
      ts: 1,
    });
    const snap = fakeStore.docs.get(`zumiSessions/${SESSION}`)!;
    expect((snap.transcript as unknown[]).length).toBe(0);
  });

  it('trims transcript and summarizes when over threshold', async () => {
    await ensureSession(SESSION, CHILD, mockCtx);
    for (let i = 0; i < SUMMARIZE_WHEN_LENGTH + 1; i++) {
      await appendTurn(SESSION, CHILD, {
        role: 'user',
        content: `turn ${i} meaningful answer about science topics`,
        ts: i,
      });
    }
    expect(summarizeTranscript).toHaveBeenCalled();
    const snap = fakeStore.docs.get(`zumiSessions/${SESSION}`)!;
    const transcript = snap.transcript as unknown[];
    expect(transcript.length).toBeLessThanOrEqual(RECENT_TURNS_CAP);
    expect(String(snap.summary).length).toBeGreaterThan(0);
  });
});

describe('updateSignals + loadPromptContext', () => {
  it('merges signals and sets engagementScore', async () => {
    await ensureSession(SESSION, CHILD, mockCtx);
    await updateSignals(SESSION, CHILD, {
      emptyResponseCount: 2,
      speechDurationMs: 1200,
      pauseCount: 4,
      speakingSpeedWpm: 35,
    });
    const ctx = await loadPromptContext(SESSION, CHILD);
    expect(ctx.signals.emptyResponseCount).toBe(2);
    expect(ctx.signals.engagementScore).toBeGreaterThanOrEqual(0);
    expect(ctx.recentTurns).toEqual([]);
  });
});

describe('finalizeSession', () => {
  it('sets completed status', async () => {
    await ensureSession(SESSION, CHILD, mockCtx);
    await finalizeSession(SESSION, CHILD, 'completed');
    const snap = fakeStore.docs.get(`zumiSessions/${SESSION}`)!;
    expect(snap.status).toBe('completed');
    expect(snap.completedAt).toBe('__ts__');
  });
});
