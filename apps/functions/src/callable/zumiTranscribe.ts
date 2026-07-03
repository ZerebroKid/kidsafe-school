/**
 * Zumi speech-to-text proxy. The child app records an answer, uploads it to
 * `zumi_stt/{uid}/{file}` in Storage, then calls this with the path. We download
 * the bytes, transcribe via OpenAI STT (key stays server-side), delete
 * the temp upload, and return the transcript.
 *
 * Auth: signed-in child. The path MUST live under the caller's own
 * `zumi_stt/{uid}/` prefix so one child can't transcribe another's audio.
 *
 * Never throws on a transcription hiccup -- returns `{transcript: ''}` so the
 * session treats it as "no answer" and lets the child retry / skip.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAuth, requireRole } from '../lib/auth';
import { bucket } from '../lib/admin';
import { transcribe } from '../lib/elevenLabs';

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
  { region: 'asia-south1', minInstances: 1 },
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const { storagePath, audioBase64, mimeType } = request.data ?? {};
    const mime = typeof mimeType === 'string' ? mimeType : 'audio/mp4';

    console.log('[zumiTranscribe] called', {
      uid: caller.uid,
      hasBase64: typeof audioBase64 === 'string',
      base64Len: typeof audioBase64 === 'string' ? audioBase64.length : 0,
      storagePath: storagePath ?? '(none)',
      mime,
    });

    // Fast path: audio sent inline as base64 (no Storage round trip).
    if (typeof audioBase64 === 'string' && audioBase64.length > 0) {
      const bytes = Buffer.from(audioBase64, 'base64');
      if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) {
        return { transcript: '' };
      }
      try {
        const transcript = await transcribe(bytes, mime);
        console.log('[zumiTranscribe] STT success', { transcriptLen: transcript.length, preview: transcript.slice(0, 80) });
        return { transcript };
      } catch (err) {
        console.error('[zumiTranscribe] STT failed:', err instanceof Error ? err.message : err);
        return { transcript: '' };
      }
    }

    // Legacy path: download from Storage, transcribe, then clean up.
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
      const [bytes] = await file.download();
      if (bytes.length > MAX_AUDIO_BYTES) {
        return { transcript: '' };
      }
      try {
        const transcript = await transcribe(bytes, 'audio/mp4');
        return { transcript };
      } catch {
        return { transcript: '' };
      }
    } catch {
      return { transcript: '' };
    } finally {
      void file.delete().catch(() => undefined);
    }
  },
);