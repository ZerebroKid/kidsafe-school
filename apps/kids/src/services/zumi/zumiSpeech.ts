/**
 * Speech I/O for Zumi.
 *
 * Primary path is ElevenLabs via Cloud Function proxies (natural voice + reliable
 * cloud recognition, device-independent):
 *   - `speak`  -> `zumiSpeak` synthesizes the line, we stream the audio URL. If
 *     the cloud call fails we fall back to on-device TTS so a line is never lost.
 *   - record   -> `startRecording()` captures the child's answer to a file;
 *     `stopRecordingAndTranscribe()` uploads it and returns the ElevenLabs
 *     transcript (or '' on any failure, which the session treats as "no answer").
 *
 * Everything is defensive -- nothing here throws into the session flow.
 */

import {Platform} from 'react-native';
import Tts from 'react-native-tts';
import Sound from 'react-native-sound';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
  type AudioSet,
} from 'react-native-audio-recorder-player';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  type PermissionStatus,
} from 'react-native-permissions';

import {zumiSpeak, zumiTranscribe} from './zumiApi';

/**
 * The Zumi scripts are Latin-script Hinglish ("Ek baar mere ek dost ne bola..."),
 * so the on-device TTS fallback uses an Indian-English voice (reads them
 * naturally). Cloud TTS/STT handle Hinglish directly via ElevenLabs.
 */
const TTS_SPEAK_LANG = 'en-IN';
/** Raw Android engine values (skipTransform). 1.0 = normal speed / pitch. */
const TTS_RATE = 0.9;
const TTS_PITCH = 1.05;
/** Per-chunk ceiling so a missing `tts-finish` event can't hang the session. */
const SPEAK_SAFETY_MS = 20_000;
/** Natural pause inserted between spoken sentences. */
const INTER_SENTENCE_MS = 150;
/** Long chunks above this get a secondary split so the engine never truncates. */
const MAX_CHUNK_CHARS = 180;
/** Readable on-screen dwell when there's no usable TTS engine. */
const READABLE_MS_PER_CHAR = 55;
const READABLE_MIN_MS = 1_800;
const READABLE_MAX_MS = 9_000;

let configured = false;
/**
 * Whether a usable TTS engine reported ready via `getInitStatus`. Many Android
 * OEM builds ship without a working engine; when false we skip TTS entirely and
 * fall back to a readable bubble dwell so the session still flows.
 */
let ttsReady = false;

interface TtsVoice {
  id: string;
  name?: string;
  language: string;
  quality?: number;
  latency?: number;
  networkConnectionRequired?: boolean;
  notInstalled?: boolean;
}

/** Clamp a readable dwell duration based on text length. */
function readableMs(text: string): number {
  const raw = text.length * READABLE_MS_PER_CHAR;
  return Math.min(READABLE_MAX_MS, Math.max(READABLE_MIN_MS, raw));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Pick the best installed voice for our spoken language and apply it. Prefers
 * `en-IN`, then any `en-*`, then `hi-*`; within a tier prefers installed,
 * on-device (no network), higher quality. Best-effort -- never throws.
 */
async function selectBestVoice(): Promise<void> {
  let voices: TtsVoice[] = [];
  try {
    voices = (await Tts.voices()) as unknown as TtsVoice[];
  } catch {
    return;
  }
  if (!Array.isArray(voices) || voices.length === 0) return;

  const usable = voices.filter(v => v && v.language && !v.notInstalled);
  const rank = (v: TtsVoice): number => {
    const lang = v.language.toLowerCase().replace('_', '-');
    let score = 0;
    if (lang === 'en-in') score += 300;
    else if (lang.startsWith('en')) score += 200;
    else if (lang.startsWith('hi')) score += 100;
    if (!v.networkConnectionRequired) score += 20;
    score += Math.min(20, Math.max(0, (v.quality ?? 0) / 100));
    return score;
  };

  const best = usable
    .filter(v => rank(v) >= 100)
    .sort((a, b) => rank(b) - rank(a))[0];
  if (!best) return;

  try {
    await Tts.setDefaultLanguage(best.language);
  } catch {
    // ignore -- voice set below still applies
  }
  try {
    await Tts.setDefaultVoice(best.id);
  } catch {
    // some engines reject setDefaultVoice -> language alone is fine
  }
}

/** One-time TTS + Sound setup. Safe to call repeatedly. */
export async function configureSpeech(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    Sound.setCategory('Playback');
  } catch {
    // non-fatal
  }
  // Confirm a usable engine exists before relying on TTS events. On Android an
  // engine-less device rejects here; we then degrade to the readable fallback.
  try {
    await Tts.getInitStatus();
    ttsReady = true;
  } catch {
    ttsReady = false;
  }
  try {
    await Tts.setDefaultLanguage(TTS_SPEAK_LANG);
  } catch {
    // language not installed -> default voice still speaks
  }
  await selectBestVoice();
  try {
    await Tts.setDefaultRate(TTS_RATE, true);
    await Tts.setDefaultPitch(TTS_PITCH);
  } catch {
    // ignore -- defaults are fine
  }
}

