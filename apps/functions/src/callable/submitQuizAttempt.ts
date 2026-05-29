/**
 * P4.9.2 -- a child submits their quiz answers for an assigned topic.
 *
 * Inputs: {assignmentId, answers: [{questionId, selectedIndex}]}
 *
 * SERVER IS THE SOURCE OF TRUTH for scoring. The client sends only the raw
 * selections; the callable re-fetches the topic doc and grades against
 * `quiz[].correctIndex`, so a tampered `selectedIndex` (or a forged extra
 * answer) can never inflate the score.
 *
 * Validation chain (each step has a distinct HttpsError):
 *   1. `requireAuth` + `requireRole(uid, 'child')`.
 *   2. Input shape: non-empty `assignmentId` + an `answers[]` array.
 *   3. Assignment exists AND `status == 'active'`.
 *   4. Caller is a child OF THAT CLASS -- `children/{uid}.classId.classId`
 *      must equal the assignment's `classId` (mirrors the firestore/rules
 *      read predicate for studyAssignments / quizAttempts).
 *   5. Topic exists AND has a non-empty `quiz[]`.
 *
 * Grading: for each quiz question we look up the child's selection by
 * `questionId`, compare to `correctIndex`, and count correct answers.
 * `percentage = round(score / total * 100)`, `passed = percentage >= 60`.
 *
 * Persistence (retake-aware, locked decision -- unlimited retakes until pass):
 *   Deterministic doc id `{assignmentId}_{childUid}` => ONE doc per child per
 *   assignment, upserted in a transaction. Each submit bumps `attemptCount`,
 *   refreshes the `last*` fields, keeps the `best*` high-water mark, and flips
 *   `passed` sticky-true on the first clear of 60%. `firstPassedAt` is stamped
 *   exactly once -- it's the signal the `onQuizAttemptWrite` reward trigger
 *   uses to unlock a reward only on the FIRST pass.
 *
 * Returns the full graded breakdown so the ZKid result screen renders with no
 * second Firestore read.
 *
 * Error contract:
 *   - unauthenticated     -> caller not signed in
 *   - permission-denied   -> caller lacks 'child' OR isn't in the assignment's class
 *   - invalid-argument    -> inputs missing / wrong type
 *   - not-found           -> assignment / topic doc doesn't exist
 *   - failed-precondition -> assignment cancelled OR topic has no quiz
 *   - internal            -> Firestore write failed; the child can retry.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';
import type {
  QuizAnswerInput,
  QuizQuestionResult,
  SubmitQuizAttemptInput,
  SubmitQuizAttemptOutput,
} from '../lib/sharedTypes';

/** Locked pass threshold (percentage). */
const PASS_PERCENTAGE = 60;

interface QuizQuestionShape {
  questionId: string;
  correctIndex: number;
  explanation?: string;
  options?: unknown[];
}

export const submitQuizAttempt = onCall<
  SubmitQuizAttemptInput,
  Promise<SubmitQuizAttemptOutput>
