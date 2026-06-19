/**
 * Shared resolver for the Zumi voice callables (`zumiConverse`,
 * `zumiEvaluateAnswer`).
 *
 * Mirrors the assignment -> class-membership -> topic authorization chain in
 * `submitQuizAttempt.ts` so a child can only drive a Zumi session for an
 * assignment of their OWN class, and only for a topic that actually has a
 * `voiceStory`. Centralised here so the two callables stay small and can't
 * drift apart on the security checks.
 */

import {HttpsError} from 'firebase-functions/v2/https';

import {db} from './admin';
import type {VoiceQuizQuestion} from './sharedTypes';

export interface VoiceStoryLite {
  hookContext: string;
  predictContext: string;
  discoveryLeadQuestion: string;
  discoveryCelebration: string;
  closingHighScoreContext: string;
  closingMidScoreContext: string;
  closingLowScoreContext: string;
  parentTryTonight: string;
  voiceQuiz: VoiceQuizQuestion[];
}

export interface VoiceContext {
  assignmentId: string;
  schoolId: string;
  classId: string;
  curriculumId: string;
  chapterId: string;
  topicId: string;
  topicName: string;
  /** Topic grade (denormalised on the topic doc). Falls back to 3 if missing. */
  grade: number;
  /** Child's display name from `users/{uid}.displayName` (best-effort). */
  childName: string;
  voiceStory: VoiceStoryLite;
}

/**
 * Resolve + authorize a voice session for `uid` against `assignmentId`.
 * Throws the same HttpsError contract as `submitQuizAttempt`.
 */
export async function resolveVoiceContext(
  uid: string,
  assignmentId: string,
): Promise<VoiceContext> {
  if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
    throw new HttpsError('invalid-argument', 'assignmentId is required.');
  }

  const assignmentSnap = await db()
    .collection('studyAssignments')
    .doc(assignmentId)
    .get();
  if (!assignmentSnap.exists) {
    throw new HttpsError('not-found', 'Assignment not found.');
  }
  const assignment = assignmentSnap.data() ?? {};
  if (assignment.status !== 'active') {
    throw new HttpsError(
      'failed-precondition',
      'This assignment is no longer active.',
    );
  }

  const classId = String(assignment.classId ?? '');
  const curriculumId = String(assignment.curriculumId ?? '');
  const chapterId = String(assignment.chapterId ?? '');
  const topicId = String(assignment.topicId ?? '');

  // Authorize: caller is a child of this class.
  const childSnap = await db().collection('children').doc(uid).get();
  const childClassId =
    childSnap.exists &&
    childSnap.data()?.classId &&
    typeof childSnap.data()?.classId === 'object'
      ? String((childSnap.data()?.classId as {classId?: unknown}).classId ?? '')
      : '';
  if (!childClassId || childClassId !== classId) {
    throw new HttpsError(
      'permission-denied',
      'You can only play Zumi for your own class.',
    );
  }

  // Load topic + voiceStory.
  const topicSnap = await db()
    .collection('curriculum')
    .doc(curriculumId)
    .collection('chapters')
    .doc(chapterId)
    .collection('topics')
    .doc(topicId)
    .get();
  if (!topicSnap.exists) {
    throw new HttpsError('not-found', 'Topic content not found.');
  }
  const topic = topicSnap.data() ?? {};
  const voiceStory = topic.voiceStory as VoiceStoryLite | undefined;
  if (!voiceStory || !Array.isArray(voiceStory.voiceQuiz)) {
    throw new HttpsError(
      'failed-precondition',
      'This topic has no Zumi voice story.',
    );
  }

  const grade =
    typeof topic.grade === 'number' && Number.isFinite(topic.grade)
      ? topic.grade
      : 3;

  // Best-effort child display name: try Firestore first, then Firebase Auth.
  let childName = '';
  const userSnap = await db().collection('users').doc(uid).get();
  const rawName = userSnap.exists ? userSnap.data()?.displayName : undefined;
  if (typeof rawName === 'string' && rawName.trim().length > 0) {
    childName = rawName.trim();
  }
  if (!childName) {
    try {
      const authUser = await import('./admin').then(m => m.auth().getUser(uid));
      const authName = authUser.displayName;
      if (typeof authName === 'string' && authName.trim().length > 0) {
        childName = authName.trim().split(/\s+/)[0];
      }
    } catch {
      // auth lookup failed — proceed with empty name
    }
  }

  return {
    assignmentId,
    schoolId: String(assignment.schoolId ?? ''),
    classId,
    curriculumId,
    chapterId,
    topicId,
    topicName: String(assignment.topicName ?? topicId),
    grade,
    childName,
    voiceStory,
  };
}

/** Deterministic id for the per-(assignment, child) voice eval record. */
export function voiceEvalDocId(assignmentId: string, uid: string): string {
  return `${assignmentId}_${uid}`;
}