/**
 * Break text into speakable chunks: sentence-sized where possible, and never
 * longer than MAX_CHUNK_CHARS (long chunks are re-split on commas/dashes). This
 * gives natural prosody and sidesteps engine truncation of long utterances.
 */
function splitIntoSentences(text: string): string[] {
  const bySentence = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.?!।])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const sentence of bySentence) {
    if (sentence.length <= MAX_CHUNK_CHARS) {
      out.push(sentence);
      continue;
    }
    // Secondary split for very long sentences (e.g. comma-separated lists).
    let buffer = '';
    const parts = sentence.split(/(?<=[,—–-])\s+/);
    for (const part of parts) {
      if ((buffer + ' ' + part).trim().length > MAX_CHUNK_CHARS && buffer) {
        out.push(buffer.trim());
        buffer = part;
      } else {
        buffer = buffer ? `${buffer} ${part}` : part;
      }
    }
    if (buffer.trim()) out.push(buffer.trim());
  }
  return out;
}

/** Speak a single chunk, resolving only when ITS utterance finishes. */
function speakChunk(chunk: string): Promise<void> {
  return new Promise<void>(resolve => {
    let settled = false;
    let utteranceId: string | null = null;
    type Sub = {remove: () => void};
    const subs: Sub[] = [];

    const cleanup = () => {
      try {
        for (const s of subs) s.remove?.();
      } catch {
        // ignore
      }
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve();
    };
    // Only end the wait when the event belongs to THIS utterance. Stale
    // finish events from a prior chunk would otherwise cut this line short.
    const onFinish = (evt: unknown) => {
      const evtId = (evt as {utteranceId?: string} | undefined)?.utteranceId;
      if (utteranceId && evtId && evtId !== utteranceId) return;
      finish();
    };

    const timer = setTimeout(finish, SPEAK_SAFETY_MS);

    try {
      // Method calls keep `this` bound to the Tts emitter instance.
      subs.push(Tts.addEventListener('tts-finish', onFinish) as unknown as Sub);
      subs.push(Tts.addEventListener('tts-cancel', finish) as unknown as Sub);
      subs.push(Tts.addEventListener('tts-error', finish) as unknown as Sub);
    } catch {
      // Registration failed -> safety timer still resolves us.
    }

    try {
      // Android resolves with the generated utteranceId.
      Promise.resolve(Tts.speak(chunk) as unknown as Promise<string>)
        .then(id => {
          if (typeof id === 'string') utteranceId = id;
        })
        .catch(() => finish());
    } catch {
      finish();
    }
  });
}

/**
 * Speak `text`. Prefers the natural ElevenLabs cloud voice (synthesized +
 * streamed); on any cloud/playback failure falls back to on-device TTS so a
 * line is never silently dropped. Resolves when narration finishes.
 */
export async function speak(text: string): Promise<void> {
  const clean = (text ?? '').trim();
  if (clean.length === 0) return;

  // Snapshot the playback generation: if stopSpeaking() runs while we await the
  // synthesis below, the generation changes and we must NOT start any audio.
  const gen = playbackGeneration;
  const url = await resolveTtsUrl(clean);
  if (gen !== playbackGeneration) return;
  if (url) {
    try {
      await playUrl(url);
      return;
    } catch {
      // A stale/expired URL -> drop it and fall back to on-device TTS.
      ttsUrlCache.delete(clean);
    }
  }
  if (gen !== playbackGeneration) return;
  await speakOnDevice(clean);
}