>({region: 'asia-south1'}, async request => {
  const caller = requireAuth(request);
  await requireRole(caller.uid, 'child');

  const {assignmentId, answers} =
    request.data ?? ({} as Partial<SubmitQuizAttemptInput>);

  if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
    throw new HttpsError('invalid-argument', 'assignmentId is required.');
  }
  if (!Array.isArray(answers)) {
    throw new HttpsError('invalid-argument', 'answers must be an array.');
  }

  // Index the child's raw selections by questionId. We DON'T trust these for
  // the score -- we only use them to look up "what did the child pick for
  // question X". Last-write-wins on duplicate questionIds.
  const selectionByQuestion = new Map<string, number>();
  for (const a of answers) {
    if (
      a &&
      typeof (a as QuizAnswerInput).questionId === 'string' &&
      typeof (a as QuizAnswerInput).selectedIndex === 'number' &&
      Number.isFinite((a as QuizAnswerInput).selectedIndex)
    ) {
      selectionByQuestion.set(
        (a as QuizAnswerInput).questionId,
        (a as QuizAnswerInput).selectedIndex,
      );
    }
  }

  // ---- Resolve assignment ------------------------------------------------
  const assignmentRef = db().collection('studyAssignments').doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();
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

  const schoolId = String(assignment.schoolId ?? '');
  const classId = String(assignment.classId ?? '');
  const curriculumId = String(assignment.curriculumId ?? '');
  const chapterId = String(assignment.chapterId ?? '');
  const topicId = String(assignment.topicId ?? '');
  const topicName = String(assignment.topicName ?? topicId);
  const subjectName = String(assignment.subjectName ?? '');
  const assignedByTeacherUid = String(assignment.assignedByTeacherUid ?? '');
  const assignedDate = String(assignment.assignedDate ?? '');

  // ---- Authorize: caller is a child of this class ------------------------
  const childRef = db().collection('children').doc(caller.uid);
  const childSnap = await childRef.get();
  const childClassId =
    childSnap.exists &&
    childSnap.data()?.classId &&
    typeof childSnap.data()?.classId === 'object'
      ? String((childSnap.data()?.classId as {classId?: unknown}).classId ?? '')
      : '';
  if (!childClassId || childClassId !== classId) {
    throw new HttpsError(
      'permission-denied',
      'You can only submit quizzes for your own class.',
    );
  }

  // ---- Load topic + quiz (source of truth) -------------------------------
  const topicRef = db()
    .collection('curriculum')
    .doc(curriculumId)
    .collection('chapters')
    .doc(chapterId)
    .collection('topics')
    .doc(topicId);
  const topicSnap = await topicRef.get();
  if (!topicSnap.exists) {
    throw new HttpsError('not-found', 'Topic content not found.');
  }
  const topic = topicSnap.data() ?? {};
  // Denormalise the human-readable chapter name onto the attempt so report UIs
  // (parent Study tab) can show "which chapter" without an extra read.
  const chapterName = String(topic.chapterName ?? '');
  const quiz: QuizQuestionShape[] = Array.isArray(topic.quiz)
    ? (topic.quiz as QuizQuestionShape[])
    : [];
  if (quiz.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      'This topic has no quiz to submit.',
    );
  }

  // ---- Grade server-side -------------------------------------------------
  let score = 0;
  const results: QuizQuestionResult[] = quiz.map(q => {
    const correctIndex =
      typeof q.correctIndex === 'number' ? q.correctIndex : -1;
    const raw = selectionByQuestion.get(q.questionId);
    const selectedIndex =
      typeof raw === 'number' && Number.isFinite(raw) ? raw : -1;
    const isCorrect = selectedIndex === correctIndex && correctIndex >= 0;
    if (isCorrect) score += 1;
    return {
      questionId: q.questionId,
      selectedIndex,
      correctIndex,
      isCorrect,
      ...(typeof q.explanation === 'string' && q.explanation.length > 0
        ? {explanation: q.explanation}
        : {}),
    };
  });

  const total = quiz.length;
  const percentage = Math.round((score / total) * 100);
  const passedThisAttempt = percentage >= PASS_PERCENTAGE;

  // Best-effort parent link for denormalisation onto the attempt doc.
  let parentUid: string | undefined;
  const userSnap = await db().collection('users').doc(caller.uid).get();
  const rawParent = userSnap.exists ? userSnap.data()?.parentUid : undefined;
  if (typeof rawParent === 'string' && rawParent.length > 0) {
    parentUid = rawParent;
  }

  // Persist only the raw selections we actually scored against, so the stored
  // `lastAnswers` reflects exactly what the server graded.
  const gradedAnswers: QuizAnswerInput[] = results.map(r => ({
    questionId: r.questionId,
    selectedIndex: r.selectedIndex,
  }));

  // ---- Upsert the deterministic attempt doc ------------------------------
  const attemptId = `${assignmentId}_${caller.uid}`;
  const attemptRef = db().collection('quizAttempts').doc(attemptId);

  const firstPass = await db().runTransaction(async tx => {
    const snap = await tx.get(attemptRef);
    const prev = snap.exists ? (snap.data() ?? {}) : {};

    const prevPassed = prev.passed === true;
    const prevBestScore =
      typeof prev.bestScore === 'number' ? prev.bestScore : -1;
    const prevAttemptCount =
      typeof prev.attemptCount === 'number' ? prev.attemptCount : 0;

    const nowPassed = prevPassed || passedThisAttempt;
    const isFirstPass = !prevPassed && passedThisAttempt;
    const isBest = score > prevBestScore;

    tx.set(
      attemptRef,
      {
        id: attemptId,
        assignmentId,
        schoolId,
        classId,
        curriculumId,
        chapterId,
        chapterName,
        topicId,
        topicName,
        subjectName,
        childUid: caller.uid,
        ...(parentUid ? {parentUid} : {}),
        assignedByTeacherUid,
        assignedDate,
        total,
        attemptCount: prevAttemptCount + 1,
        lastScore: score,
        lastPercentage: percentage,
        lastAnswers: gradedAnswers,
        bestScore: isBest ? score : prevBestScore < 0 ? score : prevBestScore,
        bestPercentage: isBest
          ? percentage
          : typeof prev.bestPercentage === 'number'
            ? prev.bestPercentage
            : percentage,
        passed: nowPassed,
        ...(isFirstPass ? {firstPassedAt: FieldValue.serverTimestamp()} : {}),
        ...(snap.exists ? {} : {createdAt: FieldValue.serverTimestamp()}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

    return isFirstPass;
  });

  return {
    attemptId,
    score,
    total,
    percentage,
    passed: passedThisAttempt,
    firstPass,
    results,
  };
});
