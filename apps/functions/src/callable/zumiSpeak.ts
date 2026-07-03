/**
 * Zumi text-to-speech proxy. The child app sends a line of Zumi's dialogue and
 * gets back a playable audio URL synthesized by OpenAI TTS (the API key stays
 * server-side, see `lib/openaiVoice.ts`).
 *
 * Results are cached in Storage keyed by sha256(voice + model + speed + text),
 * so a repeated line (and every static story script) is synthesized at most
 * once -- this caps OpenAI TTS cost and makes repeat playback instant.
 *
 * The returned URL is a Firebase Storage download-token URL (publicly fetchable
 * with the token), which `react-native-sound` can stream directly without any
 * Storage read rule.
 *
 * Auth: signed-in child. On any synthesis failure this throws, and the client
 * falls back to on-device TTS so the session never gets stuck.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAuth, requireRole } from '../lib/auth';
import { synthesizeInline, MAX_TTS_CHARS } from '../lib/elevenLabs';

export interface ZumiSpeakInput {
  text: string;
}

export interface ZumiSpeakOutput {
  url: string;
  audioBase64: string;
}

export const zumiSpeak = onCall<ZumiSpeakInput, Promise<ZumiSpeakOutput>>(
  { region: 'asia-south1', minInstances: 1 },
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const rawText = request.data?.text;
    const text =
      typeof rawText === 'string' ? rawText.trim().slice(0, MAX_TTS_CHARS) : '';
    if (text.length === 0) {
      throw new HttpsError('invalid-argument', 'text is required.');
    }

    try {
      const { audioBase64 } = await synthesizeInline(text);
      if (!audioBase64) {
        throw new Error('TTS synthesis failed to produce audio.');
      }
      return { url: '', audioBase64 };
    } catch (err) {
      throw new HttpsError(
        'internal',
        err instanceof Error ? err.message : 'Zumi voice synthesis failed.',
      );
    }
  },
);