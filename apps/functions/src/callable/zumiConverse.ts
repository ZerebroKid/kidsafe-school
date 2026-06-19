/**
 * Zumi real-time chat turn (greeting, friendly chat, experiment follow-up,
 * discovery validation, closing). The child app never holds the Gemini key --
 * it calls this callable with the current `stage` + short `history`, and the
 * server derives the child's name/grade and the stage's AI context from the
 * topic's `voiceStory` so prompts stay server-controlled.
 *
 * Phase A (PR1): when `sessionId` is provided, transcript + summary + signals
 * are persisted in `zumiSessions` and used as Gemini context. Old clients
 * without `sessionId` keep the previous client-history behaviour.
 *
 * Auth: signed-in child of the assignment's class (see `resolveVoiceContext`).
 *
 * On any AI failure this STILL returns 200 with a safe canned Hinglish line so
 * the on-device session never gets stuck mid-conversation.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {requireAuth, requireRole} from '../lib/auth';
import {geminiApiKey, converse, type ChatTurn} from '../lib/zumiAi';
import {resolveVoiceContext} from '../lib/zumiSession';
import {
  appendTurn,
  ensureSession,
  finalizeSession,
  loadPromptContext,
  updateSignals,
  type IncomingSignals,
} from '../lib/zumiTranscriptStore';

export type ZumiStage =
  | 'greeting'
  | 'chat'
  | 'story_intro'
  | 'predict'
  | 'experiment_followup'
  | 'discovery'
  | 'closing';

export interface ZumiConverseInput {
  assignmentId: string;
  stage?: ZumiStage;
  /** Recent turns (legacy clients without sessionId). Ignored when sessionId set. */
  history?: ChatTurn[];
  /** Quiz percentage (0-100), only meaningful for `stage === 'closing'`. */
  scorePercent?: number;
  /** Phase A — server-side session memory. Optional for backward compatibility. */
  sessionId?: string;
  /** Last user utterance for this turn (session path). */
  childUtterance?: string;
  conversationalSignals?: IncomingSignals;
  sessionFinalize?: {status: 'completed' | 'abandoned'};
}

export interface ZumiConverseOutput {
  reply: string;
}

const FALLBACK_LINE: Record<ZumiStage, string> = {
  greeting: 'Hi! Main Zumi hoon, tumhara naya dost. Tumhara naam kya hai?',
  chat: 'Arre wah, mast! Mujhe tumse baat karke maza aa raha hai!',
  story_intro: 'Suno na, aaj mere saath kuch bahut interesting hua!',
  predict: 'Hmm, tumhe kya lagta hai? Ek guess karo!',
  experiment_followup: 'Shabaash! Bahut accha observe kiya tumne!',
  discovery: 'Wah, tum toh bahut smart ho! Bilkul sahi soch rahe ho!',
  closing: 'Aaj bahut maza aaya! Kal phir milte hain, theek hai? Bye!',
};

const VALID_STAGES: ZumiStage[] = [
  'greeting',
  'chat',
  'story_intro',
  'predict',
  'experiment_followup',
  'discovery',
  'closing',
];

function buildContext(
  stage: ZumiStage,
  ctx: Awaited<ReturnType<typeof resolveVoiceContext>>,
  scorePercent: number,
): string {
  const vs = ctx.voiceStory;
  switch (stage) {
    case 'greeting':
      return (
        `Greet ${ctx.childName || 'the child'} warmly by name and start a genuine get-to-know-you chat, ` +
        `like an excited new friend meeting them for the first time. Ask their name and how their day is going. ` +
        `Do NOT mention any lesson, story, or experiment yet -- this is pure friendly small talk. ` +
        `Keep it to 2-3 short, playful Hinglish sentences and end with exactly one simple question.`
      );
    case 'chat':
      return (
        `Continue the friendly small talk and make it feel REAL: directly react to the exact thing the child ` +
        `just said (repeat back a detail, sound delighted/surprised), THEN ask ONE new light personal ` +
        `follow-up. Rotate topics across turns so it never repeats -- their friends, what games they play, ` +
        `favourite cartoon, favourite food, pets, what makes them laugh. Never ask the same question twice. ` +
        `Still absolutely NO lesson, concept, or story yet. Keep it to 1-2 short Hinglish sentences and end ` +
        `with exactly one simple question.`
      );
    case 'story_intro':
      return (
        `Now gently shift from small talk into a story. ` +
        (ctx.childName
          ? `Address the child by name ("Sun na ${ctx.childName}...") and `
          : `Use the child's name from the chat so far (if they told you) and `) +
        `start with something like "aaj mere saath na kuch interesting hua..." and then naturally begin ` +
        `telling this little real-life story as if it happened to you today: ${vs.hookContext}. ` +
        `Sound excited and curious, and end by inviting the child into the story. 2-3 short sentences.`
      );
    case 'predict':
      return (
        `Continue the story by asking the child to predict/guess what would happen. ` +
        `Use this prompt naturally and wait for their guess: ${vs.predictContext}`
      );
    case 'experiment_followup':
      return `The child just did a small physical experiment. React warmly to what they observed and gently affirm it.`;
    case 'discovery':
      return (
        `The child is trying to discover the concept in their own words. ` +
        `Validate and celebrate enthusiastically if they're on track. Lead question was: ${vs.discoveryLeadQuestion}`
      );
    case 'closing': {
      const closing =
        scorePercent >= 75
          ? vs.closingHighScoreContext
          : scorePercent >= 50
            ? vs.closingMidScoreContext
            : vs.closingLowScoreContext;
      return `Wrap up the session warmly. ${closing}`;
    }
    default:
      return 'Have a warm, encouraging chat.';
  }
}

