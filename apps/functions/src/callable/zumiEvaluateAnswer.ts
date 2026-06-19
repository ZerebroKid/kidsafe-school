/**
 * Evaluate ONE spoken Zumi quiz answer.
 *
 * Called once per quiz question during the session. It both:
 *   1. returns the verdict so the screen can immediately play Zumi's correct/
 *      partial/incorrect line, and
 *   2. PERSISTS the authoritative verdict to
 *      `quizVoiceEvals/{assignmentId}_{childUid}.answers[questionId]`.
 *
 * `submitQuizAttempt` (voice mode) later reads ONLY these server-written
 * verdicts to compute the score, so the client can never inflate it -- the
 * same server-is-source-of-truth guarantee the MCQ path has.
 *
 * Auth: signed-in child of the assignment's class (see `resolveVoiceContext`).
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';
import {openaiApiKey, evaluateAnswer, type EvalVerdict} from '../lib/zumiAi';
import {resolveVoiceContext, voiceEvalDocId} from '../lib/zumiSession';

export interface ZumiEvaluateInput {
  assignmentId: string;
  questionId: string;
  transcript: string;
}

export interface ZumiEvaluateOutput {
  result: EvalVerdict;
  score: number;
  reasoning: string;
  /** Warm Hinglish line Zumi speaks back, tuned to the verdict + answer. */
  feedback: string;
}

export const zumiEvaluateAnswer = onCall<
  ZumiEvaluateInput,
  Promise<ZumiEvaluateOutput>
>({region: 'asia-south1', secrets: [openaiApiKey]}, async request => {
  const caller = requireAuth(request);
  await requireRole(caller.uid, 'child');

  const {assignmentId, questionId, transcript} =
    request.data ?? ({} as Partial<ZumiEvaluateInput>);

  if (typeof questionId !== 'string' || questionId.length === 0) {
    throw new HttpsError('invalid-argument', 'questionId is required.');
  }

  const ctx = await resolveVoiceContext(caller.uid, assignmentId as string);

  const question = ctx.voiceStory.voiceQuiz.find(q => q.questionId === questionId);
  if (!question) {
    throw new HttpsError('not-found', 'Quiz question not found in this story.');
  }

  const cleanTranscript =
    typeof transcript === 'string' ? transcript.slice(0, 1000) : '';

  // Evaluate (AI with deterministic keyword fallback baked into evaluateAnswer).
  const verdict = await evaluateAnswer({
    childName: ctx.childName,
    grade: ctx.grade,
    questionText: question.questionText,
    expectedConcepts: Array.isArray(question.expectedConcepts)
      ? question.expectedConcepts
      : [],
    correctIndicator: question.correctIndicator ?? '',
    transcript: cleanTranscript,
  });

  // Persist the authoritative verdict (deep-merge so sibling answers survive).
  const evalRef = db()
    .collection('quizVoiceEvals')
    .doc(voiceEvalDocId(ctx.assignmentId, caller.uid));
  await evalRef.set(
    {
      assignmentId: ctx.assignmentId,
      childUid: caller.uid,
      classId: ctx.classId,
      answers: {
        [questionId]: {
          result: verdict.result,
          score: verdict.score,
          transcript: cleanTranscript,
          reasoning: verdict.reasoning,
          evaluatedAt: Date.now(),
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true},
  );

  return {
    result: verdict.result,
    score: verdict.score,
    reasoning: verdict.reasoning,
    feedback: verdict.feedback,
  };
});
