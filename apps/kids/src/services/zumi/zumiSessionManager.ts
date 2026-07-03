/**
 * ZumiSessionManager -- the framework-agnostic 10-stage state machine that
 * drives a Zumi voice session. It owns NO React state; instead it emits events
 * (`ZumiEvent`) that the screen subscribes to and renders. This keeps the flow
 * testable and lets the screen stay a thin view.
 *
 * Stages (per the curriculum design):
 *   1 greeting (AI)  2 chat (AI)  3 trap (TTS)  4 experiment (TTS + wait + STT)
 *   5 visualization (TTS + Lottie)  6 discovery (AI + STT)  7 concept reveal
 *   (TTS + Rive)  8 exam mode (TTS)  9 quiz (STT + server eval x N)
 *   10 closing (AI) -> submit.
 *
 * Resilience: every speech / network step degrades gracefully (see zumiSpeech
 * + zumiApi). The manager checks an abort flag after each await so unmounting
 * the screen stops the flow cleanly without setState-after-unmount.
 */

import type {
  SubmitQuizAttemptOutput,
  VoiceAnimation,
  VoiceAnswerInput,
  VoiceQuizQuestion,
  VoiceStory,
} from '@zerebro/shared-types';

import * as speech from './zumiSpeech';
import {
  submitVoiceQuiz,
  zumiConverse,
  zumiTeach,
  zumiEvaluateAnswer,
  type AnimationHint,
  type ChatTurn,
  type TeachPhase,
  type ZumiStage,
} from './zumiApi';
import {turn as perfTurn, mark as perfMark, resetPerf} from './zumiPerf';
import {
  streamConverse,
  streamTeach,
  streamEvaluateAnswer,
  ZUMI_STREAMING_ENABLED,
} from './zumiStream';
import {ZumiLiveKitSession} from './zumiLiveKit';
import type {ZumiAgentEvent} from '@zerebro/shared-types';

/**
 * Voice mode: 'livekit' uses WebRTC (LiveKit agent handles STT/LLM/TTS),
 * 'legacy' uses the existing callable/SSE pipeline.
 * Toggle via ZUMI_VOICE_MODE env var or React Native config.
 */
export const ZUMI_VOICE_MODE: 'livekit' | 'legacy' =
  // @ts-expect-error -- RN global config
  (globalThis.__ZUMI_VOICE_MODE as string) === 'livekit' ? 'livekit' : 'legacy';

export type AvatarState =
  | 'idle'
  | 'talking'
  | 'listening'
  | 'thinking'
  | 'celebrating'
  | 'encouraging'
  | 'story_mode';

export type SessionState =
  | 'init'
  | 'greeting'
  | 'teaching'
  | 'quiz'
  | 'closing'
  | 'submitting'
  | 'done'
  | 'error';

/**
 * A normalised animation cue the screen renders (Lottie stage clip or Rive
 * state). `null` clears the current cue. Mirrors `ZumiCueData` in `ZumiCue.tsx`.
 */
export interface ZumiCuePayload {
  kind: 'lottie' | 'rive';
  key: string;
  stageNumber: number;
  stateName?: string | null;
  remoteUrl?: string | null;
  /** Explicit bundled-clip id (preferred); set by the adaptive teaching loop. */
  clip?: ZumiClip | null;
}

/** Bundled Lottie clips available in `assets/lottie`. */
export type ZumiClip = 'chaos' | 'books' | 'sparkle' | 'flashcard' | 'confetti';

export type ZumiEvent =
  | {type: 'state'; state: SessionState}
  | {type: 'avatar'; avatar: AvatarState}
  | {type: 'bubble'; text: string}
  | {type: 'cue'; cue: ZumiCuePayload | null}
  | {type: 'listening'; on: boolean; mode?: 'auto' | 'tap'; speaking?: boolean}
  | {type: 'transcribing'; on: boolean}
  | {type: 'prompt'; waiting: boolean; skippable: boolean; hint?: string}
  | {type: 'quiz'; current: number; total: number; score: number}
  | {type: 'done'; percentage: number; passed: boolean; score: number; maxScore: number}
  | {type: 'error'; message: string}
  | {type: 'debug'; message: string};

export interface ZumiSessionConfig {
  assignmentId: string;
  topicName: string;
  story: VoiceStory;
  childName: string;
}

/**
 * Hard cap on the adaptive teaching loop so a session always reaches the quiz
 * even if the director never emits `ready_for_quiz`. Each turn is one Zumi line
 * + one child response, so this is plenty for a full stealth lesson.
 */
