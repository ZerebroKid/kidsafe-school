/**
 * zumiLiveKit.ts — LiveKit WebRTC connection module for Zumi voice sessions.
 *
 * Replaces the HTTP callable + SSE pipeline with a persistent WebRTC session:
 *   1. Calls zumiLiveKitToken to get { wsUrl, token, roomName }
 *   2. Connects to LiveKit room, publishes mic, subscribes to agent audio
 *   3. Receives DataChannel events (state, avatar, bubble, cue, quiz, done)
 *   4. Exposes an EventEmitter interface consumed by ZumiSessionManager
 *
 * Audio I/O is handled entirely by LiveKit's WebRTC stack (AEC, jitter buffer,
 * adaptive bitrate) — no more react-native-sound or @react-native-voice/voice
 * for Zumi turns.
 */

import {EventEmitter} from 'events';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
  ConnectionState,
  DisconnectReason,
} from 'livekit-client';
import {AudioSession, AndroidAudioTypePresets} from '@livekit/react-native';
import {AppState} from 'react-native';
import {callFn} from '@zerebro/shared-firebase';
import type {ZumiAgentEvent} from '@zerebro/shared-types';

// #region agent log (debug session 884975 — remove after debugging)
// The RN app runs inside the emulator, so the host debug server (127.0.0.1)
// is reached via 10.0.2.2 (the emulator's host-loopback alias).
const DBG_URL =
  'http://10.0.2.2:7412/ingest/48c08313-88f5-473a-8d19-7067080ab802';
