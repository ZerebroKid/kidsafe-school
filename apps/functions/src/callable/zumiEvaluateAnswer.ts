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
import {stepLogger} from '../lib/perf';
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
>(
  {region: 'asia-south1', minInstances: 0, secrets: [openaiApiKey]},
  async request => {
    const log = stepLogger('zumiEvaluateAnswer');
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const {assignmentId, questionId, transcript} =
      request.data ?? ({} as Partial<ZumiEvaluateInput>);

    if (typeof questionId !== 'string' || questionId.length === 0) {
      throw new HttpsError('invalid-argument', 'questionId is required.');
    }

    const cleanTranscript =
      typeof transcript === 'string' ? transcript.slice(0, 1000) : '';

    log.start({
      assignmentId,
      questionId,
      transcript: cleanTranscript.slice(0, 120),
    });

    const ctx = await log.step(
      'resolveContext',
      () => resolveVoiceContext(caller.uid, assignmentId as string),
      c => `topic=${c.topicId}`,
    );

    const question = ctx.voiceStory.voiceQuiz.find(q => q.questionId === questionId);
    if (!question) {
      throw new HttpsError('not-found', 'Quiz question not found in this story.');
    }

    // Evaluate (AI with deterministic keyword fallback baked into evaluateAnswer).
    const verdict = await log.step(
      'openai.evaluate',
      () =>
        evaluateAnswer({
          childName: ctx.childName,
          grade: ctx.grade,
          questionText: question.questionText,
          expectedConcepts: Array.isArray(question.expectedConcepts)
            ? question.expectedConcepts
            : [],
          correctIndicator: question.correctIndicator ?? '',
          transcript: cleanTranscript,
        }),
      v => `${v.result} (${v.score} pts) — ${v.reasoning.slice(0, 60)}`,
    );

    // Persist the authoritative verdict (deep-merge so sibling answers survive).
    const evalRef = db()
      .collection('quizVoiceEvals')
      .doc(voiceEvalDocId(ctx.assignmentId, caller.uid));
    await log.step('firestore.persist', () =>
      evalRef.set(
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
      ),
    );

    log.end({result: verdict.result, score: verdict.score});
    return {
      result: verdict.result,
      score: verdict.score,
      reasoning: verdict.reasoning,
      feedback: verdict.feedback,
    };
  },
);
