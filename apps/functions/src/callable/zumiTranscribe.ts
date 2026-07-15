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
import {stepLogger} from '../lib/perf';

export interface ZumiTranscribeInput {
  /** Storage path (legacy path: upload first, then transcribe). */
  storagePath?: string;
  /** Base64-encoded audio bytes (fast path: skip Storage entirely). */
  audioBase64?: string;
  /** MIME type of the audio (default audio/mp4). */
  mimeType?: string;
}

export interface ZumiTranscribeOutput {
  transcript: string;
}

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const zumiTranscribe = onCall<
  ZumiTranscribeInput,
  Promise<ZumiTranscribeOutput>
>(
  {region: 'asia-south1', minInstances: 0, secrets: [elevenLabsApiKey]},
  async request => {
    const log = stepLogger('zumiTranscribe');
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const {storagePath, audioBase64, mimeType} = request.data ?? {};
    const mime = typeof mimeType === 'string' ? mimeType : 'audio/mp4';

    // Fast path: audio sent inline as base64 (no Storage round trip).
    if (typeof audioBase64 === 'string' && audioBase64.length > 0) {
      const bytes = Buffer.from(audioBase64, 'base64');
      log.start({path: 'inline-base64', audioBytes: bytes.length, mime});
      if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) {
        log.end({transcript: '(rejected: bad size)'});
        return {transcript: ''};
      }
      try {
        const transcript = await log.step(
          'elevenlabs.transcribe',
          () => transcribe(bytes, mime),
          t => `"${t.slice(0, 80)}"`,
        );
        log.end({transcriptChars: transcript.length});
        return {transcript};
      } catch (err) {
        log.fail(err);
        return {transcript: ''};
      }
    }

    // Legacy path: download from Storage, transcribe, then clean up.
    log.start({path: 'storage', storagePath: storagePath ?? '(missing)'});
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
      const [bytes] = await log.step(
        'storage.download',
        () => file.download(),
        ([b]) => `${b.length} bytes`,
      );
      if (bytes.length > MAX_AUDIO_BYTES) {
        log.end({transcript: '(rejected: too large)'});
        return {transcript: ''};
      }
      try {
        const transcript = await log.step(
          'elevenlabs.transcribe',
          () => transcribe(bytes, 'audio/mp4'),
          t => `"${t.slice(0, 80)}"`,
        );
        log.end({transcriptChars: transcript.length});
        return {transcript};
      } catch (err) {
        log.fail(err);
        return {transcript: ''};
      }
    } catch (err) {
      log.fail(err);
      return {transcript: ''};
    } finally {
      void file.delete().catch(() => undefined);
    }
  },
);
