/**
 * ElevenLabs proxy -- the ONLY place the ElevenLabs API key is used.
 *
 * The child app never holds the key; it calls the `zumiSpeak` (TTS) and
 * `zumiTranscribe` (STT) callables, which call into here. The key is injected
 * at runtime via `defineSecret('ELEVENLABS_API_KEY')` (same pattern as the
 * Gemini key in `zumiAi.ts`) so it never lives in source or the client bundle.
 *
 * Two operations:
 *   - `synthesize(text)`  -> mp3 audio Buffer, using the low-latency Flash v2.5
 *     model (supports Hindi/Hinglish). The caller caches the result in Storage.
 *   - `transcribe(buffer)` -> a plain-text transcript via Scribe v2.
 *
 * PRIVACY NOTE: this sends Zumi's spoken text and the child's recorded audio to
 * ElevenLabs. For production with real children, review ElevenLabs' data/zero-
 * retention options. STT temp uploads are deleted right after transcription.
 *
 * Resilience: requests are wrapped in an AbortController timeout. TTS retries
 * once (idempotent); STT does not (the audio upload is one-shot). Callers decide
 * the fallback (Zumi falls back to on-device TTS / treats '' as "no answer").
 */

import {defineSecret} from 'firebase-functions/params';
import {defineString} from 'firebase-functions/params';

/** ElevenLabs API key. Set once: `firebase functions:secrets:set ELEVENLABS_API_KEY`. */
export const elevenLabsApiKey = defineSecret('ELEVENLABS_API_KEY');

/**
 * Voice id. Defaults to "Sarah" (warm, friendly). Override without a code
 * change via the `ELEVENLABS_VOICE_ID` env/param -- e.g. an Indian-accent voice
 * from the ElevenLabs Voice Library for a more authentic Hinglish feel. A few
 * good options: Sarah `EXAVITQu4vr4xnSDxMaL`, Rachel `21m00Tcm4TlvDq8ikWAM`,
 * Jessica `cgSgspJ2msm6clMCkdW9`, Lily `pFZP5JQG7iQjIQuC4Bku`.
 */
export const elevenLabsVoiceId = defineString('ELEVENLABS_VOICE_ID', {
  default: 'RxWGQqmx8sKzknGaIdmb',
});

/**
 * Speaking speed (ElevenLabs `voice_settings.speed`, range 0.7-1.2). Default
 * 0.88 = a little slower than natural so a child can follow each word. Tunable
 * via the `ELEVENLABS_VOICE_SPEED` env/param without a code change.
 */
export const elevenLabsVoiceSpeed = defineString('ELEVENLABS_VOICE_SPEED', {
  default: '0.88',
});

function resolveSpeed(): number {
  const raw = Number.parseFloat(elevenLabsVoiceSpeed.value());
  if (!Number.isFinite(raw)) return 0.88;
  // Clamp to ElevenLabs' supported window.
  return Math.min(1.2, Math.max(0.7, raw));
}

const API_BASE = 'https://api.elevenlabs.io/v1';
// Flash v2.5: ~75ms server latency, 32 languages incl. Hindi. Best for the
// near-real-time Zumi loop. Swap to `eleven_multilingual_v2` for max quality.
const TTS_MODEL = 'eleven_flash_v2_5';
const TTS_OUTPUT_FORMAT = 'mp3_44100_64';
const STT_MODEL = 'scribe_v2';
const TTS_TIMEOUT_MS = 15_000;
const STT_TIMEOUT_MS = 20_000;
/** Hard cap so a runaway prompt can't rack up TTS characters. */
export const MAX_TTS_CHARS = 800;

export const TTS_CONTENT_TYPE = 'audio/mpeg';

/** A stable cache key input for a given spoken line + voice + model + speed. */
export function ttsCacheKey(text: string): string {
  return `${elevenLabsVoiceId.value()}|${TTS_MODEL}|${TTS_OUTPUT_FORMAT}|${resolveSpeed()}|${text}`;
}

/**
 * Synthesize `text` to an mp3 Buffer. Throws on non-2xx / network / timeout
 * after a single retry.
 */
export async function synthesize(text: string): Promise<Buffer> {
  const apiKey = elevenLabsApiKey.value();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY secret is not configured.');
  }
  const clean = (text ?? '').trim().slice(0, MAX_TTS_CHARS);
  if (clean.length === 0) {
    throw new Error('No text to synthesize.');
  }

  const url =
    `${API_BASE}/text-to-speech/${encodeURIComponent(elevenLabsVoiceId.value())}` +
    `?output_format=${TTS_OUTPUT_FORMAT}`;
  const body = JSON.stringify({
    text: clean,
    model_id: TTS_MODEL,
    voice_settings: {
      // Higher stability + low style = a calm, steady, consistent read (less
      // dramatic swings), which is easier for a child to follow.
      stability: 0.6,
      similarity_boost: 0.85,
      style: 0.0,
      use_speaker_boost: true,
      speed: resolveSpeed(),
    },
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
          accept: TTS_CONTENT_TYPE,
        },
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(
          `ElevenLabs TTS ${res.status}: ${errText.slice(0, 200)}`,
        );
      }
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('ElevenLabs TTS failed.');
}

interface ScribeResponse {
  text?: string;
  language_code?: string;
}

/**
 * Transcribe an audio Buffer to text via Scribe v2. Throws on non-2xx /
 * network / timeout (the caller treats a thrown error as "no answer").
 */
export async function transcribe(
  audio: Buffer,
  mimeType = 'audio/mp4',
): Promise<string> {
  const apiKey = elevenLabsApiKey.value();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY secret is not configured.');
  }
  if (!audio || audio.length === 0) {
    throw new Error('No audio to transcribe.');
  }

  // Build the multipart/form-data body by hand. The `lib: ES2022` (no DOM)
  // tsconfig makes the global FormData/Blob types awkward to use with a Node
  // Buffer, so a hand-rolled body keeps this fully type-safe and dependency-free.
  const boundary = `----zumiSTT${Date.now().toString(16)}`;
  const fileName = `audio.${extForMime(mimeType)}`;
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model_id"\r\n\r\n` +
    `${STT_MODEL}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const multipartBody = Buffer.concat([
    Buffer.from(head, 'utf8'),
    audio,
    Buffer.from(tail, 'utf8'),
  ]);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: new Uint8Array(multipartBody),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`ElevenLabs STT ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as ScribeResponse;
    return (data.text ?? '').trim();
  } finally {
    clearTimeout(timer);
  }
}

function extForMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) {
    return 'm4a';
  }
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  return 'm4a';
}