// ---------------------------------------------------------------------------
// Cloud TTS url cache + prefetch
// ---------------------------------------------------------------------------

/** Resolved playable URLs keyed by the exact spoken text (session-scoped). */
const ttsUrlCache = new Map<string, string>();
/** In-flight syntheses, so a prefetch + speak for the same line share one call. */
const ttsInflight = new Map<string, Promise<string>>();

/**
 * Return a playable URL for `clean`, reusing a cached/in-flight result so a
 * prefetched line incurs no synth wait. Returns '' on any failure (caller then
 * falls back to on-device TTS). Never rejects.
 */
async function resolveTtsUrl(clean: string): Promise<string> {
  const cached = ttsUrlCache.get(clean);
  if (cached) return cached;

  const pending = ttsInflight.get(clean);
  if (pending) return pending;

  const job = (async () => {
    try {
      const {url} = await zumiSpeak({text: clean});
      if (url) {
        ttsUrlCache.set(clean, url);
        return url;
      }
      return '';
    } catch {
      return '';
    } finally {
      ttsInflight.delete(clean);
    }
  })();
  ttsInflight.set(clean, job);
  return job;
}

/**
 * Warm the cloud voice for an upcoming line so it's ready (synthesized + cached
 * server-side) by the time we speak it. Fire-and-forget: never throws, and a
 * failed prefetch just means `speak()` synthesizes on demand later.
 */
export function prefetch(text: string): void {
  const clean = (text ?? '').trim();
  if (clean.length === 0) return;
  if (ttsUrlCache.has(clean) || ttsInflight.has(clean)) return;
  void resolveTtsUrl(clean);
}

/**
 * On-device TTS fallback: sentence-chunked with utterance-ID matching so long
 * lines aren't truncated. Used only when ElevenLabs is unreachable.
 */
async function speakOnDevice(clean: string): Promise<void> {
  // No usable engine -> keep the on-screen bubble up for a readable beat so the
  // child can read the line, then continue the session.
  if (!ttsReady) {
    await delay(readableMs(clean));
    return;
  }

  // Flush any stale narration once, then speak sentence-by-sentence so long
  // lines never get truncated and there are natural pauses between sentences.
  stopSpeaking();
  // Capture the generation AFTER the flush above so an abort mid-narration
  // (which bumps the generation) stops the remaining chunks.
  const gen = playbackGeneration;
  const chunks = splitIntoSentences(clean);
  for (let i = 0; i < chunks.length; i++) {
    if (gen !== playbackGeneration) return;
    await speakChunk(chunks[i]);
    if (i < chunks.length - 1) await delay(INTER_SENTENCE_MS);
  }
}

/**
 * The cloud TTS audio currently loaded/playing via react-native-sound. Tracked
 * so stopSpeaking() can halt it -- without this, aborting the session (leaving
 * the screen / backgrounding the app) only stopped on-device TTS while the
 * ElevenLabs clip kept playing to the end.
 */
let currentSound: Sound | null = null;
/**
 * Bumped on every stop. speak()/speakOnDevice() snapshot it and bail if it
 * changes, so audio whose synthesis finishes *after* an abort never starts.
 */
let playbackGeneration = 0;

/** Release a Sound, stopping playback first. Safe to call multiple times. */
function disposeSound(sound: Sound): void {
  try {
    sound.stop(() => {
      try {
        sound.release();
      } catch {
        // ignore
      }
    });
  } catch {
    try {
      sound.release();
    } catch {
      // ignore
    }
  }
}

/** Stop any in-progress narration immediately (cloud audio + on-device TTS). */
export function stopSpeaking(): void {
  playbackGeneration++;
  const sound = currentSound;
  currentSound = null;
  if (sound) disposeSound(sound);
  try {
    Tts.stop();
  } catch {
    // ignore
  }
}

/**
 * Play a pre-generated audio file (Firebase Storage https URL). Resolves on
 * completion; REJECTS on load/playback error so the caller can fall back to
 * on-device TTS. Registers the Sound as `currentSound` so stopSpeaking() can
 * halt it even mid-load.
 */