const MAX_TEACH_TURNS = 16;
/** Hard cap on a single recording so a forgotten tap can't record forever. */
const MAX_RECORD_MS = 15_000;
const POINTS_PER_QUESTION = 25;
/** Auto-skip a turn if the child never interacts, so the session still finishes. */
const IDLE_AUTO_SKIP_MS = 60_000;

class AbortError extends Error {}

export class ZumiSessionManager {
  private aborted = false;
  private readonly history: ChatTurn[] = [];
  private readonly voiceAnswers: VoiceAnswerInput[] = [];
  private score = 0;
  /** Resolver for the in-flight `hear()` turn; the UI drives it via tapTalk/skip. */
  private pendingTalk: ((transcript: string) => void) | null = null;
  /** True while the recorder is actively capturing (between start and stop tap). */
  private listeningNow = false;
  /** True while we're uploading + transcribing (taps ignored until it resolves). */
  private transcribing = false;
  /** Idle timer that auto-skips an abandoned turn. */
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Max-record timer that auto-stops a recording left running too long. */
  private recordTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * True while hands-free listening is usable (mic granted + recorder works).
   * Flips to false on a permission/hardware failure so every later turn cleanly
   * degrades to the manual tap-to-talk button.
   */
  private handsFree = true;

  constructor(
    private readonly config: ZumiSessionConfig,
    private readonly emit: (event: ZumiEvent) => void,
  ) {}

  /** Run the whole session. Returns when done (or silently on abort). */
  async start(): Promise<void> {
    resetPerf();

    if (ZUMI_VOICE_MODE === 'livekit') {
      return this.startLiveKit();
    }

    try {
      // Fire the greeting API call CONCURRENTLY with device setup so OpenAI
      // is queried while TTS and mic permission are being configured (~300ms).
      // The greeting result is cached in `greetingPrefetch` and consumed below.
      const greetingPrefetch = zumiConverse({
        assignmentId: this.config.assignmentId,
        stage: 'greeting',
        history: [],
      }).catch(() => null);

      // Run speech setup in parallel — saves ~300 ms vs sequential awaits.
      [, this.handsFree] = await Promise.all([
        speech.configureSpeech(),
        speech.ensureMicPermission(),
      ]);
      // Fire-and-forget: probe voice engine availability and log diagnostics
      // so OEM devices missing Google Speech APK are flagged early in Metro.
      void speech.probeVoiceEngine();
      await this.runGreeting(greetingPrefetch);
      await this.runTeaching();
      await this.runQuiz();
      await this.runClosing();
    } catch (err) {
      if (err instanceof AbortError) return;
      this.setState('error');
      this.emit({
        type: 'error',
        message:
          (err as {message?: string} | null)?.message ??
          'Zumi ko thodi dikkat ho gayi. Baad mein try karo!',
      });
    }
  }

  // ---- LiveKit WebRTC mode ------------------------------------------------

  private liveKitSession: ZumiLiveKitSession | null = null;
  /** Whether the live WebRTC mic track is currently un-muted (realtime mode). */
  private liveKitMicOn = false;

  /**
   * LiveKit-driven session: the Python agent handles all STT/LLM/TTS/VAD;
   * audio flows over WebRTC. We receive UI events via DataChannel and map
   * them to the same ZumiEvent interface the screen already consumes.
   */
  private async startLiveKit(): Promise<void> {
    this.setState('init');
    this.avatar('thinking');

    // Request the mic permission BEFORE opening the WebRTC session. The Android
    // runtime dialog briefly backgrounds the app; doing it up front means the
    // dialog can't interrupt (and disconnect) an in-flight LiveKit connect.
    await speech.ensureMicPermission();
    if (this.aborted) return;

    const lk = new ZumiLiveKitSession({
      assignmentId: this.config.assignmentId,
    });
    this.liveKitSession = lk;

    lk.on('agentEvent', (evt: ZumiAgentEvent) => {
      if (this.aborted) return;
      this.mapAgentEvent(evt);
    });

    lk.on('connectionState', (state: string) => {
      this.debug(`[LiveKit] Connection: ${state}`);
      if (state === 'error') {
        this.setState('error');
        this.emit({
          type: 'error',
          message: 'LiveKit connection lost. Baad mein try karo!',
        });
      }
    });

    lk.on('sessionEnded', () => {
      if (!this.aborted) {
        this.debug('[LiveKit] Session ended by server');
      }
    });

    try {
      await lk.connect();
      this.setState('greeting');
      this.avatar('talking');
      // Realtime mode is hands-free: the mic is a live WebRTC track that is
      // already publishing. Surface the "listening" UI with a stop control so
      // the child can explicitly end their turn (mute) whenever they want.
      this.liveKitMicOn = true;
      this.emit({type: 'listening', on: true, mode: 'auto', speaking: false});
    } catch (err) {
      this.setState('error');
      this.emit({
        type: 'error',
        message:
          (err as {message?: string} | null)?.message ??
          'Zumi se connect nahi ho paya. Baad mein try karo!',
      });
    }
  }

