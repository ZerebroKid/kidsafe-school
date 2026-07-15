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
 * LATENCY: after the AI reply we ALSO synthesize the line via the shared TTS
 * cache and return `audioUrl`, so the client plays it directly instead of
 * making a second `zumiSpeak` round trip. If TTS fails we still return the
 * text and the client falls back to its own TTS path.
 *
 * Auth: signed-in child of the assignment's class (see `resolveVoiceContext`).
 *
 * On any AI failure this STILL returns 200 with a safe canned Hinglish line so
 * the on-device session never gets stuck mid-conversation.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {requireAuth, requireRole} from '../lib/auth';
import {elevenLabsApiKey} from '../lib/elevenLabs';
import {stepLogger} from '../lib/perf';
import {tryGetTtsUrl} from '../lib/ttsCache';
import {
  openaiApiKey,
  teachTurn,
  type AnimationHint,
  type ChatTurn,
  type TeachPhase,
} from '../lib/zumiAi';
import {resolveVoiceContext} from '../lib/zumiSession';

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
  /** Ready-to-play TTS URL for `say` (absent if synthesis failed). */
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
  {
    region: 'asia-south1',
    minInstances: 0,
    secrets: [openaiApiKey, elevenLabsApiKey],
  },
  async request => {
    const log = stepLogger('zumiTeach');
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const {assignmentId, phase, history} =
      request.data ?? ({} as Partial<ZumiTeachInput>);

    if (typeof phase !== 'string' || !VALID_PHASES.includes(phase as TeachPhase)) {
      throw new HttpsError('invalid-argument', 'A valid phase is required.');
    }

    log.start({
      assignmentId,
      phase,
      historyTurns: Array.isArray(history) ? history.length : 0,
      lastChildLine:
        Array.isArray(history) && history.length > 0
          ? String(history[history.length - 1]?.content ?? '').slice(0, 80)
          : '(none)',
    });

    const ctx = await log.step(
      'resolveContext',
      () => resolveVoiceContext(caller.uid, assignmentId as string),
      c => `topic=${c.topicId} child=${c.childName || '(no name)'}`,
    );
    const vs = ctx.voiceStory;

    const safeHistory: ChatTurn[] = Array.isArray(history)
      ? history
          .filter(
            (t): t is ChatTurn =>
              !!t &&
              (t.role === 'user' || t.role === 'assistant') &&
              typeof t.content === 'string',
          )
          .slice(-20)
          .map(t => ({role: t.role, content: t.content.slice(0, 500)}))
      : [];

    try {
      const result = await log.step(
        'openai.teachTurn',
        () =>
          teachTurn({
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
          }),
        r => `phase=${r.phase} hint=${r.animationHint} say="${r.say.slice(0, 60)}..."`,
      );

      // Synthesize server-side so the client skips the zumiSpeak round trip.
      const audioUrl = await tryGetTtsUrl(result.say, log);

      log.end({
        phase: result.phase,
        animationHint: result.animationHint,
        sayChars: result.say.length,
        hasAudio: !!audioUrl,
      });
      return {...result, audioUrl};
    } catch (err) {
      // Keep a concise error log so a future AI outage is diagnosable, but
      // never block the child's session on an AI hiccup -- keep moving forward.
      log.fail(err);
      const fallbackSay = 'Arre, chalo aage badhte hai! Tum bahut accha kar rahe ho.';
      const audioUrl = await tryGetTtsUrl(fallbackSay, log);
      return {
        say: fallbackSay,
        phase: nextPhase(phase as TeachPhase),
        animationHint: 'none',
        audioUrl,
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
