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
  zumiEvaluateAnswer,
  type ChatTurn,
  type ZumiStage,
} from './zumiApi';

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
  | 'chat'
  | 'trap'
  | 'experiment'
  | 'experiment_wait'
  | 'experiment_qa'
  | 'visualization'
  | 'discovery'
  | 'concept_reveal'
  | 'exam_mode'
  | 'quiz'
  | 'closing'
  | 'submitting'
  | 'done'
  | 'error';

export type ZumiEvent =
  | {type: 'state'; state: SessionState}
  | {type: 'avatar'; avatar: AvatarState}
  | {type: 'bubble'; text: string}
  | {type: 'lottie'; url: string | null}
  | {type: 'rive'; stateName: string | null}
  | {type: 'listening'; on: boolean}
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

const MAX_CHAT_ROUNDS = 2;
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

  constructor(
    private readonly config: ZumiSessionConfig,
    private readonly emit: (event: ZumiEvent) => void,
  ) {}

  /** Run the whole session. Returns when done (or silently on abort). */
  async start(): Promise<void> {
    try {
      await speech.configureSpeech();
      await this.runGreeting();
      await this.runChat(0);
      await this.runTrap();
      await this.runExperiment();
      await this.runVisualization();
      await this.runDiscovery();
      await this.runConceptReveal();
      await this.runExamMode();
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
    speech.stopSpeaking();
    void speech.teardownSpeech();
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

  private async runGreeting(): Promise<void> {
    this.setState('greeting');
    const reply = await this.converse('greeting');
    await this.say(reply);
  }

  private async runChat(round: number): Promise<void> {
    if (round >= MAX_CHAT_ROUNDS) return;
    this.setState('chat');
    const said = await this.hear();
    if (said) this.history.push({role: 'user', content: said});
    const reply = await this.converse('chat');
    await this.say(reply);
    await this.runChat(round + 1);
  }

  private async runTrap(): Promise<void> {
    this.setState('trap');
    this.avatar('story_mode');
    this.playAnimation(this.config.story.trapLottieKey);
    await this.say(this.config.story.wrongAnswerTrapScript);
  }

  private async runExperiment(): Promise<void> {
    const story = this.config.story;
    this.setState('experiment');
    this.avatar('talking');
    this.playAnimation(story.experimentRiveKey);
    await this.say(story.experimentInstruction);

    this.setState('experiment_wait');
    this.avatar('listening');
    // Warm the follow-up line's audio while the child does the experiment.
    speech.prefetch(this.fillName(story.experimentFollowUp));
    await this.wait(Math.max(0, (story.experimentWaitSeconds || 0) * 1000));

    this.setState('experiment_qa');
    await this.say(story.experimentFollowUp);
    const said = await this.hear();
    if (said) {
      this.history.push({role: 'user', content: said});
      const reply = await this.converse('experiment_followup');
      await this.say(reply);
    }
  }

  private async runVisualization(): Promise<void> {
    this.setState('visualization');
    this.avatar('story_mode');
    this.playAnimation(this.config.story.visualizationLottieKey);
    await this.say(this.config.story.visualizationScript);
  }

  private async runDiscovery(): Promise<void> {
    const story = this.config.story;
    this.setState('discovery');
    this.avatar('thinking');
    await this.say(story.discoveryLeadQuestion);
    const said = await this.hear();
    if (said) {
      this.history.push({role: 'user', content: said});
      const reply = await this.converse('discovery');
      this.avatar('celebrating');
      await this.say(reply);
    }
    this.avatar('celebrating');
    await this.say(story.discoveryCelebration);
  }

  private async runConceptReveal(): Promise<void> {
    this.setState('concept_reveal');
    this.avatar('story_mode');
    this.playAnimation(this.config.story.conceptRevealRiveKey);
    await this.say(this.config.story.conceptRevealScript);
  }

  private async runExamMode(): Promise<void> {
    const story = this.config.story;
    this.setState('exam_mode');
    this.avatar('talking');
    this.playAnimation(story.examLottieKey);
    // Warm the first quiz question while Zumi reads the exam-mode intro/notes.
    const firstQ = story.voiceQuiz?.[0];
    if (firstQ && !firstQ.questionAudioUrl) {
      speech.prefetch(this.fillName(firstQ.questionText));
    }
    await this.say(story.examModeIntro);
    await this.say(story.ncertDefinition);
    if (story.keywords.length > 0) {
      await this.say('Keywords yaad rakhna: ' + story.keywords.join(', '));
    }
    if (story.keyPoints.length > 0) {
      await this.say(story.keyPoints.join('. '));
    }
    if (story.memoryTrick) {
      await this.say('Memory trick: ' + story.memoryTrick);
    }
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

      const line = this.responseLine(q, verdict.result);
      this.avatar(verdict.result === 'correct' ? 'celebrating' : 'encouraging');
      await this.say(line);

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

    const reply = await this.converse('closing', percentage);
    this.avatar(percentage >= 50 ? 'celebrating' : 'encouraging');
    await this.say(reply);

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

  /** Speak a line (pre-stored audio if available, else on-device TTS). */
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
      } catch {
        // fall back to TTS
      }
    }
    await speech.speak(clean);
    this.guard();
  }

  /**
   * Wait for the child to answer this turn. Tap-to-talk: we surface a mic
   * prompt and block until the screen calls `tapTalk()` (which yields a
   * transcript) or `skipTurn()` / idle-timeout (which yields ''). Zumi never
   * races ahead on its own.
   */
  private hear(): Promise<string> {
    this.guard();
    this.avatar('listening');
    this.emit({type: 'prompt', waiting: true, skippable: true});
    this.armIdleTimer();
    return new Promise<string>(resolve => {
      this.pendingTalk = resolve;
    });
  }

  /** One AI chat turn; falls back to a safe line on network failure. */
  private async converse(stage: ZumiStage, scorePercent?: number): Promise<string> {
    this.guard();
    this.avatar('thinking');
    try {
      const {reply} = await zumiConverse({
        assignmentId: this.config.assignmentId,
        stage,
        history: this.history.slice(-8),
        scorePercent,
      });
      this.guard();
      if (reply) this.history.push({role: 'assistant', content: reply});
      return reply || this.fallbackLine(stage);
    } catch {
      return this.fallbackLine(stage);
    }
  }

  /** Server-authoritative evaluation; keyword-ish fallback on failure. */
  private async evaluate(
    q: VoiceQuizQuestion,
    transcript: string,
  ): Promise<{result: 'correct' | 'partial' | 'incorrect'; score: number}> {
    this.guard();
    try {
      const res = await zumiEvaluateAnswer({
        assignmentId: this.config.assignmentId,
        questionId: q.questionId,
        transcript,
      });
      this.guard();
      return {result: res.result, score: res.score};
    } catch {
      // The session continues even if the eval call fails; the server will
      // still grade from whatever evals it has at submit time.
      return {result: 'incorrect', score: 0};
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
    if (anim.type === 'lottie') {
      this.emit({type: 'lottie', url: anim.lottieStorageUrl ?? null});
    } else if (anim.type === 'rive') {
      this.emit({type: 'rive', stateName: anim.stateName ?? null});
    }
  }

  private findAnimation(key: string): VoiceAnimation | undefined {
    return this.config.story.animations?.find(a => a.key === key);
  }

  private fillName(text: string): string {
    const name = this.config.childName || 'dost';
    return (text ?? '').replace(/\{child_name\}/g, name);
  }

  private avatar(avatar: AvatarState): void {
    this.emit({type: 'avatar', avatar});
  }

  private setState(state: SessionState): void {
    this.emit({type: 'state', state});
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      // If aborted mid-wait, resolve early; guard() after will throw.
      const check = setInterval(() => {
        if (this.aborted) {
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 200);
      setTimeout(() => clearInterval(check), ms + 50);
    });
  }

  private guard(): void {
    if (this.aborted) throw new AbortError('aborted');
  }

  private fallbackLine(stage: ZumiStage): string {
    switch (stage) {
      case 'greeting':
        return 'Hi! Main Zumi hoon, tumhara dost. Aaj kaise ho?';
      case 'chat':
        return 'Wah, mast! Chalo aaj kuch interesting karte hain!';
      case 'experiment_followup':
        return 'Shabaash! Bahut accha observe kiya!';
      case 'discovery':
        return 'Tum toh bahut smart ho! Bilkul sahi!';
      case 'closing':
        return 'Aaj bahut maza aaya! Kal phir milte hain. Bye!';
      default:
        return '...';
    }
  }
}