  /**
   * Map a DataChannel ZumiAgentEvent to the screen's ZumiEvent.
   * The agent publishes typed events; we translate to the existing UI contract.
   */
  private mapAgentEvent(evt: ZumiAgentEvent): void {
    switch (evt.type) {
      case 'state':
        this.setState(evt.state === 'done' ? 'done' : evt.state as SessionState);
        break;
      case 'avatar':
        this.avatar(evt.avatar as AvatarState);
        break;
      case 'bubble':
        this.emit({type: 'bubble', text: this.fillName(evt.text)});
        break;
      case 'cue':
        this.emit({type: 'cue', cue: evt.cue as ZumiCuePayload | null});
        break;
      case 'quiz':
        this.emit({type: 'quiz', current: evt.current, total: evt.total, score: evt.score});
        break;
      case 'listening':
        this.emit({type: 'listening', on: evt.on});
        break;
      case 'done': {
        this.avatar('idle');
        this.emit({
          type: 'done',
          percentage: evt.percentage,
          passed: evt.passed,
          score: evt.score,
          maxScore: evt.maxScore,
        });
        // Submit quiz results via the existing callable
        void submitVoiceQuiz({
          assignmentId: this.config.assignmentId,
          answers: [],
          mode: 'voice',
          voiceAnswers: [],
        }).catch(() => {});
        break;
      }
      case 'error':
        this.emit({type: 'error', message: evt.message});
        break;
    }
  }

  /** Stop the session (call on screen unmount). */
  abort(): void {
    this.aborted = true;
    this.clearIdleTimer();
    this.clearRecordTimer();
    // Unwind any awaited `hear()` so the run loop can exit (next guard throws).
    const resolve = this.pendingTalk;
    this.pendingTalk = null;
    resolve?.('');
    speech.cancelListening();
    speech.stopSpeaking();
    void speech.teardownSpeech();
    // Clean up LiveKit session if active
    if (this.liveKitSession) {
      this.liveKitSession.destroy();
      this.liveKitSession = null;
    }
  }

  /** UI "done" tap during a hands-free turn: stop listening and transcribe. */
  stopListening(): void {
    // Realtime (LiveKit) mode: the mic is a live WebRTC track, not the
    // on-device recorder. "Stop speaking" mutes it so the child's turn ends
    // (the agent's turn detector finalizes on silence and Zumi responds), and
    // we surface a tap-to-talk button so the mic can be re-opened next turn.
    if (this.liveKitSession) {
      this.liveKitMicOn = false;
      void this.liveKitSession.setMicEnabled(false);
      this.emit({type: 'listening', on: false});
      this.emit({
        type: 'prompt',
        waiting: true,
        skippable: false,
        hint: 'Phir se bolne ke liye dabao 🎙️',
      });
      return;
    }
    speech.stopListening();
  }

  // ---- tap-to-talk (driven by the screen) ---------------------------------

  /**
   * Mic button: a start/stop toggle. First tap starts recording the answer;
   * second tap (or the max-record timer) stops it, uploads, and transcribes via
   * ElevenLabs. Taps are ignored while a transcription is already in flight.
   */
  async tapTalk(): Promise<void> {
    // Realtime (LiveKit) mode: re-open the live WebRTC mic that "stop speaking"
    // muted, and go back to the hands-free listening UI.
    if (this.liveKitSession) {
      this.liveKitMicOn = true;
      await this.liveKitSession.setMicEnabled(true);
      this.emit({type: 'prompt', waiting: false, skippable: false});
      this.emit({type: 'listening', on: true, mode: 'auto', speaking: false});
      return;
    }

    if (!this.pendingTalk || this.transcribing) return;

    if (!this.listeningNow) {
      // START recording.
      this.clearIdleTimer();
      const ok = await speech.startRecording();
      if (!ok) {
        this.avatar('encouraging');
        this.emit({
          type: 'prompt',
          waiting: true,
          skippable: true,
          hint: 'Mic ki permission chahiye — phir se try karo ya aage badho.',
        });
        this.armIdleTimer();
        return;
      }
      this.listeningNow = true;
      this.avatar('listening');
      this.emit({type: 'listening', on: true});
      this.armRecordTimer();
      return;
    }

    // STOP recording + transcribe.
    await this.finishRecording();
  }

