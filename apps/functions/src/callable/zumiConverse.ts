/**
 * Zumi simple chat turn -- only the bookend stages now: `greeting` (warm hello +
 * ask the child's name) and `closing` (wrap up based on the quiz score). The
 * whole adaptive lesson in between is handled by `zumiTeach`.
 *
 * The child app never holds the OpenAI key -- it calls this callable with the
 * `stage` + short `history`, and the server derives the child's name/grade and
 * the stage's AI context from the topic's `voiceStory` so prompts stay
 * server-controlled.
 *
 * Auth: signed-in child of the assignment's class (see `resolveVoiceContext`).
 *
 * On any AI failure this STILL returns 200 with a safe canned Hinglish line so
 * the on-device session never gets stuck mid-conversation.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {requireAuth, requireRole} from '../lib/auth';
import {openaiApiKey, converse, type ChatTurn} from '../lib/zumiAi';
import {resolveVoiceContext} from '../lib/zumiSession';

export type ZumiStage = 'greeting' | 'closing';

export interface ZumiConverseInput {
  assignmentId: string;
  stage: ZumiStage;
  /** Recent turns of this session's chat (caller keeps it short). */
  history?: ChatTurn[];
  /** Quiz percentage (0-100), only meaningful for `stage === 'closing'`. */
  scorePercent?: number;
}

export interface ZumiConverseOutput {
  reply: string;
}

const FALLBACK_LINE: Record<ZumiStage, string> = {
  greeting: 'Hi! Main Zumi hoon, tumhara naya dost. Tumhara naam kya hai?',
  closing: 'Aaj bahut maza aaya! Kal phir milte hain, theek hai? Bye!',
};

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

export const zumiConverse = onCall<
  ZumiConverseInput,
  Promise<ZumiConverseOutput>
>(
  {region: 'asia-south1', minInstances: 1, secrets: [openaiApiKey]},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const {assignmentId, stage, history, scorePercent} =
      request.data ?? ({} as Partial<ZumiConverseInput>);

    const validStages: ZumiStage[] = ['greeting', 'closing'];
    if (typeof stage !== 'string' || !validStages.includes(stage as ZumiStage)) {
      throw new HttpsError('invalid-argument', 'A valid stage is required.');
    }

    const ctx = await resolveVoiceContext(caller.uid, assignmentId as string);

    const safeHistory: ChatTurn[] = Array.isArray(history)
      ? history
          .filter(
            (t): t is ChatTurn =>
              !!t &&
              (t.role === 'user' || t.role === 'assistant') &&
              typeof t.content === 'string',
          )
          .slice(-8)
          .map(t => ({role: t.role, content: t.content.slice(0, 500)}))
      : [];

    const pct =
      typeof scorePercent === 'number' && Number.isFinite(scorePercent)
        ? Math.max(0, Math.min(100, scorePercent))
        : 0;

    try {
      const reply = await converse({
        childName: ctx.childName,
        grade: ctx.grade,
        context: buildContext(stage as ZumiStage, ctx, pct),
        history: safeHistory,
      });
      return {reply: reply || FALLBACK_LINE[stage as ZumiStage]};
    } catch {
      // Never block the child's session on an AI hiccup.
      return {reply: FALLBACK_LINE[stage as ZumiStage]};
    }
  },
);
