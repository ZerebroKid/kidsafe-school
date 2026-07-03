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
  type ZumiConverseOutput,
  type ZumiStage,
} from './zumiApi';
import {logInfo, timed, turn as perfTurn} from './zumiPerf';
import {findTopicVideo, type ZumiVideoSource} from './zumiVideos';

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
  | {type: 'video'; source: ZumiVideoSource | null}
  | {type: 'listening'; on: boolean; mode?: 'auto' | 'tap'; speaking?: boolean}
  | {type: 'transcribing'; on: boolean}
  | {type: 'prompt'; waiting: boolean; skippable: boolean; hint?: string}
  | {type: 'quiz'; current: number; total: number; score: number}
  | {type: 'done'; percentage: number; passed: boolean; score: number; maxScore: number}
  | {type: 'error'; message: string};

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
  /** Resolver for the in-flight explanation video (screen calls notifyVideoDone). */
  private pendingVideo: (() => void) | null = null;
  /** The explanation video only plays once per session. */
  private videoPlayed = false;

  constructor(
    private readonly config: ZumiSessionConfig,
    private readonly emit: (event: ZumiEvent) => void,
  ) {}

  /** Run the whole session. Returns when done (or silently on abort). */
  async start(): Promise<void> {
    try {
      speech.resetCloudTts();
      // LATENCY: fire the greeting AI call immediately, in parallel with the
      // speech engine + mic-permission setup, so Zumi's first line (and its
      // server-synthesized audio) is usually ready the moment the screen is.
      const greetingPromise = this.converse('greeting');
      await timed('setup.configureSpeech', () => speech.configureSpeech());
      // Ask for the mic up front so the first listening turn is hands-free
      // rather than blocked on an OS permission dialog mid-conversation.
      this.handsFree = await timed(
        'setup.micPermission',
        () => speech.ensureMicPermission(),
        ok => (ok ? 'granted' : 'DENIED (tap-to-talk mode)'),
      );
      await this.runGreeting(greetingPromise);
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

  /** Stop the session (call on screen unmount). */
  abort(): void {
    this.aborted = true;
    this.clearIdleTimer();
    this.clearRecordTimer();
    // Unwind any awaited `hear()` so the run loop can exit (next guard throws).
    const resolve = this.pendingTalk;
    this.pendingTalk = null;
    resolve?.('');
    // Unwind an awaited explanation video the same way.
    const videoResolve = this.pendingVideo;
    this.pendingVideo = null;
    videoResolve?.();
    speech.cancelListening();
    speech.stopSpeaking();
    void speech.teardownSpeech();
  }

  /** Screen callback: the explanation video finished (or was skipped). */
  notifyVideoDone(): void {
    const resolve = this.pendingVideo;
    this.pendingVideo = null;
    this.emit({type: 'video', source: null});
    resolve?.();
  }

  /** UI "done" tap during a hands-free turn: stop listening and transcribe. */
  stopListening(): void {
    speech.stopListening();
  }

  // ---- tap-to-talk (driven by the screen) ---------------------------------

  /**
   * Mic button: a start/stop toggle. First tap starts recording the answer;
   * second tap (or the max-record timer) stops it, uploads, and transcribes via
   * ElevenLabs. Taps are ignored while a transcription is already in flight.
   */
  async tapTalk(): Promise<void> {
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
    greetingPromise?: Promise<{reply: string; audioUrl?: string}>,
  ): Promise<void> {
    const t = perfTurn('greeting');
    this.setState('greeting');
    const {reply, audioUrl} = await (greetingPromise ?? this.converse('greeting'));
    this.guard();
    await this.say(reply, audioUrl);
    // Wait for the child to answer the greeting (their name / how they are) so
    // the first teaching turn reacts to them instead of barrelling ahead.
    const said = await this.hear();
    this.history.push({
      role: 'user',
      content: said || '(bachche ne kuch nahi kaha)',
    });
    t.end();
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

    for (let turn = 0; turn < MAX_TEACH_TURNS; turn++) {
      this.guard();
      const t = perfTurn(`teaching#${turn} (${phase})`);

      const result = await this.teach(phase);
      const enteringExplain = result.phase === 'explain' && phase !== 'explain';
      phase = result.phase;

      // First time the lesson reaches the explain phase: play the topic's
      // explanation video (its own voiceover explains the concept), then let
      // Zumi continue with her line.
      if (enteringExplain && !this.videoPlayed) {
        await this.playTopicVideo();
      }

      this.applyAnimationHint(result.animationHint);
      await this.say(result.say, result.audioUrl);

      if (phase === 'ready_for_quiz') {
        t.end('ready_for_quiz');
        break;
      }

      const said = await this.hear();
      // Always record the child's turn (or a silence marker) so the director
      // can react specifically next turn and re-engage instead of repeating.
      this.history.push({
        role: 'user',
        content: said || '(bachche ne kuch nahi kaha)',
      });
      t.end(`phase=${phase}`);
    }

    // Warm the first quiz question's audio before the quiz starts.
    const firstQ = this.config.story.voiceQuiz?.[0];
    if (firstQ && !firstQ.questionAudioUrl) {
      speech.prefetch(this.fillName(firstQ.questionText));
    }
  }

  /**
   * Play the topic's bundled explanation video, if there is one. Zumi stops
   * talking, the screen shows a fullscreen player (video has its own
   * voiceover), and the lesson resumes when the screen calls
   * `notifyVideoDone()` (video ended or the child tapped Skip).
   */
  private async playTopicVideo(): Promise<void> {
    this.guard();
    const source = findTopicVideo(this.config.topicName);
    if (!source) {
      logInfo(`no explanation video for topic "${this.config.topicName}"`);
      return;
    }
    this.videoPlayed = true;
    speech.stopSpeaking();
    this.avatar('story_mode');
    this.emit({type: 'cue', cue: null});
    this.emit({
      type: 'bubble',
      text: 'Dekho, maine tumhare liye ek video banaya hai!',
    });
    logInfo('explanation video START');
    const t = perfTurn('explanation-video');
    this.emit({type: 'video', source});
    await new Promise<void>(resolve => {
      this.pendingVideo = resolve;
    });
    t.end();
    this.guard();
    this.avatar('idle');
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
      const t = perfTurn(`quiz#${i}`);
      const q = questions[i];
      this.emit({
        type: 'quiz',
        current: i,
        total: questions.length,
        score: this.score,
      });
      this.avatar('talking');
      await this.say(q.questionText, q.questionAudioUrl);

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
      await this.say(line);

      this.emit({
        type: 'quiz',
        current: i + 1,
        total: questions.length,
        score: this.score,
      });
      t.end(`result=${verdict.result} score=${this.score}`);
    }
  }

  private async runClosing(): Promise<void> {
    this.setState('closing');
    const questions = this.config.story.voiceQuiz ?? [];
    const maxScore = Math.max(1, questions.length * POINTS_PER_QUESTION);
    const percentage = Math.round((this.score / maxScore) * 100);

    const {reply, audioUrl} = await this.converse('closing', percentage);
    this.avatar(percentage >= 50 ? 'celebrating' : 'encouraging');
    await this.say(reply, audioUrl);

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

  /**
   * Speak a line. Prefers a ready-to-play `audioUrl` (returned inline by
   * zumiTeach/zumiConverse, or pre-stored on a quiz question) so no extra
   * TTS round trip is needed; falls back to `speech.speak()` (cloud synth ->
   * on-device TTS) if the URL is absent or playback fails.
   */
  private async say(text: string, audioUrl?: string): Promise<void> {
    this.guard();
    const clean = this.fillName(text);
    this.emit({type: 'bubble', text: clean});
    this.avatar('talking');
    if (audioUrl) {
      try {
        await speech.playUrl(audioUrl);
        this.guard();
        return;
      } catch (err) {
        logInfo(
          `server audioUrl playback failed, falling back to speak(): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    await speech.speak(clean);
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
    if (this.handsFree) {
      const auto = await this.hearAuto();
      if (auto !== null) return auto;
    }
    return this.hearTap();
  }

  /**
   * Hands-free turn. Resolves with the transcript ('' if nothing was heard), or
   * `null` when the mic can't be used (permission revoked / recorder failure)
   * so the caller switches to tap-to-talk for the rest of the session.
   */
  private async hearAuto(): Promise<string | null> {
    this.emit({type: 'listening', on: true, mode: 'auto', speaking: false});
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
    });

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

  /** One AI chat turn; falls back to a safe line on network failure. */
  private async converse(
    stage: ZumiStage,
    scorePercent?: number,
  ): Promise<{reply: string; audioUrl?: string}> {
    this.guard();
    this.avatar('thinking');
    try {
      const out: ZumiConverseOutput = await zumiConverse({
        assignmentId: this.config.assignmentId,
        stage,
        history: this.history.slice(-8),
        scorePercent,
      });
      this.guard();
      if (out.reply) this.history.push({role: 'assistant', content: out.reply});
      return {
        reply: out.reply || this.fallbackLine(stage),
        audioUrl: out.audioUrl,
      };
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
    audioUrl?: string;
  }> {
    this.guard();
    this.avatar('thinking');
    try {
      const result = await zumiTeach({
        assignmentId: this.config.assignmentId,
        phase,
        history: this.history.slice(-20),
      });
      this.guard();
      if (result.say) {
        this.history.push({role: 'assistant', content: result.say});
      }
      return {
        say: result.say || this.teachFallbackLine(phase),
        phase: result.phase || this.nextPhase(phase),
        animationHint: result.animationHint || 'none',
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

  /** Server-authoritative evaluation; keyword-ish fallback on failure. */
  private async evaluate(
    q: VoiceQuizQuestion,
    transcript: string,
  ): Promise<{
    result: 'correct' | 'partial' | 'incorrect';
    score: number;
    feedback: string;
  }> {
    this.guard();
    try {
      const res = await zumiEvaluateAnswer({
        assignmentId: this.config.assignmentId,
        questionId: q.questionId,
        transcript,
      });
      this.guard();
      return {result: res.result, score: res.score, feedback: res.feedback ?? ''};
    } catch {
      // The session continues even if the eval call fails; the server will
      // still grade from whatever evals it has at submit time.
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
