/**
 * Zumi speech-to-text proxy. The child app records an answer, uploads it to
 * `zumi_stt/{uid}/{file}` in Storage, then calls this with the path. We download
 * the bytes, transcribe via ElevenLabs Scribe (key stays server-side), delete
 * the temp upload, and return the transcript.
 *
 * Auth: signed-in child. The path MUST live under the caller's own
 * `zumi_stt/{uid}/` prefix so one child can't transcribe another's audio.
 *
 * Never throws on a transcription hiccup -- returns `{transcript: ''}` so the
 * session treats it as "no answer" and lets the child retry / skip.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {requireAuth, requireRole} from '../lib/auth';
import {bucket} from '../lib/admin';
import {elevenLabsApiKey, transcribe} from '../lib/elevenLabs';

export interface ZumiTranscribeInput {
  storagePath: string;
}

export interface ZumiTranscribeOutput {
  transcript: string;
}

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const zumiTranscribe = onCall<
  ZumiTranscribeInput,
  Promise<ZumiTranscribeOutput>
>(
  {region: 'asia-south1', minInstances: 1, secrets: [elevenLabsApiKey]},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const storagePath = request.data?.storagePath;
    const prefix = `zumi_stt/${caller.uid}/`;
    if (
      typeof storagePath !== 'string' ||
      !storagePath.startsWith(prefix) ||
      storagePath.includes('..')
    ) {
      throw new HttpsError('permission-denied', 'Invalid audio path.');
    }

    const file = bucket().file(storagePath);

    try {
      // Single round trip: download straight away (a missing object throws and
      // we fall through to '' below). The Storage write rule already caps size
      // at 5MB; we re-check the buffer length as defence-in-depth.
      const [bytes] = await file.download();
      if (bytes.length > MAX_AUDIO_BYTES) {
        return {transcript: ''};
      }
      let transcript = '';
      try {
        transcript = await transcribe(bytes, 'audio/mp4');
      } catch {
        transcript = '';
      }
      return {transcript};
    } catch {
      return {transcript: ''};
    } finally {
      // Always clean up the temp upload, success or not.
      void file.delete().catch(() => undefined);
    }
  },
);
