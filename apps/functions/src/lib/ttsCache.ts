/**
 * Shared ElevenLabs TTS + Firebase Storage cache.
 *
 * Extracted from `zumiSpeak` so the AI callables (`zumiTeach`, `zumiConverse`)
 * can synthesize their reply server-side in the SAME request and return a
 * ready-to-play `audioUrl` alongside the text. That collapses the client's
 * two round trips per turn (AI call + TTS call) into one — the single biggest
 * latency win in the Zumi loop.
 *
 * Results are cached in Storage keyed by sha256(voice|model|speed|text), so a
 * repeated line is synthesized at most once. The returned URL is a Firebase
 * Storage download-token URL that `react-native-sound` can stream directly.
 */

import {createHash, randomUUID} from 'crypto';

import {bucket} from './admin';
import {
  elevenLabsVoiceId,
  synthesize,
  ttsCacheKey,
  MAX_TTS_CHARS,
  TTS_CONTENT_TYPE,
} from './elevenLabs';
import type {StepLogger} from './perf';

function downloadUrl(bucketName: string, path: string, token: string): string {
  const encoded = encodeURIComponent(path);
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}` +
    `?alt=media&token=${token}`
  );
}

/**
 * After a quota/billing failure, ElevenLabs will keep failing for every synth
 * until the account is topped up — don't burn a round trip per line. This
 * per-instance cooldown skips synthesis attempts for a while (cache HITS still
 * work: they never touch ElevenLabs).
 */
const SYNTH_COOLDOWN_MS = 5 * 60_000;
let synthDisabledUntil = 0;

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /quota_exceeded|payment_required|paid_plan_required|401|402/.test(msg);
}

/**
 * Return a playable download URL for `text` — from the Storage cache when
 * possible, otherwise synthesized via ElevenLabs and saved. THROWS on any
 * failure; use `tryGetTtsUrl` when the caller wants a soft failure.
 */
export async function getTtsUrl(text: string, log?: StepLogger): Promise<string> {
  const clean = (text ?? '').trim().slice(0, MAX_TTS_CHARS);
  if (clean.length === 0) {
    throw new Error('No text to synthesize.');
  }

  const hash = createHash('sha256').update(ttsCacheKey(clean)).digest('hex');
  const path = `zumi_tts/${hash}.mp3`;
  const b = bucket();
  const file = b.file(path);

  // Cache hit? Probe metadata directly (one round trip). A 404 throws and we
  // treat it as a miss, rather than paying a separate exists() call.
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
    log?.info(`tts cache HIT (${clean.length} chars)`);
    if (cachedToken) {
      return downloadUrl(b.name, path, cachedToken.split(',')[0]);
    }
    // Cached audio but no token (e.g. uploaded out-of-band): mint one.
    const token = randomUUID();
    await file.setMetadata({
      metadata: {firebaseStorageDownloadTokens: token},
    });
    return downloadUrl(b.name, path, token);
  }

  if (Date.now() < synthDisabledUntil) {
    log?.info('tts synth SKIPPED (quota cooldown active)');
    throw new Error('TTS synthesis in cooldown after quota failure.');
  }

  log?.info(`tts cache MISS (${clean.length} chars) — synthesizing`);
  let audio: Buffer;
  try {
    audio = log
      ? await log.step(
          'elevenlabs.synthesize',
          () => synthesize(clean),
          buf => `${buf.length} bytes`,
        )
      : await synthesize(clean);
  } catch (err) {
    if (isQuotaError(err)) {
      synthDisabledUntil = Date.now() + SYNTH_COOLDOWN_MS;
      log?.info(
        `ELEVENLABS QUOTA/BILLING FAILURE — pausing synth for ${SYNTH_COOLDOWN_MS / 60000}min. ` +
          'Top up credits or upgrade the plan to restore the cloud voice.',
      );
    }
    throw err;
  }

  const token = randomUUID();
  const save = async () =>
    file.save(audio, {
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
  if (log) await log.step('storage.save', save);
  else await save();

  return downloadUrl(b.name, path, token);
}

/**
 * Like `getTtsUrl` but never throws — returns `undefined` on any failure so
 * the AI callables can still return their text and let the client fall back
 * to its own TTS path.
 */
export async function tryGetTtsUrl(
  text: string,
  log?: StepLogger,
): Promise<string | undefined> {
  try {
    return await getTtsUrl(text, log);
  } catch (err) {
    log?.info(
      `tts synth failed (client will fall back): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return undefined;
  }
}