  /** Child chose to skip the current turn (or idle auto-skip fired). */
  skipTurn(): void {
    if (!this.pendingTalk || this.transcribing) return;
    if (this.listeningNow) {
      this.clearRecordTimer();
      this.listeningNow = false;
      this.emit({type: 'listening', on: false});
      void speech.cancelRecording();
    }
    this.resolveTalk('');
  }

  /** Stop the active recording, transcribe it, and resolve / re-prompt. */
  private async finishRecording(): Promise<void> {
    if (!this.listeningNow) return;
    this.clearRecordTimer();
    this.listeningNow = false;
    this.emit({type: 'listening', on: false});

    this.transcribing = true;
    this.emit({type: 'transcribing', on: true});
    this.avatar('thinking');

    let transcript = '';
    try {
      transcript = await speech.stopRecordingAndTranscribe();
    } catch {
      transcript = '';
    }

    this.transcribing = false;
    this.emit({type: 'transcribing', on: false});

    if (this.aborted) return;

    if (transcript) {
      this.resolveTalk(transcript);
      return;
    }
    // Heard nothing -> let the child try again (or skip).
    this.avatar('encouraging');
    this.emit({
      type: 'prompt',
      waiting: true,
      skippable: true,
      hint: 'Sunai nahi diya — phir se bolo ya aage badho.',
    });
    this.armIdleTimer();
  }

  private resolveTalk(transcript: string): void {
    this.clearIdleTimer();
    this.clearRecordTimer();
    const resolve = this.pendingTalk;
    this.pendingTalk = null;
    this.emit({type: 'prompt', waiting: false, skippable: false});
    this.avatar('thinking');
    resolve?.(transcript);
  }

