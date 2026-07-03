/**
 * zumiLiveKitToken -- mints a LiveKit participant JWT and dispatches
 * the Zumi voice agent into the room.
 *
 * The child app calls this once at session start. The callable:
 *   1. Authenticates the child (same resolveVoiceContext chain)
 *   2. Creates a unique room with voiceStory metadata
 *   3. Embeds an agent dispatch in the token's roomConfig
 *   4. Returns { wsUrl, token, roomName } to the RN client
 *
 * Auth: signed-in child of the assignment's class.
 * Region: asia-south1 (same as other Zumi callables).
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {AccessToken} from 'livekit-server-sdk';

import {requireAuth, requireRole} from '../lib/auth';
import {resolveVoiceContext} from '../lib/zumiSession';

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const AGENT_NAME = 'zumi-voice-agent';

export interface ZumiLiveKitTokenInput {
  assignmentId: string;
}

export interface ZumiLiveKitTokenOutput {
  wsUrl: string;
  token: string;
  roomName: string;
}

export const zumiLiveKitToken = onCall<
  ZumiLiveKitTokenInput,
  Promise<ZumiLiveKitTokenOutput>
>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const {assignmentId} = request.data ?? ({} as Partial<ZumiLiveKitTokenInput>);

    if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
      throw new HttpsError('invalid-argument', 'assignmentId is required.');
    }

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      throw new HttpsError(
        'internal',
        'LiveKit credentials are not configured.',
      );
    }

    const ctx = await resolveVoiceContext(caller.uid, assignmentId);

    const roomName = `zumi_${assignmentId}_${caller.uid}_${Date.now()}`;

    const roomMetadata = JSON.stringify({
      assignmentId: ctx.assignmentId,
      childUid: caller.uid,
      childName: ctx.childName,
      grade: ctx.grade,
      topicName: ctx.topicName,
    });

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: caller.uid,
      name: ctx.childName || 'child',
      metadata: JSON.stringify({role: 'child'}),
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      roomCreate: true,
      canPublish: true,
      canSubscribe: true,
    });

    const {RoomConfiguration, RoomAgentDispatch} = await import('@livekit/protocol');
    at.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: AGENT_NAME,
          metadata: roomMetadata,
        }),
      ],
      metadata: roomMetadata,
    });

    const token = await at.toJwt();

    console.log('[zumiLiveKitToken] Token minted', {
      uid: caller.uid,
      roomName,
      assignmentId,
    });

    // wsUrl for the client — strip protocol to wss:// if it's https://
    let wsUrl = LIVEKIT_URL;
    if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    }

    return {wsUrl, token, roomName};
  },
);