function legacyHistory(history: unknown): ChatTurn[] {
  return Array.isArray(history)
    ? history
        .filter(
          (t): t is ChatTurn =>
            !!t &&
            (t.role === 'user' || t.role === 'assistant') &&
            typeof t.content === 'string',
        )
        .slice(-8)
        .map(t => ({role: t.role, content: t.content.slice(0, 250)}))
    : [];
}

export const zumiConverse = onCall<
  ZumiConverseInput,
  Promise<ZumiConverseOutput>
>(
  {region: 'asia-south1', minInstances: 1, secrets: [geminiApiKey]},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const {
      assignmentId,
      stage,
      history,
      scorePercent,
      sessionId,
      childUtterance,
      conversationalSignals,
      sessionFinalize,
    } = request.data ?? ({} as Partial<ZumiConverseInput>);

    const ctx = await resolveVoiceContext(caller.uid, assignmentId as string);

    const sid =
      typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;

    // Finalize session without an AI turn (Phase A).
    if (sid && sessionFinalize?.status) {
      await ensureSession(sid, caller.uid, ctx);
      await finalizeSession(sid, caller.uid, sessionFinalize.status);
      return {reply: ''};
    }

    if (typeof stage !== 'string' || !VALID_STAGES.includes(stage as ZumiStage)) {
      throw new HttpsError('invalid-argument', 'A valid stage is required.');
    }

    const stageKey = stage as ZumiStage;
    const pct =
      typeof scorePercent === 'number' && Number.isFinite(scorePercent)
        ? Math.max(0, Math.min(100, scorePercent))
        : 0;

    // Legacy path — no sessionId (backward compatible).
    if (!sid) {
      try {
        const reply = await converse({
          childName: ctx.childName,
          grade: ctx.grade,
          context: buildContext(stageKey, ctx, pct),
          history: legacyHistory(history),
        });
        return {reply: reply || FALLBACK_LINE[stageKey]};
      } catch {
        return {reply: FALLBACK_LINE[stageKey]};
      }
    }

    // Session-backed path (Phase A PR1).
    await ensureSession(sid, caller.uid, ctx);
    await updateSignals(sid, caller.uid, conversationalSignals);

    const utterance =
      typeof childUtterance === 'string' ? childUtterance.trim().slice(0, 250) : '';
    if (utterance.length > 0) {
      await appendTurn(sid, caller.uid, {
        role: 'user',
        content: utterance,
        ts: Date.now(),
        stage: stageKey,
        kind: 'primary',
      });
    }

    const {summary, recentTurns, signals} = await loadPromptContext(sid, caller.uid);

    try {
      const reply = await converse({
        childName: ctx.childName,
        grade: ctx.grade,
        context: buildContext(stageKey, ctx, pct),
        history: recentTurns,
        summary,
        signals,
      });
      const line = reply || FALLBACK_LINE[stageKey];
      await appendTurn(sid, caller.uid, {
        role: 'assistant',
        content: line,
        ts: Date.now(),
        stage: stageKey,
        kind: 'primary',
      });
      return {reply: line};
    } catch {
      return {reply: FALLBACK_LINE[stageKey]};
    }
  },
);
