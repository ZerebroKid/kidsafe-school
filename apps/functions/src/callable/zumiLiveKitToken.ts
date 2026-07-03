/**
 * Mint a LiveKit access token for a Zumi live voice session.
 *
 * The streaming pipeline (see apps/zumi-agent) runs as a LiveKit Agent over
 * WebRTC: the child app joins a room, the Python agent joins the same room and
 * streams STT -> LLM -> TTS in real time. This callable is the ONLY door into
 * a room:
 *
 *   1. Auth: signed-in child of the assignment's class, topic must have a
 *      voiceStory (same `resolveVoiceContext` chain as every Zumi callable).
 *   2. Room name is derived server-side: `zumi_{assignmentId}_{uid}` -- a
 *      child can only ever join their own session's room.
 *   3. The teaching context (assignmentId, child name, grade) rides in the
 *      participant metadata, signed into the token, so the agent trusts it
 *      without a second lookup round trip (it still loads the voiceStory
 *      itself from Firestore).
 *
 * LiveKit credentials come from secrets (`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`)
 * and the `LIVEKIT_URL` param, so nothing lives in source or the client.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {defineSecret, defineString} from 'firebase-functions/params';
import {AccessToken} from 'livekit-server-sdk';

import {requireAuth, requireRole} from '../lib/auth';
import {stepLogger} from '../lib/perf';
import {resolveVoiceContext} from '../lib/zumiSession';

export const livekitApiKey = defineSecret('LIVEKIT_API_KEY');
export const livekitApiSecret = defineSecret('LIVEKIT_API_SECRET');
/** wss://<project>.livekit.cloud -- safe to expose to the client. */
export const livekitUrl = defineString('LIVEKIT_URL', {default: ''});

export interface ZumiLiveKitTokenInput {
  assignmentId: string;
}

export interface ZumiLiveKitTokenOutput {
  /** LiveKit server websocket URL the client connects to. */
  url: string;
  /** Signed JWT granting access to this session's room only. */
  token: string;
  /** Room the token is scoped to (zumi_{assignmentId}_{uid}). */
  room: string;
}

/** Metadata the Python agent reads off the child participant. */
interface ZumiParticipantMetadata {
  assignmentId: string;
  childUid: string;
  childName: string;
  grade: number;
  curriculumId: string;
  chapterId: string;
  topicId: string;
  topicName: string;
  classId: string;
}

const TOKEN_TTL_SECONDS = 60 * 60; // one lesson, generous

export const zumiLiveKitToken = onCall<
  ZumiLiveKitTokenInput,
  Promise<ZumiLiveKitTokenOutput>
>(
  // minInstances: this callable gates session start -- a cold start here is
  // dead air before Zumi's first word, so keep one instance warm.
  {region: 'asia-south1', minInstances: 1, secrets: [livekitApiKey, livekitApiSecret]},
  async request => {
    const log = stepLogger('zumiLiveKitToken');
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const {assignmentId} = request.data ?? ({} as Partial<ZumiLiveKitTokenInput>);
    log.start({assignmentId});

    const url = livekitUrl.value();
    if (!url || !livekitApiKey.value() || !livekitApiSecret.value()) {
      throw new HttpsError(
        'failed-precondition',
        'LiveKit is not configured on the server.',
      );
    }

    // Full authorization chain (assignment active, child of the class, topic
    // has a voiceStory) -- identical guarantees to the other Zumi callables.
    const ctx = await log.step(
      'resolveContext',
      () => resolveVoiceContext(caller.uid, assignmentId as string),
      c => `topic=${c.topicId} child=${c.childName || '(no name)'}`,
    );

    const room = `zumi_${ctx.assignmentId}_${caller.uid}`;
    const metadata: ZumiParticipantMetadata = {
      assignmentId: ctx.assignmentId,
      childUid: caller.uid,
      childName: ctx.childName,
      grade: ctx.grade,
      curriculumId: ctx.curriculumId,
      chapterId: ctx.chapterId,
      topicId: ctx.topicId,
      topicName: ctx.topicName,
      classId: ctx.classId,
    };

    const at = new AccessToken(livekitApiKey.value(), livekitApiSecret.value(), {
      identity: `child_${caller.uid}`,
      name: ctx.childName || 'child',
      metadata: JSON.stringify(metadata),
      ttl: TOKEN_TTL_SECONDS,
    });
    at.addGrant({
      room,
      roomJoin: true,
      // The room is created on first join; the agent worker is dispatched to it.
      roomCreate: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    log.end({room, urlHost: url.replace(/^wss?:\/\//, '')});
    return {url, token, room};
  },
);
