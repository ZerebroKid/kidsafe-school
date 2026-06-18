/**
 * Zumi text-to-speech proxy. The child app sends a line of Zumi's dialogue and
 * gets back a playable audio URL synthesized by ElevenLabs (the API key stays
 * server-side, see `lib/elevenLabs.ts`).
 *
 * Results are cached in Storage keyed by sha256(voice + model + text), so a
 * repeated line (and every static story script) is synthesized at most once --
 * this caps ElevenLabs cost and makes repeat playback instant.
 *
 * The returned URL is a Firebase Storage download-token URL (publicly fetchable
 * with the token), which `react-native-sound` can stream directly without any
 * Storage read rule.
 *
 * Auth: signed-in child. On any synthesis failure this throws, and the client
 * falls back to on-device TTS so the session never gets stuck.
 */

import {createHash, randomUUID} from 'crypto';

import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {requireAuth, requireRole} from '../lib/auth';
import {bucket} from '../lib/admin';
import {
  elevenLabsApiKey,
  elevenLabsVoiceId,
  synthesize,
  ttsCacheKey,
  MAX_TTS_CHARS,
  TTS_CONTENT_TYPE,
} from '../lib/elevenLabs';

export interface ZumiSpeakInput {
  text: string;
}

export interface ZumiSpeakOutput {
  url: string;
}

function downloadUrl(bucketName: string, path: string, token: string): string {
  const encoded = encodeURIComponent(path);
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}` +
    `?alt=media&token=${token}`
  );
}

export const zumiSpeak = onCall<ZumiSpeakInput, Promise<ZumiSpeakOutput>>(
  {region: 'asia-south1', minInstances: 1, secrets: [elevenLabsApiKey]},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const rawText = request.data?.text;
    const text =
      typeof rawText === 'string' ? rawText.trim().slice(0, MAX_TTS_CHARS) : '';
    if (text.length === 0) {
      throw new HttpsError('invalid-argument', 'text is required.');
    }

    const hash = createHash('sha256').update(ttsCacheKey(text)).digest('hex');
    const path = `zumi_tts/${hash}.mp3`;
    const b = bucket();
    const file = b.file(path);

    try {
      // Cache hit? Probe metadata directly (one round trip). A 404 throws and
      // we treat it as a miss, rather than paying a separate exists() call.
      let cachedToken: string | null = null;
      let cached = false;
      try {
        const [meta] = await file.getMetadata();
        cached = true;
        cachedToken =
          (meta.metadata?.firebaseStorageDownloadTokens as string | undefined) ??
          null;
      } catch {
        cached = false;
      }
      if (cached) {
        if (cachedToken) {
          return {url: downloadUrl(b.name, path, cachedToken.split(',')[0])};
        }
        // Cached audio but no token (e.g. uploaded out-of-band): mint one.
        const token = randomUUID();
        await file.setMetadata({
          metadata: {firebaseStorageDownloadTokens: token},
        });
        return {url: downloadUrl(b.name, path, token)};
      }

      const audio = await synthesize(text);
      const token = randomUUID();
      await file.save(audio, {
        resumable: false,
        contentType: TTS_CONTENT_TYPE,
        metadata: {
          contentType: TTS_CONTENT_TYPE,
          // Long-lived: keyed by content hash, so it never goes stale.
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: {
            firebaseStorageDownloadTokens: token,
            voiceId: elevenLabsVoiceId.value(),
          },
        },
      });
      return {url: downloadUrl(b.name, path, token)};
    } catch (err) {
      throw new HttpsError(
        'internal',
        err instanceof Error ? err.message : 'Zumi voice synthesis failed.',
      );
    }
  },
);
