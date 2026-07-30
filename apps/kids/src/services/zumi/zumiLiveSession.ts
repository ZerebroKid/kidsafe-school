/**
 * ZumiLiveSession -- the streaming (LiveKit) replacement for
 * `ZumiSessionManager`'s request/response pipeline.
 *
 * Instead of hear -> zumiTeach -> play-MP3 round trips (8-12s of dead air per
 * turn), the app joins a WebRTC room and the Python agent (apps/zumi-agent)
 * streams STT -> LLM -> TTS continuously, answering in under ~1.5s. This class
 * keeps the exact event surface of `ZumiSessionManager` (`ZumiEvent`) so
 * `ZumiVoiceScreen` renders both implementations unchanged:
 *
 *   - Zumi's voice arrives as a live audio track (auto-played by LiveKit).
 *   - Speech bubbles come from LiveKit transcription text streams.
 *   - Avatar states derive from the agent state attribute
 *     (listening / thinking / speaking).
 *   - Animation cues, the explain video, quiz progress and the final result
 *     arrive as data messages on the "zumi" topic (see agent.py `send_ui`).
 *
 * The quiz score is still server-authoritative: the agent writes verdicts to
 * `quizVoiceEvals`, and on the final "done" message this class calls
 * `submitQuizAttempt` (mode voice) exactly like the old manager did.
 */

import {AudioSession} from '@livekit/react-native';
import {
  ConnectionState,
  ParticipantKind,
  Room,
  RoomEvent,
  type RemoteParticipant,
} from 'livekit-client';

import {submitVoiceQuiz, zumiLiveKitToken} from './zumiApi';
import {ensureMicPermission} from './zumiSpeech';
import {logInfo, mark, timed} from './zumiPerf';
import {findTopicVideo} from './zumiVideos';
import type {
  AvatarState,
  ZumiClip,
  ZumiEvent,
  ZumiSessionConfig,
} from './zumiSessionManager';

// Installed at runtime by @livekit/react-native's registerGlobals() (bundled
// EncoderDecoderTogether polyfill); the RN TS lib doesn't declare it.
declare const TextDecoder: new () => {decode(input: Uint8Array): string};

/** Data messages the agent sends on the "zumi" topic. */
interface AgentUiMessage {
  type: 'cue' | 'video' | 'video_end' | 'quiz' | 'done';
  hint?: string;
  current?: number;
  total?: number;
  score?: number;
  maxScore?: number;
  percentage?: number;
  passed?: boolean;
}

const HINT_TO_CLIP: Record<string, ZumiClip | null> = {
  visualize: 'books',
  experiment: 'chaos',
  reveal: 'sparkle',
  trap: 'chaos',
  celebrate: null,
  none: null,
};

/**
 * Teardown of the PREVIOUS session (room disconnect + audio session stop).
 *
 * A new session must wait for this before connecting: both sessions use the
 * same LiveKit identity (child uid), and an old room that is still
 * disconnecting/auto-reconnecting gets the NEW connection kicked with
 * DUPLICATE_IDENTITY ("Zumi se connection toot gaya" moments after joining).
 * The old abort's stopAudioSession could also race after the new session's
 * startAudioSession, silencing it.
 */
let lastTeardown: Promise<void> = Promise.resolve();

export class ZumiLiveSession {
  private room: Room | null = null;
  private aborted = false;
  private agentIdentity: string | null = null;
  private videoShowing = false;

  constructor(
    private readonly config: ZumiSessionConfig,
    private readonly emit: (event: ZumiEvent) => void,
  ) {}