export function playUrl(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const gen = playbackGeneration;
    const sound = new Sound(url, '', error => {
      if (error) {
        if (currentSound === sound) currentSound = null;
        reject(error);
        return;
      }
      // Aborted while the clip was still loading -> don't start playback.
      if (gen !== playbackGeneration) {
        try {
          sound.release();
        } catch {
          // ignore
        }
        resolve();
        return;
      }
      currentSound = sound;
      sound.play(success => {
        if (currentSound === sound) currentSound = null;
        try {
          sound.release();
        } catch {
          // ignore
        }
        if (success) resolve();
        else reject(new Error('playback failed'));
      });
    });
  });
}

/** Ask for / confirm the microphone permission. Returns true if granted. */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    // iOS would use PERMISSIONS.IOS.MICROPHONE/SPEECH_RECOGNITION; ZKid is
    // Android-only today.
    return true;
  }
  const perm = PERMISSIONS.ANDROID.RECORD_AUDIO;
  try {
    let status: PermissionStatus = await check(perm);
    if (status === RESULTS.DENIED) {
      status = await request(perm);
    }
    return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Recording (ElevenLabs STT)
// ---------------------------------------------------------------------------

/** AAC-in-MP4 -- compact, widely supported, and accepted by ElevenLabs Scribe. */
const RECORDING_MIME = 'audio/mp4';
const RECORDING_EXT = 'm4a';
const RECORD_AUDIO_SET: AudioSet = {
  // VOICE_RECOGNITION favors the near-field human voice (less room noise).
  AudioSourceAndroid: AudioSourceAndroidType.VOICE_RECOGNITION,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AudioChannelsAndroid: 1,
  AudioSamplingRateAndroid: 16000,
};

/** Singleton recorder/player from react-native-audio-recorder-player. */
const recorderPlayer = new AudioRecorderPlayer();

let recording = false;

/**
 * Start capturing the child's answer to a local file. Returns false if the mic
 * permission is denied or the recorder fails to start (caller re-prompts).
 */
export async function startRecording(): Promise<boolean> {
  const granted = await ensureMicPermission();
  if (!granted) return false;
  // Defensive: clear any recorder left running by a previous aborted turn.
  if (recording) {
    await recorderPlayer.stopRecorder().catch(() => undefined);
    recording = false;
  }
  try {
    await recorderPlayer.startRecorder(undefined, RECORD_AUDIO_SET, false);
    recording = true;
    return true;
  } catch {
    recording = false;
    return false;
  }
}

/** True while a recording is in progress (so the UI can show a stop state). */
export function isRecording(): boolean {
  return recording;
}

/**
 * Stop recording, upload the clip to the caller's own `zumi_stt/{uid}/` path,
 * and return the ElevenLabs transcript. Returns `''` on any failure (no
 * recording, not signed in, upload/transcribe error) -- the session treats that
 * as "no answer" and lets the child retry or skip. Never rejects.
 */
export async function stopRecordingAndTranscribe(): Promise<string> {
  if (!recording) return '';
  recording = false;

  let path = '';
  try {
    path = await recorderPlayer.stopRecorder();
  } catch {
    return '';
  }
  if (!path) return '';

  const uid = auth().currentUser?.uid;
  if (!uid) return '';

  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const dest = `zumi_stt/${uid}/${unique}.${RECORDING_EXT}`;
  try {
    // Content type must match audio/* for the Storage write rule to allow it.
    await storage().ref(dest).putFile(path, {contentType: RECORDING_MIME});
  } catch {
    return '';
  }

  try {
    const {transcript} = await zumiTranscribe({storagePath: dest});
    return (transcript ?? '').trim();
  } catch {
    return '';
  }
}

/** Abort an in-progress recording without transcribing (e.g. on teardown). */
export async function cancelRecording(): Promise<void> {
  if (!recording) return;
  recording = false;
  await recorderPlayer.stopRecorder().catch(() => undefined);
}

/** Tear down all speech resources (call on screen unmount). */
export async function teardownSpeech(): Promise<void> {
  stopSpeaking();
  await cancelRecording();
}
