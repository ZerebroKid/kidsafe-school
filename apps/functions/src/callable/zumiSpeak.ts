/**
 * Zumi text-to-speech proxy. The child app sends a line of Zumi's dialogue and
 * gets back a playable audio URL synthesized by ElevenLabs (the API key stays
 * server-side, see `lib/elevenLabs.ts` + `lib/ttsCache.ts`).
 *
 * Since `zumiTeach`/`zumiConverse` now return `audioUrl` inline, this callable
 * is mainly used for PREFETCHING scripted lines (quiz questions) and as a
 * fallback path. The cache lives in `lib/ttsCache.ts`, shared with those
 * callables.
 *
 * Auth: signed-in child. On any synthesis failure this throws, and the client
 * falls back to on-device TTS so the session never gets stuck.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {requireAuth, requireRole} from '../lib/auth';
import {elevenLabsApiKey, MAX_TTS_CHARS} from '../lib/elevenLabs';
import {stepLogger} from '../lib/perf';
import {getTtsUrl} from '../lib/ttsCache';

export interface ZumiSpeakInput {
  text: string;
}

export interface ZumiSpeakOutput {
  url: string;
}

export const zumiSpeak = onCall<ZumiSpeakInput, Promise<ZumiSpeakOutput>>(
  {region: 'asia-south1', minInstances: 1, secrets: [elevenLabsApiKey]},
  async request => {
    const log = stepLogger('zumiSpeak');
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'child');

    const rawText = request.data?.text;
    const text =
      typeof rawText === 'string' ? rawText.trim().slice(0, MAX_TTS_CHARS) : '';
    if (text.length === 0) {
      throw new HttpsError('invalid-argument', 'text is required.');
    }

    log.start({textChars: text.length, textPreview: text.slice(0, 80)});

    try {
      const url = await getTtsUrl(text, log);
      log.end({url: url.slice(0, 100)});
      return {url};
    } catch (err) {
      log.fail(err);
      throw new HttpsError(
        'internal',
        err instanceof Error ? err.message : 'Zumi voice synthesis failed.',
      );
    }
  },
);