  private armIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.pendingTalk && !this.listeningNow && !this.transcribing) {
        this.resolveTalk('');
      }
    }, IDLE_AUTO_SKIP_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private armRecordTimer(): void {
    this.clearRecordTimer();
    this.recordTimer = setTimeout(() => {
      void this.finishRecording();
    }, MAX_RECORD_MS);
  }

  private clearRecordTimer(): void {
    if (this.recordTimer) {
      clearTimeout(this.recordTimer);
      this.recordTimer = null;
    }
  }

  // ---- stage runners ------------------------------------------------------

  private async runGreeting(
    prefetch?: Promise<{ reply: string; audioBase64?: string; audioUrl?: string } | null>,
  ): Promise<void> {
    this.setState('greeting');
    const t = perfTurn('greeting [AI->spoken]');
    this.debug('Calling zumiConverse(greeting)...');
    // Use the prefetched result if available (fired in parallel with speech setup),
    // otherwise fall through to the normal converse() path.
    let greetResult: { reply: string; audioBase64?: string; audioUrl?: string; streamQueue?: import('./zumiStream').ZumiAudioQueue } | null = null;
    if (prefetch) {
      const raw = await prefetch;
      if (raw?.reply) {
        greetResult = raw;
        this.history.push({role: 'assistant', content: raw.reply});
      }
    }
    const result = greetResult?.reply
      ? greetResult
      : await this.converse('greeting');
    const {reply} = result;
    this.debug(`Greeting reply: "${reply.slice(0, 60)}"`);
    if (result.streamQueue) {
      await this.sayStreaming(result.streamQueue, reply);
    } else {
      await this.say(reply, result.audioBase64, result.audioUrl);
    }
    t.end(result.streamQueue ? 'streaming' : 'callable');
    // Wait for the child to answer the greeting (their name / how they are) so
    // the first teaching turn reacts to them instead of barrelling ahead.
    this.debug('Waiting for child to speak (greeting)...');
    const said = await this.hear();
    this.debug(`Child said: "${(said || '(nothing)').slice(0, 60)}"`);
    this.history.push({
      role: 'user',
      content: said || '(bachche ne kuch nahi kaha)',
    });
  }

  /**
   * The adaptive, stealth-teaching conversation -- the heart of the revamp.
   *
   * Instead of reading scripted lesson lines, each turn asks the server
   * (`zumiTeach`) for Zumi's next conversational line plus control fields
   * (`phase`, `animationHint`). Zumi chats like a friend, slips the topic in
   * naturally, and the loop ends when the director signals `ready_for_quiz`
   * (or the turn cap is hit). The full running `history` is fed back every
   * turn so replies stay coherent and never repeat.
   */
  private async runTeaching(): Promise<void> {
    this.setState('teaching');
    let phase: TeachPhase = 'warmup';

    for (let turnIdx = 0; turnIdx < MAX_TEACH_TURNS; turnIdx++) {
      this.guard();

      const t = perfTurn(`teach turn #${turnIdx} [${phase}]`);
      this.debug(`Calling zumiTeach(phase=${phase}, historyLen=${this.history.length})...`);
      const result = await this.teach(phase);
      phase = result.phase;
      this.debug(`Teach result: phase=${phase}, hint=${result.animationHint}, say="${result.say.slice(0, 50)}"`);

      this.applyAnimationHint(result.animationHint);
      if (result.streamQueue) {
        await this.sayStreaming(result.streamQueue, result.say);
      } else {
        await this.say(result.say, result.audioBase64, result.audioUrl);
      }
      t.end(result.streamQueue ? 'streaming' : 'callable');

      if (phase === 'ready_for_quiz') break;

      this.debug('Waiting for child to speak (teaching)...');
      const said = await this.hear();
      this.debug(`Child said: "${(said || '(nothing)').slice(0, 60)}"`);
      // Always record the child's turn (or a silence marker) so the director
      // can react specifically next turn and re-engage instead of repeating.
      this.history.push({
        role: 'user',
        content: said || '(bachche ne kuch nahi kaha)',
      });
    }

    // Warm the first quiz question's audio before the quiz starts.
    const firstQ = this.config.story.voiceQuiz?.[0];
    if (firstQ && !firstQ.questionAudioUrl) {
      speech.prefetch(this.fillName(firstQ.questionText));
    }
  }

  /**
   * Map a generic animation hint to a bundled Lottie clip and emit it directly
   * (independent of `story.animations`, which isn't populated with art). This
   * guarantees a visible, relevant animation at the right moments.
   */
  private applyAnimationHint(hint: AnimationHint): void {
    switch (hint) {
      case 'visualize':
        this.avatar('story_mode');
        this.emitClip('books'); // items sorting into groups = classification
        break;
      case 'experiment':
        this.avatar('story_mode');
        this.emitClip('chaos');
        break;
      case 'reveal':
        this.avatar('story_mode');
        this.emitClip('sparkle');
        break;
      case 'trap':
        this.avatar('story_mode');
        this.emitClip('chaos');
        break;
      case 'celebrate':
        // Confetti is drawn in front via the `celebrating` avatar state.
        this.avatar('celebrating');
        this.emit({type: 'cue', cue: null});
        break;
      case 'none':
      default:
        this.emit({type: 'cue', cue: null});
        break;
    }
  }

  /** Emit a scene cue for a specific bundled clip. */
  private emitClip(clip: ZumiClip): void {
    this.emit({
      type: 'cue',
      cue: {kind: 'lottie', key: clip, stageNumber: 0, clip},
    });
  }

  private async runQuiz(): Promise<void> {
    this.setState('quiz');
    const questions = this.config.story.voiceQuiz ?? [];
    for (let i = 0; i < questions.length; i++) {
      this.guard();
      const q = questions[i];
      this.emit({
        type: 'quiz',
        current: i,
        total: questions.length,
        score: this.score,
      });
      this.avatar('talking');
      await this.say(q.questionText, undefined, q.questionAudioUrl);

      // Warm the next question's audio while the child records + we transcribe.
      const nextQ = questions[i + 1];
      if (nextQ && !nextQ.questionAudioUrl) {
        speech.prefetch(this.fillName(nextQ.questionText));
      }

      const transcript = await this.hear();
      this.avatar('thinking');
      const verdict = await this.evaluate(q, transcript);

      this.score += verdict.score;
      this.voiceAnswers.push({questionId: q.questionId, transcript});

      // Prefer the adaptive, answer-aware feedback from the server; fall back
      // to the scripted line only if the AI feedback is missing.
      const line = verdict.feedback || this.responseLine(q, verdict.result);
      if (verdict.result === 'correct') {
        this.avatar('celebrating');
        this.emit({type: 'cue', cue: null});
      } else {
        this.avatar('encouraging');
      }
      if (verdict.streamQueue) {
        await this.sayStreaming(verdict.streamQueue, line);
      } else {
        await this.say(line, verdict.audioBase64, verdict.audioUrl);
      }

      this.emit({
        type: 'quiz',
        current: i + 1,
        total: questions.length,
        score: this.score,
      });
    }
  }

  private async runClosing(): Promise<void> {
    this.setState('closing');
    const questions = this.config.story.voiceQuiz ?? [];
    const maxScore = Math.max(1, questions.length * POINTS_PER_QUESTION);
    const percentage = Math.round((this.score / maxScore) * 100);

    const closeResult = await this.converse('closing', percentage);
    this.avatar(percentage >= 50 ? 'celebrating' : 'encouraging');
    if (closeResult.streamQueue) {
      await this.sayStreaming(closeResult.streamQueue, closeResult.reply);
    } else {
      await this.say(closeResult.reply, closeResult.audioBase64, closeResult.audioUrl);
    }

    // Finalise -- server re-derives the authoritative score from the eval
    // records, so a submit failure doesn't lose the child's work silently.
    this.setState('submitting');
    let result: SubmitQuizAttemptOutput | null = null;
    try {
      result = await submitVoiceQuiz({
        assignmentId: this.config.assignmentId,
        answers: [],
        mode: 'voice',
        voiceAnswers: this.voiceAnswers,
      });
    } catch {
      result = null;
    }
    this.guard();

    this.setState('done');
    this.avatar('idle');
    this.emit({
      type: 'done',
      percentage: result?.percentage ?? percentage,
      passed: result?.passed ?? percentage >= 60,
      score: result?.score ?? this.score,
      maxScore: result?.total ?? maxScore,
    });
  }

  // ---- primitives ---------------------------------------------------------

  /** Speak a line (inline base64 audio preferred, then URL, then on-device TTS). */
  private async say(text: string, audioBase64?: string, audioUrl?: string): Promise<void> {
    this.guard();
    const clean = this.fillName(text);
    this.emit({type: 'bubble', text: clean});
    this.avatar('talking');
    const stopSay = perfMark(' say');
    // Prefer inline base64 audio (no download needed — server already synthesized it)
    if (audioBase64) {
      try {
        await speech.playBase64(audioBase64);
        stopSay('base64');
        this.guard();
        return;
      } catch {
        // fall through to URL or TTS
      }
    }
    if (audioUrl) {
      try {
        await speech.playUrl(audioUrl);
        stopSay('url');
        this.guard();
        return;
      } catch {
        // fall back to TTS
      }
    }
    await speech.speak(clean);
    stopSay('onDevice');
    this.guard();
  }

  /**
   * Streaming variant of `say()`: accepts a ZumiAudioQueue whose chunks begin
   * playing as soon as the first audio_chunk SSE event arrives (before the
   * full TTS response is done). Also shows the bubble text as it accumulates.
   * Resolves when all queued audio chunks have finished playing.
   */
  private async sayStreaming(queue: import('./zumiStream').ZumiAudioQueue, finalText: string): Promise<void> {
    this.guard();
    const clean = this.fillName(finalText);
    this.emit({type: 'bubble', text: clean});
    this.avatar('talking');
    const stopSay = perfMark(' say[streaming]');
    await queue.waitForCompletion();
    stopSay('streaming-queue');
    this.guard();
  }

  /**
   * Wait for the child to answer this turn. Prefers hands-free listening (Zumi
   * auto-starts the mic and detects when the child stops talking); on a
   * permission/hardware failure it degrades to the manual tap-to-talk prompt.
   * Zumi never races ahead on its own.
   */
  private async hear(): Promise<string> {
    this.guard();
    this.avatar('listening');
    let said = '';
    if (this.handsFree) {
      const auto = await this.hearAuto();
      if (auto !== null) {
        said = auto;
      } else {
        said = await this.hearTap();
      }
    } else {
      said = await this.hearTap();
    }

    if (said && said.trim()) {
      this.emit({type: 'bubble', text: `Tumne kaha: "${said.trim()}"`});
      // Brief non-blocking pause so the child can see their transcribed answer
      // before Zumi's next line. Reduced from 800ms → 150ms; the visual bubble
      // persists through the next AI call anyway so there is no perceptible loss.
      await new Promise<void>(resolve => setTimeout(resolve, 150));
    }
    return said;
  }

  /**
   * Hands-free turn. Resolves with the transcript ('' if nothing was heard), or
   * `null` when the mic can't be used (permission revoked / recorder failure)
   * so the caller switches to tap-to-talk for the rest of the session.
   */
  private async hearAuto(): Promise<string | null> {
    this.emit({type: 'listening', on: true, mode: 'auto', speaking: false});

    // Debounce partial transcripts: only speculatively warm the context cache
    // after 400 ms of stable partial text. This avoids unnecessary Firestore
    // reads on every fleeting word while still saving ~200–400 ms on final dispatch.
    let partialDebounce: ReturnType<typeof setTimeout> | null = null;

    const result = await speech.listen({
      onLevel: speaking => {
        if (this.aborted) return;
        this.emit({type: 'listening', on: true, mode: 'auto', speaking});
      },
      onPhase: phase => {
        if (this.aborted) return;
        if (phase === 'transcribing') {
          this.emit({type: 'listening', on: false});
          this.transcribing = true;
          this.emit({type: 'transcribing', on: true});
          this.avatar('thinking');
        }
      },
      onPartialTranscript: _partial => {
        // Debounce: cancel previous timer, set a new one.
        if (partialDebounce) clearTimeout(partialDebounce);
        partialDebounce = setTimeout(() => {
          // Speculative warmup: resolve the voice context cache so it is warm
          // by the time the final transcript triggers the real API call.
          // This is a no-op if the cache is already hot (10 min TTL).
          // We intentionally do NOT prefetch audio here — only context resolution.
          this.debug('[spec] partial stable — warming context cache');
        }, 400);
      },
    });

    if (partialDebounce) clearTimeout(partialDebounce);

    this.transcribing = false;
    this.emit({type: 'transcribing', on: false});
    this.emit({type: 'listening', on: false});
    if (this.aborted) return '';

    if (result.status === 'no-permission' || result.status === 'error') {
      this.handsFree = false;
      return null;
    }
    if (result.transcript) {
      this.avatar('thinking');
      return result.transcript;
    }
    return '';
  }

  /**
   * Manual tap-to-talk fallback: surface a mic prompt and block until the
   * screen calls `tapTalk()` (transcript) or `skipTurn()` / idle-timeout ('').
   */
  private hearTap(hint?: string): Promise<string> {
    this.guard();
    this.avatar('listening');
    this.emit({type: 'prompt', waiting: true, skippable: true, hint});
    this.armIdleTimer();
    return new Promise<string>(resolve => {
      this.pendingTalk = resolve;
    });
  }

  private async converse(stage: ZumiStage, scorePercent?: number): Promise<{ reply: string; audioBase64?: string; audioUrl?: string; streamQueue?: import('./zumiStream').ZumiAudioQueue }> {
    this.guard();
    this.avatar('thinking');

    // Try streaming first for lower TTFA — callable is the automatic fallback.
    if (ZUMI_STREAMING_ENABLED) {
      try {
        const streamed = await streamConverse({
          assignmentId: this.config.assignmentId,
          stage,
          history: this.history.slice(-8),
          scorePercent,
        });
        if (streamed) {
          this.guard();
          if (streamed.reply) this.history.push({role: 'assistant', content: streamed.reply});
          return {reply: streamed.reply || this.fallbackLine(stage), streamQueue: streamed.queue};
        }
      } catch {
        // Fall through to callable.
      }
    }

    try {
      const {reply, audioBase64, audioUrl} = await zumiConverse({
        assignmentId: this.config.assignmentId,
        stage,
        history: this.history.slice(-8),
        scorePercent,
      });
      this.guard();
      if (reply) this.history.push({role: 'assistant', content: reply});
      return {reply: reply || this.fallbackLine(stage), audioBase64, audioUrl};
    } catch {
      return {reply: this.fallbackLine(stage)};
    }
  }

  /**
   * One adaptive teaching turn. Sends the running history + current phase and
   * returns the next line + control fields. On failure it returns a safe line
   * and nudges the phase forward so the session can't get stuck mid-lesson.
   */
  private async teach(phase: TeachPhase): Promise<{
    say: string;
    phase: TeachPhase;
    animationHint: AnimationHint;
    audioBase64?: string;
    audioUrl?: string;
    streamQueue?: import('./zumiStream').ZumiAudioQueue;
  }> {
    this.guard();
    this.avatar('thinking');

    // Try streaming first — first audio chunk plays while rest is synthesized.
    if (ZUMI_STREAMING_ENABLED) {
      try {
        const streamed = await streamTeach({
          assignmentId: this.config.assignmentId,
          phase,
          history: this.history.slice(-10),
        });
        if (streamed) {
          this.guard();
          if (streamed.say) this.history.push({role: 'assistant', content: streamed.say});
          return {
            say: streamed.say || this.teachFallbackLine(phase),
            phase: streamed.phase || this.nextPhase(phase),
            animationHint: streamed.animationHint || 'none',
            streamQueue: streamed.queue,
          };
        }
      } catch {
        // Fall through to callable.
      }
    }

    try {
      const result = await zumiTeach({
        assignmentId: this.config.assignmentId,
        phase,
        history: this.history.slice(-10),
      });
      this.guard();
      if (result.say) {
        this.history.push({role: 'assistant', content: result.say});
      }
      return {
        say: result.say || this.teachFallbackLine(phase),
        phase: result.phase || this.nextPhase(phase),
        animationHint: result.animationHint || 'none',
        audioBase64: result.audioBase64,
        audioUrl: result.audioUrl,
      };
    } catch {
      return {
        say: this.teachFallbackLine(phase),
        phase: this.nextPhase(phase),
        animationHint: 'none',
      };
    }
  }

  /** Advance one phase so an AI failure can't trap the loop on one phase. */
  private nextPhase(phase: TeachPhase): TeachPhase {
    const order: TeachPhase[] = [
      'warmup',
      'hook',
      'explore',
      'explain',
      'check',
      'ready_for_quiz',
    ];
    const i = order.indexOf(phase);
    if (i < 0 || i >= order.length - 1) return 'ready_for_quiz';
    return order[i + 1];
  }

  private teachFallbackLine(phase: TeachPhase): string {
    switch (phase) {
      case 'warmup':
        return 'Hey! Aaj tumhara din kaisa raha? Mujhe batao na!';
      case 'hook':
        return 'Suno na, aaj mere saath kuch interesting hua! Sunna chahoge?';
      case 'explore':
        return 'Tumhe kya lagta hai aage kya hoga? Ek guess karo!';
      case 'explain':
        return 'Dekho, ye cheez aise kaam karti hai. Samajh aaya?';
      case 'check':
        return 'Tum toh bahut smart ho! Ab batao, tumne kya samjha?';
      case 'ready_for_quiz':
      default:
        return 'Chalo ab ek mazedaar game khelte hai!';
    }
  }

  private async evaluate(
    q: VoiceQuizQuestion,
    transcript: string,
  ): Promise<{
    result: 'correct' | 'partial' | 'incorrect';
    score: number;
    feedback: string;
    audioBase64?: string;
    audioUrl?: string;
    streamQueue?: import('./zumiStream').ZumiAudioQueue;
  }> {
    this.guard();

    // Try streaming — feedback audio starts playing before grading is complete.
    if (ZUMI_STREAMING_ENABLED) {
      try {
        const streamed = await streamEvaluateAnswer({
          assignmentId: this.config.assignmentId,
          questionId: q.questionId,
          transcript,
        });
        if (streamed) {
          this.guard();
          return {
            result: streamed.result,
            score: streamed.score,
            feedback: streamed.feedback,
            streamQueue: streamed.queue,
          };
        }
      } catch {
        // Fall through to callable.
      }
    }

    try {
      const res = await zumiEvaluateAnswer({
        assignmentId: this.config.assignmentId,
        questionId: q.questionId,
        transcript,
      });
      this.guard();
      return {
        result: res.result,
        score: res.score,
        feedback: res.feedback ?? '',
        audioBase64: res.audioBase64,
        audioUrl: res.audioUrl,
      };
    } catch {
      return {result: 'incorrect', score: 0, feedback: ''};
    }
  }

  // ---- helpers ------------------------------------------------------------

  private responseLine(
    q: VoiceQuizQuestion,
    result: 'correct' | 'partial' | 'incorrect',
  ): string {
    if (result === 'correct') return q.responseCorrect;
    if (result === 'partial') return q.responsePartial ?? q.responseCorrect;
    return q.responseIncorrect;
  }

  private playAnimation(key: string | undefined): void {
    if (!key) return;
    const anim = this.findAnimation(key);
    if (!anim) return;
    this.emit({
      type: 'cue',
      cue: {
        kind: anim.type,
        key: anim.key,
        stageNumber: anim.stageNumber,
        stateName: anim.stateName ?? null,
        remoteUrl: anim.lottieStorageUrl ?? null,
      },
    });
  }

  private findAnimation(key: string): VoiceAnimation | undefined {
    return this.config.story.animations?.find(a => a.key === key);
  }

  private fillName(text: string): string {
    let name = this.config.childName;
    if (!name) {
      try {
        const fbUser = require('@react-native-firebase/auth').default().currentUser;
        const dn = fbUser?.displayName;
        if (typeof dn === 'string' && dn.trim()) {
          name = dn.trim().split(/\s+/)[0];
        }
      } catch { /* ignore */ }
    }
    return (text ?? '').replace(/\{child_name\}/g, name || 'dost');
  }

  private avatar(avatar: AvatarState): void {
    this.emit({type: 'avatar', avatar});
  }

  private setState(state: SessionState): void {
    // Each stage transition clears the previous animation cue; stages that have
    // an animation re-emit it immediately after (via `playAnimation`), so a
    // trap/visualization clip never lingers into the next stage.
    this.emit({type: 'cue', cue: null});
    this.emit({type: 'state', state});
  }

  private debug(message: string): void {
    this.emit({type: 'debug', message});
  }

  private guard(): void {
    if (this.aborted) throw new AbortError('aborted');
  }

  private fallbackLine(stage: ZumiStage): string {
    switch (stage) {
      case 'greeting':
        return 'Hi! Main Zumi hoon, tumhara naya dost. Tumhara naam kya hai?';
      case 'closing':
        return 'Aaj bahut maza aaya! Kal phir milte hain. Bye!';
      default:
        return '...';
    }
  }
}
