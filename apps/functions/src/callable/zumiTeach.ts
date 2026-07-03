/**
 * Zumi adaptive teaching turn -- the heart of the "stealth teaching" flow.
 *
 * Instead of reading scripted lesson lines, the on-device session calls this
 * once per turn with the full running `history` + the current `phase`. The
 * server derives the child's name/grade and the topic's teaching material from
 * the assignment's `voiceStory` and asks the model for the next conversational
 * line PLUS structured control fields (`phase`, `animationHint`) so the manager
 * can drive animations and know when the concept is taught (-> quiz).
 *
 * Auth: signed-in child of the assignment's class (see `resolveVoiceContext`).
 *
 * On any AI failure this STILL returns 200 with a safe canned Hinglish line so
 * the on-device session never gets stuck mid-conversation.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAuth, requireRole } from '../lib/auth';
import {
  teachTurn,
  type AnimationHint,
  type ChatTurn,
  type TeachPhase,
} from '../lib/zumiAi';
import { resolveVoiceContext } from '../lib/zumiSession';
import { synthesizeInline } from '../lib/elevenLabs';

export interface ZumiTeachInput {
  assignmentId: string;
  /** Current teaching phase the conversation is in. */
  phase: TeachPhase;
  /** Running conversation so far (caller keeps a healthy window). */
  history?: ChatTurn[];
}

export interface ZumiTeachOutput {
  say: string;
  phase: TeachPhase;
  animationHint: AnimationHint;
  audioBase64: string;
  audioUrl?: string;
}

const VALID_PHASES: TeachPhase[] = [
  'warmup',
  'hook',
  'explore',
  'explain',
  'check',
  'ready_for_quiz',
];

export const zumiTeach = onCall<ZumiTeachInput, Promise<ZumiTeachOutput>>(
  { region: 'asia-south1', minInstances: 1 },
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const { assignmentId, phase, history } =
      request.data ?? ({} as Partial<ZumiTeachInput>);

    console.log('[zumiTeach] called', { uid: caller.uid, phase, historyLen: Array.isArray(history) ? history.length : 0 });

    if (typeof phase !== 'string' || !VALID_PHASES.includes(phase as TeachPhase)) {
      throw new HttpsError('invalid-argument', 'A valid phase is required.');
    }

    const ctx = await resolveVoiceContext(caller.uid, assignmentId as string);
    const vs = ctx.voiceStory;

    const safeHistory: ChatTurn[] = Array.isArray(history)
      ? history
        .filter(
          (t): t is ChatTurn =>
            !!t &&
            (t.role === 'user' || t.role === 'assistant') &&
            typeof t.content === 'string',
        )
        .slice(-10)
        .map(t => ({ role: t.role, content: t.content.slice(0, 500) }))
      : [];

    try {
      const result = await teachTurn({
        childName: ctx.childName,
        grade: ctx.grade,
        phase: phase as TeachPhase,
        history: safeHistory,
        material: {
          topicName: ctx.topicName,
          hookContext: vs.hookContext,
          predictContext: vs.predictContext,
          experimentInstruction: vs.experimentInstruction,
          conceptRevealScript: vs.conceptRevealScript,
          ncertDefinition: vs.ncertDefinition,
          keyPoints: Array.isArray(vs.keyPoints) ? vs.keyPoints : [],
          keywords: Array.isArray(vs.keywords) ? vs.keywords : [],
          memoryTrick: vs.memoryTrick,
        },
      });
      const { audioBase64 } = await synthesizeInline(result.say);
      console.log('[zumiTeach] AI success', { phase: result.phase, hint: result.animationHint, sayLen: result.say.length, preview: result.say.slice(0, 80) });
      return { ...result, audioBase64 };
    } catch (err) {
      // Keep a concise error log so a future AI outage is diagnosable, but
      // never block the child's session on an AI hiccup -- keep moving forward.
      const e = err as { message?: string; status?: number };
      console.error('[zumiTeach] teachTurn failed', {
        phase,
        status: e?.status,
        message: e?.message,
      });
      const fallbackSay = 'Arre, chalo aage badhte hai! Tum bahut accha kar rahe ho.';
      let audioBase64 = '';
      try {
        const inline = await synthesizeInline(fallbackSay);
        audioBase64 = inline.audioBase64;
      } catch { /* proceed without audio */ }
      return {
        say: fallbackSay,
        phase: nextPhase(phase as TeachPhase),
        animationHint: 'none',
        audioBase64,
      };
    }
  },
);

/** On AI failure, gently advance the phase so the session can't loop forever. */
function nextPhase(phase: TeachPhase): TeachPhase {
  const i = VALID_PHASES.indexOf(phase);
  if (i < 0 || i >= VALID_PHASES.length - 1) return 'ready_for_quiz';
  return VALID_PHASES[i + 1];
}