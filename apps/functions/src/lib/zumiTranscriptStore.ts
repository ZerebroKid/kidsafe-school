/**
 * Firestore-backed session memory for Zumi voice sessions (`zumiSessions`).
 *
 * Keeps a rolling `summary` plus the last RECENT_TURNS_CAP verbatim turns.
 * When the transcript grows past SUMMARIZE_WHEN_LENGTH, older turns are
 * compressed into `summary` via Gemini (see `zumiAi.summarizeTranscript`).
 *
 * Written exclusively from `zumiConverse` and `zumiEvaluateAnswer` (Admin SDK).
 */

import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';

import {db} from './admin';
import {summarizeTranscript, type ChatTurn} from './zumiAi';
import type {VoiceContext} from './zumiSession';

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export type TranscriptKind = 'primary' | 'follow_up' | 'quiz_feedback';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  stage?: string;
  kind?: TranscriptKind;
}

export interface SessionSignals {
  emptyResponseCount: number;
  totalUserTurns: number;
  lastSpeechDurationMs?: number;
  lastPauseCount?: number;
  lastSpeakingSpeedWpm?: number;
  /** 0–100 heuristic for future analytics; not surfaced in reports (Phase A). */
  engagementScore: number;
}

export interface IncomingSignals {
  emptyResponseCount?: number;
  speechDurationMs?: number;
  pauseCount?: number;
  speakingSpeedWpm?: number;
}

export interface PromptContext {
  summary: string;
  recentTurns: ChatTurn[];
  signals: SessionSignals;
}

export const RECENT_TURNS_CAP = 12;
export const SUMMARIZE_WHEN_LENGTH = 16;
export const EVICT_COUNT = 8;
export const SUMMARY_MAX_CHARS = 800;
export const CONTENT_MAX_CHARS = 250;

const COLLECTION = 'zumiSessions';

/** Generic praise / transition lines — not stored as assistant transcript. */
const ASSISTANT_FILLER_PATTERNS: RegExp[] = [
  /^great job!?\s*$/i,
  /^awesome!?\s*$/i,
  /^very good!?\s*$/i,
  /^let'?s continue\.?\s*$/i,
  /^good job!?\s*$/i,
  /^well done!?\s*$/i,
  /^nice!?\s*$/i,
  /^perfect!?\s*$/i,
  /^shabaash!?\s*$/i,
  /^wah!?\s*$/i,
  /^accha!?\s*$/i,
  /^theek hai!?\s*$/i,
  /^chalo!?\s*$/i,
  /^aage badhte hain\.?\s*$/i,
];

interface SessionDoc {
  sessionId: string;
  assignmentId: string;
  childUid: string;
  schoolId: string;
  classId: string;
  curriculumId: string;
  chapterId: string;
  topicId: string;
  topicName: string;
  status: SessionStatus;
  summary: string;
  transcript: TranscriptEntry[];
  signals: SessionSignals;
  startedAt?: unknown;
  updatedAt?: unknown;
  completedAt?: unknown;
}

function defaultSignals(): SessionSignals {
  return {
    emptyResponseCount: 0,
    totalUserTurns: 0,
    engagementScore: 0,
  };
}

function clampContent(text: string): string {
  return (text ?? '').trim().slice(0, CONTENT_MAX_CHARS);
}

/**
 * Whether an assistant turn should be persisted. User turns are always stored
 * (when non-empty). Instructional kinds are always kept; generic filler praise
 * is dropped.
 */
export function shouldStoreTranscriptEntry(entry: TranscriptEntry): boolean {
  const content = clampContent(entry.content);
  if (content.length === 0) return false;

  if (entry.role === 'user') return true;

  if (entry.kind === 'follow_up' || entry.kind === 'quiz_feedback') {
    return true;
  }

  if (isGenericAssistantFiller(content)) return false;

  return true;
}

