/**
 * OpenAI voice proxy -- the ONLY place TTS/STT calls happen.
 *
 * Replaces the previous ElevenLabs-based proxy (`elevenLabs.ts`). Uses the
 * SAME OpenAI account/key as the LLM (`lib/zumiAi.ts`), read straight from
 * `process.env.OPENAI_API_KEY`. With Firebase Functions v2, a `.env` file
 * placed in the functions project root is loaded into `process.env`
 * automatically on deploy AND in the emulator -- no `defineSecret` /
 * `defineString` / Secret Manager binding needed. See `.env.example`.
 *
 * Two operations:
 *   - `synthesize(text)`  -> mp3 audio Buffer via OpenAI TTS
 *     (`gpt-4o-mini-tts` by default). The caller caches the result in Storage.
 *   - `transcribe(buffer)` -> a plain-text transcript via OpenAI STT
 *     (`gpt-4o-mini-transcribe` by default).
 *
 * PRIVACY NOTE: this sends Zumi's spoken text and the child's recorded audio
 * to OpenAI. For production with real children, review OpenAI's API data
 * retention / zero-retention options.
 *
 * Resilience: the OpenAI SDK client has its own timeout + one retry baked in
 * (see `client()` below). Callers decide the fallback (Zumi falls back to
 * on-device TTS / treats '' as "no answer").
 */

import { createHash, randomUUID } from 'crypto';
import OpenAI, { toFile } from 'openai';
import { bucket } from './admin';

const REQUEST_TIMEOUT_MS = 20_000;

/** Lazy OpenAI client, shared shape with `lib/zumiAi.ts`. */
let clientSingleton: OpenAI | null = null;
function client(): OpenAI {
  if (clientSingleton) return clientSingleton;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Check your .env file.');
  }
  clientSingleton = new OpenAI({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
  return clientSingleton;
}

/**
 * TTS voice. One of: alloy, ash, ballad, coral, echo, fable, onyx, nova,
 * sage, shimmer, verse. Override via `OPENAI_TTS_VOICE` in .env -- "shimmer"
 * is a warm, friendly default close in spirit to the old ElevenLabs choice.
 */
function ttsVoice(): string {
  return process.env.OPENAI_TTS_VOICE || 'shimmer';
}

/** TTS model. `gpt-4o-mini-tts` is fast, low-cost, and instructable. */
function ttsModel(): string {
  return process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
}

/** STT model. `gpt-4o-mini-transcribe` is fast and low-cost; `whisper-1` also works. */
function sttModel(): string {
  return process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';
}

/**
 * Speaking speed, OpenAI TTS range 0.25-4.0. Default 0.9 = a touch slower
 * than natural so a child can follow each word. Tunable via
 * `OPENAI_TTS_SPEED` in .env without a code change.
 */
function resolveSpeed(): number {
  const raw = Number.parseFloat(process.env.OPENAI_TTS_SPEED ?? '');
  if (!Number.isFinite(raw)) return 0.9;
  return Math.min(4.0, Math.max(0.25, raw));
}

export const TTS_CONTENT_TYPE = 'audio/mpeg';
/** Hard cap so a runaway prompt can't rack up TTS characters. */
export const MAX_TTS_CHARS = 800;

/** A stable cache key input for a given spoken line + voice + model + speed. */
export function ttsCacheKey(text: string): string {
  return `${ttsVoice()}|${ttsModel()}|${resolveSpeed()}|${text}`;
}

/**
 * Synthesize `text` to an mp3 Buffer. Throws on failure (network, timeout,
 * non-2xx) -- the SDK already retries once internally.
 */
export async function synthesize(text: string): Promise<Buffer> {
  const clean = (text ?? '').trim().slice(0, MAX_TTS_CHARS);
  if (clean.length === 0) {
    throw new Error('No text to synthesize.');
  }

  const res = await client().audio.speech.create({
    model: ttsModel(),
    voice: ttsVoice() as OpenAI.Audio.Speech.SpeechCreateParams['voice'],
    input: clean,
    response_format: 'mp3',
    speed: resolveSpeed(),
  });
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Synthesize `text` to an mp3 and return it as inline base64 -- NO Storage
 * upload. This eliminates the ~2.5s Storage round-trip per turn. For a 2-3
 * sentence Hinglish line the MP3 is ~50-150 KB, well within callable limits.
 */
export async function synthesizeInline(text: string): Promise<{
  audioBase64: string;
  contentType: string;
}> {
  const audio = await synthesize(text);
  return {
    audioBase64: audio.toString('base64'),
    contentType: TTS_CONTENT_TYPE,
  };
}

/**
 * Transcribe an audio Buffer to text via OpenAI STT. Throws on failure (the
 * caller treats a thrown error as "no answer").
 */
export async function transcribe(
  audio: Buffer,
  mimeType = 'audio/mp4',
): Promise<string> {
  console.log('[elevenLabs/transcribe] called', { bufferSize: audio?.length ?? 0, mimeType });
  if (!audio || audio.length === 0) {
    throw new Error('No audio to transcribe.');
  }

  const file = await toFile(audio, `audio.${extForMime(mimeType)}`, {
    type: mimeType,
  });

  const res = await client().audio.transcriptions.create({
    model: sttModel(),
    file,
  });
  const text = (res.text ?? '').trim();
  console.log('[elevenLabs/transcribe] result', { textLen: text.length, preview: text.slice(0, 80) });
  return text;
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

function downloadUrl(bucketName: string, path: string, token: string): string {
  const encoded = encodeURIComponent(path);
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}` +
    `?alt=media&token=${token}`
  );
}

/**
 * Server-side unified helper to get cached TTS URL or generate a new one.
 * Reduces round trips by resolving TTS directly during AI text generation.
 */
export async function getOrGenerateTtsUrl(text: string): Promise<string> {
  const clean = (text ?? '').trim().slice(0, MAX_TTS_CHARS);
  if (clean.length === 0) return '';

  const hash = createHash('sha256').update(ttsCacheKey(clean)).digest('hex');
  const path = `zumi_tts/${hash}.mp3`;
  const b = bucket();
  const file = b.file(path);

  try {
    // Cache hit? Probe metadata.
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
        return downloadUrl(b.name, path, cachedToken.split(',')[0]);
      }
      const token = randomUUID();
      await file.setMetadata({
        metadata: { firebaseStorageDownloadTokens: token },
      });
      return downloadUrl(b.name, path, token);
    }

    // Cache miss: synthesize new audio.
    const audio = await synthesize(clean);
    const token = randomUUID();
    await file.save(audio, {
      resumable: false,
      contentType: TTS_CONTENT_TYPE,
      metadata: {
        contentType: TTS_CONTENT_TYPE,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          firebaseStorageDownloadTokens: token,
          voiceId: ttsVoice(),
        },
      },
    });
    return downloadUrl(b.name, path, token);
  } catch (err) {
    console.error('[getOrGenerateTtsUrl] Failed to get or generate TTS:', err);
    return '';
  }
}