function dlog(
  hypothesisId: string,
  location: string,
  message: string,
  data?: Record<string, unknown>,
) {
  fetch(DBG_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Debug-Session-Id': '884975'},
    body: JSON.stringify({
      sessionId: '884975',
      runId: 'run2',
      hypothesisId,
      location,
      message,
      data: data ?? {},
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
function decodeJwtClaims(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis as any;
    const json =
      typeof g.atob === 'function'
        ? g.atob(b64)
        : g.Buffer
          ? g.Buffer.from(b64, 'base64').toString('utf8')
          : '';
    const claims = json ? JSON.parse(json) : {};
    return {
      room: claims?.video?.room,
      identity: claims?.sub,
      exp: claims?.exp,
      expiresInSec: claims?.exp ? claims.exp - Math.floor(Date.now() / 1000) : null,
      canPublish: claims?.video?.canPublish,
      canSubscribe: claims?.video?.canSubscribe,
      roomJoin: claims?.video?.roomJoin,
      hasAgentDispatch: !!claims?.roomConfig?.agents?.length,
    };
  } catch {
    return {decodeError: true};
  }
}
// #endregion

export interface ZumiLiveKitConfig {
  assignmentId: string;
}

export type ZumiLiveKitState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

interface TokenResponse {
  wsUrl: string;
  token: string;
  roomName: string;
}

export class ZumiLiveKitSession extends EventEmitter {
  private room: Room | null = null;
  private _state: ZumiLiveKitState = 'idle';
  private config: ZumiLiveKitConfig;
  /** Set when the caller intentionally tears the session down (abort/unmount). */
  private destroyed = false;
  // #region agent log (debug session 884975)
  private dbgHeartbeat: ReturnType<typeof setInterval> | null = null;
  private dbgAppSub: {remove: () => void} | null = null;
  private dbgStatsTimer: ReturnType<typeof setInterval> | null = null;
  private dbgLastPackets = 0;
  private startDebugMonitors() {
    this.dbgAppSub = AppState.addEventListener('change', next => {
      dlog('F', 'zumiLiveKit.ts:appstate', 'AppState changed', {
        appState: next,
        roomState: this.room?.state ?? 'none',
      });
    });
    this.dbgHeartbeat = setInterval(() => {
      dlog('G', 'zumiLiveKit.ts:heartbeat', 'heartbeat', {
        appState: AppState.currentState,
        roomState: this.room?.state ?? 'none',
        numParticipants: this.room?.numParticipants ?? 0,
      });
    }, 4000);
  }
  private stopDebugMonitors() {
    if (this.dbgHeartbeat) clearInterval(this.dbgHeartbeat);
    this.dbgHeartbeat = null;
    this.dbgAppSub?.remove();
    this.dbgAppSub = null;
    if (this.dbgStatsTimer) clearInterval(this.dbgStatsTimer);
    this.dbgStatsTimer = null;
  }
  // Poll the subscribed agent audio track's inbound-rtp stats. This is the
  // decisive metric: if packetsReceived climbs, the emulator IS receiving the
  // agent's audio media (so any silence is a playback/routing problem); if it
  // stays flat/zero, the media never arrives (transport problem). Also logs
  // the track/mediaStreamTrack state and the selected audio output.
  private startPlaybackStats(track: RemoteTrack) {
    if (this.dbgStatsTimer) return;
    this.dbgLastPackets = 0;
    this.dbgStatsTimer = setInterval(async () => {
      try {
        const mst = track.mediaStreamTrack;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const report = await (track as any).getRTCStatsReport?.();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let inbound: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        report?.forEach((r: any) => {
          if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio')) {
            inbound = r;
          }
        });
        let selectedOutput = 'unknown';
        try {
          const outs = await AudioSession.getAudioOutputs();
          selectedOutput = Array.isArray(outs) ? outs.join(',') : String(outs);
        } catch {
          /* ignore */
        }
        const packets = inbound?.packetsReceived ?? 0;
        const stat = {
          packetsReceived: packets,
          packetsDelta: packets - this.dbgLastPackets,
          bytesReceived: inbound?.bytesReceived ?? 0,
          packetsLost: inbound?.packetsLost ?? null,
          jitter: inbound?.jitter ?? null,
          trackMuted: track.isMuted,
          mstEnabled: mst?.enabled,
          mstReadyState: mst?.readyState,
          audioOutputs: selectedOutput,
        };
        // console.log so it lands in Metro — the HTTP dlog ingest (port 7412)
        // is not always running, but Metro always captures console output.
        console.log('[ZumiPlayback]', JSON.stringify(stat));
        dlog('H', 'zumiLiveKit.ts:playbackStats', 'inbound agent audio stats', stat);
        this.dbgLastPackets = packets;
      } catch (e) {
        console.log('[ZumiPlayback] stats poll error', (e as {message?: string})?.message);
      }
    }, 3000);
  }
  // #endregion

  constructor(config: ZumiLiveKitConfig) {
    super();
    this.config = config;
  }

  get state(): ZumiLiveKitState {
    return this._state;
  }

  private setState(state: ZumiLiveKitState) {
    this._state = state;
    this.emit('connectionState', state);
  }

  async connect(): Promise<void> {
    if (this.room) {
      console.warn('[ZumiLiveKit] Already connected');
      return;
    }

    this.setState('connecting');

    try {
      const {wsUrl, token, roomName} = await callFn<
        {assignmentId: string},
        TokenResponse
      >('zumiLiveKitToken', {assignmentId: this.config.assignmentId});

      // #region agent log (debug session 884975)
      dlog('A', 'zumiLiveKit.ts:token', 'Token received from callable', {
        wsUrl,
        roomName,
        tokenLen: token?.length ?? 0,
        claims: decodeJwtClaims(token),
      });
      // #endregion

      // Configure audio to route playback out the LOUDSPEAKER (not the
      // earpiece). On an emulator — and for a hands-free kids assistant — the
      // earpiece output is silent, so we prefer speaker and use the media
      // audio preset which reliably plays remote TTS audio. Must be called
      // before startAudioSession()/connect() for the config to take effect.
      await AudioSession.configureAudio({
        android: {
          preferredOutputList: ['speaker'],
          audioTypeOptions: AndroidAudioTypePresets.media,
        },
        ios: {defaultOutput: 'speaker'},
      });
      await AudioSession.startAudioSession();

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      this.setupRoomListeners(this.room);

      // Default ICE policy ('all') gathers host/srflx/relay candidates and uses
      // LiveKit Cloud's TURN relay as an automatic fallback — the right choice
      // for real devices behind NAT. (Forcing `relay`-only was tried for the
      // Android emulator but made it fail immediately, and the emulator's WebRTC
      // media stack is unreliable regardless; test in-app on a physical device.)
      await this.room.connect(wsUrl, token);

      // #region agent log (debug session 884975)
      dlog('A', 'zumiLiveKit.ts:connected', 'Room.connect() resolved', {
        roomName: this.room.name,
        localIdentity: this.room.localParticipant?.identity,
        connectionState: this.room.state,
        numParticipants: this.room.numParticipants,
      });
      // #endregion

      // If the caller tore us down while connect() was in flight (e.g. the
      // screen was closed / backgrounded), stop here without surfacing a fatal
      // error — the disconnect was intentional, not a failure.
      if (this.destroyed) {
        await this.room.disconnect().catch(() => {});
        this.room = null;
        return;
      }

      await this.room.localParticipant.setMicrophoneEnabled(true);

      // Force output to the loudspeaker and max the remote track volume so the
      // agent's TTS is actually audible (emulators default to a silent route).
      await AudioSession.setDefaultRemoteAudioTrackVolume(1.0).catch(() => {});
      try {
        const outputs = await AudioSession.getAudioOutputs();
        if (outputs.includes('speaker')) {
          await AudioSession.selectAudioOutput('speaker');
        }
        console.log('[ZumiLiveKit] Audio outputs:', outputs.join(', '));
      } catch (routeErr) {
        console.warn('[ZumiLiveKit] Could not select speaker output:', routeErr);
      }

      this.setState('connected');
      // #region agent log (debug session 884975)
      this.startDebugMonitors();
      // #endregion
      console.log('[ZumiLiveKit] Connected to room');
    } catch (err) {
      // A client-initiated disconnect during connect is an intentional
      // teardown (abort/unmount/permission prompt), not a real failure.
      if (this.destroyed) {
        console.log('[ZumiLiveKit] Connect aborted by client (intentional)');
        return;
      }
      // #region agent log (debug session 884975)
      dlog('A', 'zumiLiveKit.ts:connect-catch', 'connect() threw', {
        name: (err as {name?: string})?.name,
        message: (err as {message?: string})?.message,
        stack: (err as {stack?: string})?.stack?.slice(0, 500),
        destroyed: this.destroyed,
      });
      // #endregion
      console.error('[ZumiLiveKit] Connection failed:', err);
      this.setState('error');
      this.emit('error', err);
      throw err;
    }
  }

  private setupRoomListeners(room: Room) {
    // #region agent log (debug session 884975)
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      dlog('A', 'zumiLiveKit.ts:connState', 'ConnectionStateChanged', {state});
    });
    room.on(RoomEvent.SignalConnected, () => {
      dlog('A', 'zumiLiveKit.ts:signal', 'SignalConnected (websocket up)');
    });
    room.on(RoomEvent.LocalTrackPublished, pub => {
      dlog('C', 'zumiLiveKit.ts:localPublished', 'LocalTrackPublished', {
        source: pub?.source,
        kind: pub?.kind,
        trackSid: pub?.trackSid,
        isMuted: pub?.isMuted,
      });
    });
    // #endregion

    room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const event: ZumiAgentEvent = JSON.parse(text);
        this.emit('agentEvent', event);
        this.emit(event.type, event);
      } catch (err) {
        console.warn('[ZumiLiveKit] Failed to parse DataChannel event:', err);
      }
    });

    // The agent speaks via the LLM/TTS pipeline and publishes synchronized
    // transcriptions (not custom `bubble` events). Surface the agent's final
    // segments as bubble events so the child sees Zumi's words on screen.
    room.on(
      RoomEvent.TranscriptionReceived,
      (
        segments: Array<{text: string; final: boolean}>,
        participant?: RemoteParticipant,
      ) => {
        // Only show the agent's speech, not the child's own STT transcript.
        const isAgent = participant?.isAgent ?? true;
        if (!isAgent) return;
        const text = segments
          .filter(s => s.final)
          .map(s => s.text)
          .join(' ')
          .trim();
        if (text) {
          this.emit('agentEvent', {type: 'bubble', text} as ZumiAgentEvent);
        }
      },
    );

    room.on(
      RoomEvent.TrackSubscribed,
      (
        track: RemoteTrack,
        _publication: RemoteTrackPublication,
        _participant: RemoteParticipant,
      ) => {
        if (track.kind === Track.Kind.Audio) {
          console.log('[ZumiLiveKit] Agent audio track subscribed');
          // #region agent log (debug session 884975)
          dlog('D', 'zumiLiveKit.ts:trackSub', 'Remote audio TrackSubscribed', {
            participant: _participant?.identity,
            isAgent: _participant?.isAgent,
            trackSid: _publication?.trackSid,
            trackMuted: track.isMuted,
            mstEnabled: track.mediaStreamTrack?.enabled,
            mstReadyState: track.mediaStreamTrack?.readyState,
          });
          this.startPlaybackStats(track);
          // #endregion
          this.emit('agentAudioStarted');
        }
      },
    );

    room.on(
      RoomEvent.TrackUnsubscribed,
      (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          this.emit('agentAudioStopped');
        }
      },
    );

    room.on(RoomEvent.Reconnecting, () => {
      // #region agent log (debug session 884975)
      dlog('B', 'zumiLiveKit.ts:reconnecting', 'RoomEvent.Reconnecting', {});
      // #endregion
      this.setState('reconnecting');
    });

    room.on(RoomEvent.Reconnected, () => {
      // #region agent log (debug session 884975)
      dlog('B', 'zumiLiveKit.ts:reconnected', 'RoomEvent.Reconnected', {});
      // #endregion
      this.setState('connected');
    });

    room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      // #region agent log (debug session 884975)
      dlog('A', 'zumiLiveKit.ts:disconnected', 'RoomEvent.Disconnected', {
        reason,
        reasonName: reason != null ? DisconnectReason[reason] : 'undefined',
        destroyed: this.destroyed,
      });
      // #endregion
      this.setState('disconnected');
      this.emit('sessionEnded');
    });

    room.on(
      RoomEvent.ParticipantConnected,
      (participant: RemoteParticipant) => {
        console.log(
          '[ZumiLiveKit] Participant connected:',
          participant.identity,
        );
      },
    );
  }

  /**
   * Send a control message to the agent via DataChannel.
   * Used for skip, abort, or other client-initiated actions.
   */
  async sendControl(action: string, data?: Record<string, unknown>) {
    if (!this.room) return;
    const payload = JSON.stringify({action, ...data});
    await this.room.localParticipant.publishData(
      new TextEncoder().encode(payload),
      {reliable: true},
    );
  }

  /** Mute/unmute the local microphone. */
  async setMicEnabled(enabled: boolean) {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  /** Disconnect from the LiveKit room. */
  async disconnect() {
    // #region agent log (debug session 884975)
    dlog('E', 'zumiLiveKit.ts:disconnect', 'disconnect() called by app', {
      hadRoom: !!this.room,
      state: this._state,
      stack: new Error().stack?.split('\n').slice(1, 6).join(' | '),
    });
    this.stopDebugMonitors();
    // #endregion
    this.destroyed = true;
    await AudioSession.stopAudioSession().catch(() => {});
    if (!this.room) return;
    await this.room.disconnect();
    this.room = null;
    this.setState('disconnected');
  }

  /** Clean up all resources. */
  destroy() {
    this.destroyed = true;
    this.disconnect().catch(() => {});
    this.removeAllListeners();
  }
}
