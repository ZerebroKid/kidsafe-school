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

export type ChatRole = 'user' | 'assistant';
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export type ZumiStage =
  | 'greeting'
  | 'chat'
  | 'experiment_followup'
  | 'discovery'
  | 'closing';

export interface ZumiConverseInput {
  assignmentId: string;
  stage: ZumiStage;
  history?: ChatTurn[];
  scorePercent?: number;
}

export interface ZumiConverseOutput {
  reply: string;
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
  storagePath: string;
}

export interface ZumiTranscribeOutput {
  transcript: string;
}

export function zumiConverse(
  input: ZumiConverseInput,
): Promise<ZumiConverseOutput> {
  return callFn<ZumiConverseInput, ZumiConverseOutput>('zumiConverse', input);
}

export function zumiEvaluateAnswer(
  input: ZumiEvaluateInput,
): Promise<ZumiEvaluateOutput> {
  return callFn<ZumiEvaluateInput, ZumiEvaluateOutput>(
    'zumiEvaluateAnswer',
    input,
  );
}

export function submitVoiceQuiz(
  input: SubmitQuizAttemptInput,
): Promise<SubmitQuizAttemptOutput> {
  return callFn<SubmitQuizAttemptInput, SubmitQuizAttemptOutput>(
    'submitQuizAttempt',
    input,
  );
}

/** ElevenLabs TTS: returns a playable audio URL for a line of Zumi's dialogue. */
export function zumiSpeak(input: ZumiSpeakInput): Promise<ZumiSpeakOutput> {
  return callFn<ZumiSpeakInput, ZumiSpeakOutput>('zumiSpeak', input);
}

/** ElevenLabs STT: transcribes a recording previously uploaded to Storage. */
export function zumiTranscribe(
  input: ZumiTranscribeInput,
): Promise<ZumiTranscribeOutput> {
  return callFn<ZumiTranscribeInput, ZumiTranscribeOutput>(
    'zumiTranscribe',
    input,
  );
}