  async start(): Promise<void> {
    try {
      // Stay in the screen's 'init' state (loading overlay) until Zumi's
      // first word actually plays -- see onAgentState. Connect + agent
      // dispatch + greeting generation take a few seconds; showing the idle
      // mascot during that window reads as "broken".
      this.avatar('thinking');

      const granted = await ensureMicPermission();
      if (!granted) {
        throw new Error('Mic permission chahiye Zumi se baat karne ke liye.');
      }

      // Token minting runs in parallel with the native audio session setup.
      const tokenPromise = zumiLiveKitToken({
        assignmentId: this.config.assignmentId,
      });
      // Let any previous session finish disconnecting first (see lastTeardown).
      await lastTeardown;
      if (this.aborted) return;
      await AudioSession.startAudioSession();
      const {url, token} = await tokenPromise;
      if (this.aborted) return;

      const room = new Room();
      this.room = room;
      this.wireRoomEvents(room);

      await timed('live.connect', () => room.connect(url, token));
      if (this.aborted) {
        await room.disconnect();
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      logInfo('live session connected — waiting for Zumi');
    } catch (err) {
      if (this.aborted) return;
      this.setState('error');
      this.emit({
        type: 'error',
        message:
          (err as {message?: string} | null)?.message ??
          'Zumi se connect nahi ho paya. Baad mein try karo!',
      });
    }
  }

  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    const room = this.room;
    this.room = null;
    lastTeardown = (async () => {
      try {
        await room?.disconnect();
      } catch {
        // ignore
      }
      try {
        await AudioSession.stopAudioSession();
      } catch {
        // ignore
      }
    })();
  }

  /** The explain video ended or was skipped -> tell the agent to resume. */
  notifyVideoDone(): void {
    if (!this.videoShowing) return;
    this.videoShowing = false;
    this.emit({type: 'video', source: null});
    // Clear the pre-video line so the child doesn't see the stale "chalo
    // shuru karte hain!" bubble again while the agent moves on to the quiz.
    this.emit({type: 'bubble', text: ''});
    this.avatar('thinking');
    const room = this.room;
    if (!room || !this.agentIdentity) return;
    void room.localParticipant
      .performRpc({
        destinationIdentity: this.agentIdentity,
        method: 'zumi.video_done',
        payload: '',
      })
      .catch(err =>
        logInfo(
          `video_done rpc failed: ${err instanceof Error ? err.message : err}`,
        ),
      );
  }

  // The live pipeline is fully hands-free (server VAD + turn detection);
  // these tap-to-talk hooks from the old manager are inert here.
  stopListening(): void {}
  async tapTalk(): Promise<void> {}
  skipTurn(): void {}

  // ---- room wiring ----------------------------------------------------------