function isGenericAssistantFiller(content: string): boolean {
  const clean = content.trim();
  if (clean.length === 0) return true;
  if (ASSISTANT_FILLER_PATTERNS.some(p => p.test(clean))) return true;
  // Very short exclamation-only lines with no instructional substance.
  if (clean.length <= 18 && !/\?/.test(clean) && !/\./.test(clean.slice(1))) {
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length <= 3 && ASSISTANT_FILLER_PATTERNS.some(p => p.test(clean))) {
      return true;
    }
  }
  return false;
}

export function computeEngagementScore(signals: SessionSignals): number {
  const base = Math.min(100, signals.totalUserTurns * 12);
  let penalty = signals.emptyResponseCount * 8;
  if (
    typeof signals.lastSpeechDurationMs === 'number' &&
    signals.lastSpeechDurationMs < 1500
  ) {
    penalty += 5;
  }
  if (typeof signals.lastPauseCount === 'number' && signals.lastPauseCount >= 3) {
    penalty += 5;
  }
  return Math.max(0, Math.min(100, base - penalty));
}

function sessionRef(sessionId: string) {
  return db().collection(COLLECTION).doc(sessionId);
}

async function getSessionDoc(sessionId: string) {
  const ref = sessionRef(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return {ref, data: snap.data() as SessionDoc};
}

function assertOwner(data: SessionDoc, childUid: string): void {
  if (data.childUid !== childUid) {
    throw new HttpsError('permission-denied', 'Not your Zumi session.');
  }
}

/** Lazy-create a session doc on first use. Idempotent for same sessionId. */
export async function ensureSession(
  sessionId: string,
  childUid: string,
  ctx: VoiceContext,
): Promise<void> {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return;

  const ref = sessionRef(sessionId);
  const snap = await ref.get();
  if (snap.exists) {
    assertOwner(snap.data() as SessionDoc, childUid);
    return;
  }

  await ref.set({
    sessionId,
    assignmentId: ctx.assignmentId,
    childUid,
    schoolId: ctx.schoolId,
    classId: ctx.classId,
    curriculumId: ctx.curriculumId,
    chapterId: ctx.chapterId,
    topicId: ctx.topicId,
    topicName: ctx.topicName,
    status: 'active' as SessionStatus,
    summary: '',
    transcript: [] as TranscriptEntry[],
    signals: defaultSignals(),
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Merge incoming conversational signals and recompute engagementScore. */
export async function updateSignals(
  sessionId: string,
  childUid: string,
  incoming: IncomingSignals | undefined,
): Promise<void> {
  if (!sessionId || !incoming) return;

  const loaded = await getSessionDoc(sessionId);
  if (!loaded) return;
  assertOwner(loaded.data, childUid);

  const prev = loaded.data.signals ?? defaultSignals();
  const next: SessionSignals = {
    ...prev,
    emptyResponseCount: Math.max(
      prev.emptyResponseCount,
      typeof incoming.emptyResponseCount === 'number'
        ? incoming.emptyResponseCount
        : prev.emptyResponseCount,
    ),
    lastSpeechDurationMs:
      typeof incoming.speechDurationMs === 'number'
        ? incoming.speechDurationMs
        : prev.lastSpeechDurationMs,
    lastPauseCount:
      typeof incoming.pauseCount === 'number'
        ? incoming.pauseCount
        : prev.lastPauseCount,
    lastSpeakingSpeedWpm:
      typeof incoming.speakingSpeedWpm === 'number'
        ? incoming.speakingSpeedWpm
        : prev.lastSpeakingSpeedWpm,
    totalUserTurns: prev.totalUserTurns,
    engagementScore: prev.engagementScore,
  };
  next.engagementScore = computeEngagementScore(next);

  await loaded.ref.update({
    signals: next,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function deterministicSummaryFallback(
  existingSummary: string,
  evicted: TranscriptEntry[],
): string {
  const lines = evicted.map(
    e => `${e.role}: ${clampContent(e.content)}`,
  );
  const chunk = lines.join(' | ');
  const merged = existingSummary
    ? `${existingSummary} ${chunk}`
    : chunk;
  return merged.slice(0, SUMMARY_MAX_CHARS);
}

async function maybeSummarizeAndTrim(
  summary: string,
  transcript: TranscriptEntry[],
): Promise<{summary: string; transcript: TranscriptEntry[]}> {
  if (transcript.length <= SUMMARIZE_WHEN_LENGTH) {
    return {summary, transcript};
  }

  const evicted = transcript.slice(0, EVICT_COUNT);
  const remaining = transcript.slice(EVICT_COUNT);

  let newSummary: string;
  try {
    newSummary = await summarizeTranscript(summary, evicted);
  } catch {
    newSummary = deterministicSummaryFallback(summary, evicted);
  }

  if (newSummary.length > SUMMARY_MAX_CHARS) {
    newSummary = newSummary.slice(0, SUMMARY_MAX_CHARS);
  }

  return {
    summary: newSummary,
    transcript: remaining.slice(-RECENT_TURNS_CAP),
  };
}

/** Append a turn; filter assistant filler; summarize when over threshold. */
export async function appendTurn(
  sessionId: string,
  childUid: string,
  entry: TranscriptEntry,
): Promise<void> {
  if (!sessionId) return;

  const normalized: TranscriptEntry = {
    ...entry,
    content: clampContent(entry.content),
    ts: entry.ts || Date.now(),
  };

  if (!shouldStoreTranscriptEntry(normalized)) return;

  const loaded = await getSessionDoc(sessionId);
  if (!loaded) return;
  assertOwner(loaded.data, childUid);

  let transcript = [...(loaded.data.transcript ?? []), normalized];
  let summary = loaded.data.summary ?? '';

  const prev = loaded.data.signals ?? defaultSignals();
  const signals: SessionSignals = {
    ...prev,
    totalUserTurns:
      normalized.role === 'user'
        ? prev.totalUserTurns + 1
        : prev.totalUserTurns,
  };
  signals.engagementScore = computeEngagementScore(signals);

  ({summary, transcript} = await maybeSummarizeAndTrim(summary, transcript));

  await loaded.ref.update({
    transcript,
    summary,
    signals,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Load summary + recent turns + signals for Gemini prompt assembly. */
export async function loadPromptContext(
  sessionId: string,
  childUid: string,
): Promise<PromptContext> {
  if (!sessionId) {
    return {summary: '', recentTurns: [], signals: defaultSignals()};
  }

  const loaded = await getSessionDoc(sessionId);
  if (!loaded) {
    return {summary: '', recentTurns: [], signals: defaultSignals()};
  }
  assertOwner(loaded.data, childUid);

  const transcript = loaded.data.transcript ?? [];
  const recent = transcript.slice(-RECENT_TURNS_CAP);
  return {
    summary: loaded.data.summary ?? '',
    recentTurns: recent.map(t => ({
      role: t.role,
      content: t.content,
    })),
    signals: loaded.data.signals ?? defaultSignals(),
  };
}

/** Mark session completed or abandoned; optional final summarize. */
export async function finalizeSession(
  sessionId: string,
  childUid: string,
  status: 'completed' | 'abandoned',
): Promise<void> {
  if (!sessionId) return;

  const loaded = await getSessionDoc(sessionId);
  if (!loaded) return;
  assertOwner(loaded.data, childUid);

  let summary = loaded.data.summary ?? '';
  let transcript = loaded.data.transcript ?? [];

  if (transcript.length > RECENT_TURNS_CAP) {
    ({summary, transcript} = await maybeSummarizeAndTrim(summary, transcript));
  }

  await loaded.ref.update({
    status,
    summary,
    transcript,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Exposed for tests — load raw signals after updates. */
export async function getSessionSignals(
  sessionId: string,
  childUid: string,
): Promise<SessionSignals | null> {
  const loaded = await getSessionDoc(sessionId);
  if (!loaded) return null;
  assertOwner(loaded.data, childUid);
  return loaded.data.signals ?? null;
}
