/**
 * Thin client wrappers over the Zumi Cloud Functions.
 *
 * The Gemini API key lives ONLY on the server (see apps/functions/src/lib/
 * zumiAi.ts). The app talks to three callables in `asia-south1` via the shared
 * `callFn` helper:
 *   - zumiConverse        -> a real-time Hinglish chat turn
 *   - zumiEvaluateAnswer  -> authoritative verdict for one spoken quiz answer
 *   - submitQuizAttempt   -> finalises the voice quiz (mode: 'voice')
 *
 * These throw on network/permission errors; the session manager catches and
 * degrades gracefully so the child is never stuck.
 */

import {callFn} from '@zerebro/shared-firebase';
import type {SubmitQuizAttemptInput, SubmitQuizAttemptOutput} from '@zerebro/shared-types';

import {timed} from './zumiPerf';

export type ChatRole = 'user' | 'assistant';
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

/** Bookend chat stages handled by `zumiConverse` (the lesson is `zumiTeach`). */
export type ZumiStage = 'greeting' | 'closing';

export interface ZumiConverseInput {
  assignmentId: string;
  stage: ZumiStage;
  history?: ChatTurn[];
  scorePercent?: number;
}

export interface ZumiConverseOutput {
  reply: string;
  /** Ready-to-play TTS URL for `reply` (synthesized server-side, may be absent). */
  audioUrl?: string;
}

/** Teaching phases the adaptive director moves through, in order. */
export type TeachPhase =
  | 'warmup'
  | 'hook'
  | 'explore'
  | 'explain'
  | 'check'
  | 'ready_for_quiz';

/** Generic animation categories the director can request per turn. */
export type AnimationHint =
  | 'none'
  | 'experiment'
  | 'visualize'
  | 'reveal'
  | 'celebrate'
  | 'trap';

export interface ZumiTeachInput {
  assignmentId: string;
  phase: TeachPhase;
  history?: ChatTurn[];
}

export interface ZumiTeachOutput {
  say: string;
  phase: TeachPhase;
  animationHint: AnimationHint;
  /** Ready-to-play TTS URL for `say` (synthesized server-side, may be absent). */
  audioUrl?: string;
}

export interface ZumiEvaluateInput {
  assignmentId: string;
  questionId: string;
  transcript: string;
}

export interface ZumiEvaluateOutput {
  result: 'correct' | 'partial' | 'incorrect';
  score: number;
  reasoning: string;
  /** Warm Hinglish line Zumi speaks back, tuned to the verdict + answer. */
  feedback?: string;
}

export interface ZumiSpeakInput {
  text: string;
}

export interface ZumiSpeakOutput {
  /** Playable Firebase Storage download URL for the synthesized mp3. */
  url: string;
}

export interface ZumiTranscribeInput {
  /** Storage path under `zumi_stt/{uid}/` where the recording was uploaded. */
  storagePath?: string;
  /** Base64-encoded audio bytes (fast path: skip Storage). */
  audioBase64?: string;
  /** MIME type (default audio/mp4). */
  mimeType?: string;
}

export interface ZumiTranscribeOutput {
  transcript: string;
}

export function zumiConverse(
  input: ZumiConverseInput,
): Promise<ZumiConverseOutput> {
  return timed(
    `net zumiConverse[${input.stage}]`,
    () => callFn<ZumiConverseInput, ZumiConverseOutput>('zumiConverse', input),
    out => `reply=${out.reply?.length ?? 0} chars audio=${out.audioUrl ? 'yes' : 'NO'}`,
  );
}

/** One turn of the adaptive, stealth-teaching conversation. */
export function zumiTeach(input: ZumiTeachInput): Promise<ZumiTeachOutput> {
  return timed(
    `net zumiTeach[${input.phase}]`,
    () => callFn<ZumiTeachInput, ZumiTeachOutput>('zumiTeach', input),
    out =>
      `phase=${out.phase} say=${out.say?.length ?? 0} chars audio=${out.audioUrl ? 'yes' : 'NO'}`,
  );
}

export function zumiEvaluateAnswer(
  input: ZumiEvaluateInput,
): Promise<ZumiEvaluateOutput> {
  return timed(
    'net zumiEvaluateAnswer',
    () =>
      callFn<ZumiEvaluateInput, ZumiEvaluateOutput>('zumiEvaluateAnswer', input),
    out => `${out.result} (${out.score} pts)`,
  );
}

export function submitVoiceQuiz(
  input: SubmitQuizAttemptInput,
): Promise<SubmitQuizAttemptOutput> {
  return timed('net submitQuizAttempt', () =>
    callFn<SubmitQuizAttemptInput, SubmitQuizAttemptOutput>(
      'submitQuizAttempt',
      input,
    ),
  );
}

/** ElevenLabs TTS: returns a playable audio URL for a line of Zumi's dialogue. */
export function zumiSpeak(input: ZumiSpeakInput): Promise<ZumiSpeakOutput> {
  return timed(
    'net zumiSpeak',
    () => callFn<ZumiSpeakInput, ZumiSpeakOutput>('zumiSpeak', input),
    out => `url=${out.url ? 'yes' : 'NO'} (${input.text.length} chars in)`,
  );
}

/** ElevenLabs STT: transcribes a recording previously uploaded to Storage. */
export function zumiTranscribe(
  input: ZumiTranscribeInput,
): Promise<ZumiTranscribeOutput> {
  return timed(
    'net zumiTranscribe',
    () =>
      callFn<ZumiTranscribeInput, ZumiTranscribeOutput>('zumiTranscribe', input),
    out => `"${(out.transcript ?? '').slice(0, 60)}"`,
  );
}

// ---- Zumi live streaming session (LiveKit) ---------------------------------

export interface ZumiLiveKitTokenInput {
  assignmentId: string;
}

export interface ZumiLiveKitTokenOutput {
  /** LiveKit server websocket URL. */
  url: string;
  /** Signed JWT scoped to this session's room. */
  token: string;
  room: string;
}

/** Mint a LiveKit room token for a streaming Zumi session (agent backend). */
export function zumiLiveKitToken(
  input: ZumiLiveKitTokenInput,
): Promise<ZumiLiveKitTokenOutput> {
  return timed(
    'net zumiLiveKitToken',
    () =>
      callFn<ZumiLiveKitTokenInput, ZumiLiveKitTokenOutput>(
        'zumiLiveKitToken',
        input,
      ),
    out => `room=${out.room}`,
  );
}