  private wireRoomEvents(room: Room): void {
    // Zumi's speech bubble: transcription segments of the agent's speech.
    room.registerTextStreamHandler('lk.transcription', (reader, participant) => {
      void (async () => {
        if (participant?.identity === room.localParticipant.identity) {
          // The child's own transcript -- not shown as Zumi's bubble.
          for await (const _chunk of reader) {
            // drain
          }
          return;
        }
        let text = '';
        for await (const chunk of reader) {
          text += chunk;
          if (!this.aborted && text.trim()) {
            this.emit({type: 'bubble', text: text.trim()});
          }
        }
      })().catch(() => undefined);
    });

    room.on(RoomEvent.ParticipantConnected, p => this.maybeAdoptAgent(p));
    room.on(RoomEvent.ConnectionStateChanged, state => {
      logInfo(`live connection: ${state}`);
      if (
        state === ConnectionState.Disconnected &&
        !this.aborted &&
        !this.doneEmitted
      ) {
        this.setState('error');
        this.emit({
          type: 'error',
          message: 'Zumi se connection toot gaya. Phir se try karo!',
        });
      }
    });

    // Agent state attribute drives the avatar + listening indicator.
    room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
      const state = changed['lk.agent.state'] ?? participant.attributes['lk.agent.state'];
      if (!state || participant.isLocal) return;
      this.onAgentState(state);
    });

    room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
      if (topic !== 'zumi') return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as AgentUiMessage;
        this.onAgentMessage(msg);
      } catch {
        // malformed message -- ignore
      }
    });

    room.remoteParticipants.forEach(p => this.maybeAdoptAgent(p));
  }

  private maybeAdoptAgent(p: RemoteParticipant): void {
    if (this.agentIdentity) return;
    if (p.kind === ParticipantKind.AGENT || p.identity.startsWith('agent')) {
      this.agentIdentity = p.identity;
      logInfo(`agent joined: ${p.identity}`);
    }
  }

  /** False until Zumi's first word -- the screen shows a loader before that. */
  private revealed = false;

  private onAgentState(state: string): void {
    if (this.aborted || this.videoShowing || this.doneEmitted) return;
    // Reveal on 'listening' too: when the child rejoins a room where the
    // agent is already mid-flow waiting for an answer, there is no 'speaking'
    // transition -- gating the reveal on it left the screen stuck on the
    // "Zumi aa raha hai" loader forever.
    if ((state === 'speaking' || state === 'listening') && !this.revealed) {
      this.revealed = true;
      logInfo(`Zumi ${state} — revealing UI`);
      this.setState('greeting');
    }
    switch (state) {
      case 'listening':
        this.avatar('listening');
        this.emit({type: 'listening', on: true, mode: 'auto', speaking: false});
        break;
      case 'thinking':
        this.emit({type: 'listening', on: false});
        this.avatar('thinking');
        break;
      case 'speaking':
        this.emit({type: 'listening', on: false});
        this.avatar('talking');
        break;
      default:
        break;
    }
  }

  private doneEmitted = false;

  private onAgentMessage(msg: AgentUiMessage): void {
    if (this.aborted) return;
    switch (msg.type) {
      case 'cue': {
        const hint = msg.hint ?? 'none';
        if (hint === 'celebrate') {
          this.avatar('celebrating');
          this.emit({type: 'cue', cue: null});
          break;
        }
        const clip = HINT_TO_CLIP[hint] ?? null;
        if (clip) {
          this.avatar('story_mode');
          this.emit({
            type: 'cue',
            cue: {kind: 'lottie', key: clip, stageNumber: 0, clip},
          });
        } else {
          this.emit({type: 'cue', cue: null});
        }
        break;
      }
      case 'video': {
        const source = findTopicVideo(this.config.topicName);
        if (!source) {
          // No bundled video for this topic -- resume the agent immediately.
          this.videoShowing = true;
          this.notifyVideoDone();
          break;
        }
        this.videoShowing = true;
        this.avatar('story_mode');
        this.emit({type: 'cue', cue: null});
        this.emit({type: 'video', source});
        break;
      }
      case 'video_end':
        // Agent resumed (e.g. after our RPC or its own timeout).
        if (this.videoShowing) {
          this.videoShowing = false;
          this.emit({type: 'video', source: null});
          this.emit({type: 'bubble', text: ''});
        }
        break;
      case 'quiz':
        this.setState('quiz');
        this.emit({
          type: 'quiz',
          current: msg.current ?? 0,
          total: msg.total ?? 0,
          score: msg.score ?? 0,
        });
        break;
      case 'done':
        void this.finish(msg);
        break;
    }
  }

  /** Final submit -- the server re-derives the score from quizVoiceEvals. */
  private async finish(msg: AgentUiMessage): Promise<void> {
    if (this.doneEmitted) return;
    this.doneEmitted = true;
    this.setState('submitting');
    const endSubmit = mark('live.submitQuiz');
    let result: Awaited<ReturnType<typeof submitVoiceQuiz>> | null = null;
    try {
      result = await submitVoiceQuiz({
        assignmentId: this.config.assignmentId,
        answers: [],
        mode: 'voice',
        voiceAnswers: [],
      });
    } catch {
      result = null;
    }
    endSubmit(result ? 'ok' : 'failed (using agent score)');
    if (this.aborted) return;

    this.setState('done');
    this.avatar('idle');
    this.emit({
      type: 'done',
      percentage: result?.percentage ?? msg.percentage ?? 0,
      passed: result?.passed ?? msg.passed ?? false,
      score: result?.score ?? msg.score ?? 0,
      maxScore: result?.total ?? msg.maxScore ?? 100,
    });
  }

  // ---- helpers --------------------------------------------------------------

  private avatar(avatar: AvatarState): void {
    this.emit({type: 'avatar', avatar});
  }

  private setState(
    state: 'greeting' | 'teaching' | 'quiz' | 'submitting' | 'done' | 'error',
  ): void {
    this.emit({type: 'state', state});
  }
}
