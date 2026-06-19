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
import Voice, {
  type SpeechResultsEvent,
  type SpeechErrorEvent,
} from '@react-native-voice/voice';
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

  const gen = playbackGeneration;
  const url = await resolveTtsUrl(clean);
  if (gen !== playbackGeneration) return;
  if (url) {
    try {
      await playUrl(url);
      return;
    } catch {
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
 * Read the recorded audio file as base64 and send it directly to the Cloud
 * Function for transcription — skips the Firebase Storage upload + download
 * round trip that was adding ~6-7s of latency. Falls back to the legacy
 * Storage-based path if the local file read fails.
 */
async function uploadAndTranscribe(path: string): Promise<string> {
  if (!path) return '';
  const uid = auth().currentUser?.uid;
  if (!uid) return '';

  // Fast path: read file as base64 and send directly to the Cloud Function,
  // skipping the Firebase Storage upload + download round trip.
  try {
    const localUri = path.startsWith('file://') ? path : `file://${path}`;
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    const base64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (base64) {
      const {transcript} = await zumiTranscribe({
        audioBase64: base64,
        mimeType: RECORDING_MIME,
      });
      return (transcript ?? '').trim();
    }
  } catch {
    // base64 path failed — fall through to Storage upload.
  }

  // Legacy fallback: upload to Storage, then transcribe.
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const dest = `zumi_stt/${uid}/${unique}.${RECORDING_EXT}`;
  try {
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

/**
 * Start capturing the child's answer to a local file. Returns false if the mic
 * permission is denied or the recorder fails to start (caller re-prompts).
 * Used by the manual tap-to-talk fallback.
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
    await recorderPlayer.startRecorder(undefined, RECORD_AUDIO_SET, true);
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
 * Stop recording, upload the clip, and return the ElevenLabs transcript.
 * Returns `''` on any failure -- the session treats that as "no answer" and
 * lets the child retry or skip. Never rejects. (tap-to-talk fallback path).
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
  return uploadAndTranscribe(path);
}

/** Abort an in-progress recording without transcribing (e.g. on teardown). */
export async function cancelRecording(): Promise<void> {
  if (!recording) return;
  recording = false;
  await recorderPlayer.stopRecorder().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Hands-free listening
// ---------------------------------------------------------------------------
//
// Primary path: @react-native-voice/voice (Google on-device/cloud Speech API).
//   - Streaming results, silence detection handled by the OS — near-instant.
//   - Eliminates the 4s Storage upload + 22s ElevenLabs Scribe round trip.
//
// Fallback: record-to-file → upload → ElevenLabs Scribe (original path).
//   - Used only if Voice fails to start (missing engine, platform issue).
// ---------------------------------------------------------------------------

export type ListenStatus = 'ok' | 'no-speech' | 'error' | 'no-permission';

export interface ListenResult {
  transcript: string;
  status: ListenStatus;
}

export interface ListenOptions {
  /** Fired when we switch from recording to uploading/transcribing. */
  onPhase?: (phase: 'recording' | 'transcribing') => void;
  /** Fired on every metering tick with whether the child is currently audible. */
  onLevel?: (speaking: boolean) => void;
  /** Max listen time before auto-stopping (default 10 s). */
  maxMs?: number;
}

/** Transcription artefacts that aren't real child speech. */
const NOISE_TAGS = /^\[.*\]$|^\(.*\)$/;

/** Max time to wait for speech via Voice API. */
const VOICE_MAX_MS = 10_000;
/** Fallback recording max when Voice is unavailable. */
const FALLBACK_RECORD_MS = 5_000;
/** Silence after speech before auto-stopping fallback recording. */
const FALLBACK_SILENCE_MS = 1_800;
/** Min recording before silence detection kicks in. */
const FALLBACK_MIN_RECORD_MS = 2_000;
/** dB threshold for the fallback silence detector (generous). */
const FALLBACK_SILENCE_DB = -25;

/** Handle to the in-flight listen so the UI / abort can stop it early. */
let activeListen: {
  stop: () => void;
  cancel: () => void;
} | null = null;

/**
 * Hands-free turn: listen for the child's spoken answer and return the
 * transcript. Tries the fast on-device Voice path first; falls back to the
 * record → upload → ElevenLabs Scribe path if Voice is unavailable.
 */
export async function listen(opts: ListenOptions = {}): Promise<ListenResult> {
  const granted = await ensureMicPermission();
  if (!granted) return {transcript: '', status: 'no-permission'};

  const voiceResult = await listenVoice(opts);
  if (voiceResult !== null) return voiceResult;

  return listenRecorder(opts);
}

// ---- Primary: @react-native-voice/voice (fast, streaming) -----------------

async function listenVoice(opts: ListenOptions): Promise<ListenResult | null> {
  const maxMs = opts.maxMs ?? VOICE_MAX_MS;

  return new Promise<ListenResult | null>(resolve => {
    let settled = false;
    let bestTranscript = '';
    let speechStarted = false;

    const cleanup = () => {
      Voice.onSpeechResults = undefined as unknown as (e: SpeechResultsEvent) => void;
      Voice.onSpeechPartialResults = undefined as unknown as (e: SpeechResultsEvent) => void;
      Voice.onSpeechError = undefined as unknown as (e: SpeechErrorEvent) => void;
      Voice.onSpeechStart = undefined as unknown as () => void;
      Voice.onSpeechEnd = undefined as unknown as () => void;
      clearTimeout(timer);
      activeListen = null;
      Voice.stop().catch(() => undefined);
      Voice.destroy().catch(() => undefined);
    };

    const finish = (result: ListenResult | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    Voice.onSpeechStart = () => {
      speechStarted = true;
      opts.onLevel?.(true);
    };

    Voice.onSpeechEnd = () => {
      opts.onLevel?.(false);
      // Google's engine finished — deliver best result (final results may
      // arrive after onSpeechEnd via onSpeechResults, so give a brief grace).
      setTimeout(() => {
        if (!settled) {
          const text = bestTranscript.trim();
          if (text && !NOISE_TAGS.test(text)) {
            finish({transcript: text, status: 'ok'});
          } else {
            finish({transcript: '', status: 'no-speech'});
          }
        }
      }, 300);
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const results = e.value ?? [];
      if (results.length > 0 && results[0]) bestTranscript = results[0];
      opts.onLevel?.(false);
      // Final results — deliver immediately.
      const text = bestTranscript.trim();
      if (text && !NOISE_TAGS.test(text)) {
        finish({transcript: text, status: 'ok'});
      }
    };

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      const partial = e.value ?? [];
      if (partial.length > 0 && partial[0]) bestTranscript = partial[0];
      opts.onLevel?.(true);
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      const code = (e.error as {code?: string})?.code ?? '';
      // "5" = no speech detected; "6" = timeout; "7" = no match
      if (code === '5' || code === '7' || code === '6') {
        finish({transcript: '', status: 'no-speech'});
      } else {
        finish(null);
      }
    };

    const timer = setTimeout(() => {
      if (speechStarted && bestTranscript.trim()) {
        finish({transcript: bestTranscript.trim(), status: 'ok'});
      } else {
        finish({transcript: '', status: 'no-speech'});
      }
    }, maxMs);

    activeListen = {
      stop: () => {
        Voice.stop().catch(() => undefined);
        const text = bestTranscript.trim();
        if (text) finish({transcript: text, status: 'ok'});
        else finish({transcript: '', status: 'no-speech'});
      },
      cancel: () => finish({transcript: '', status: 'error'}),
    };

    opts.onPhase?.('recording');

    // 'hi-IN' for Hindi; the engine handles Hinglish (mixed Hindi + English).
    Voice.start('hi-IN').catch(() => finish(null));
  });
}

// ---- Fallback: record to file → upload → ElevenLabs Scribe ---------------

async function listenRecorder(opts: ListenOptions): Promise<ListenResult> {
  const maxMs = opts.maxMs ?? FALLBACK_RECORD_MS;

  recorderPlayer.removeRecordBackListener();
  if (recording) {
    await recorderPlayer.stopRecorder().catch(() => undefined);
    recording = false;
  }

  try {
    await recorderPlayer.startRecorder(undefined, RECORD_AUDIO_SET, true);
    recording = true;
  } catch {
    recording = false;
    return {transcript: '', status: 'error'};
  }

  return new Promise<ListenResult>(resolve => {
    let finished = false;
    const recordStart = Date.now();
    let hadLoud = false;
    let lastLoudTs = Date.now();

    const teardown = () => {
      recorderPlayer.removeRecordBackListener();
      clearTimeout(timer);
      clearInterval(silencePoll);
      activeListen = null;
    };

    const finish = async (transcribe: boolean) => {
      if (finished) return;
      finished = true;
      teardown();
      let path = '';
      try {
        path = await recorderPlayer.stopRecorder();
      } catch {
        /* handled below */
      }
      recording = false;
      if (!transcribe || !path) {
        resolve({transcript: '', status: 'error'});
        return;
      }
      opts.onPhase?.('transcribing');
      const transcript = await uploadAndTranscribe(path);
      if (transcript && !NOISE_TAGS.test(transcript.trim())) {
        resolve({transcript, status: 'ok'});
      } else {
        resolve({transcript: '', status: 'no-speech'});
      }
    };

    opts.onPhase?.('recording');

    recorderPlayer.addRecordBackListener(e => {
      const db =
        typeof e.currentMetering === 'number' ? e.currentMetering : -160;
      const loud = db > FALLBACK_SILENCE_DB;
      if (loud) {
        hadLoud = true;
        lastLoudTs = Date.now();
      }
      opts.onLevel?.(loud);
    });

    const silencePoll = setInterval(() => {
      const elapsed = Date.now() - recordStart;
      if (elapsed < FALLBACK_MIN_RECORD_MS) return;
      if (hadLoud && Date.now() - lastLoudTs >= FALLBACK_SILENCE_MS) {
        void finish(true);
      }
    }, 150);

    const timer = setTimeout(() => void finish(true), maxMs);

    activeListen = {
      stop: () => void finish(true),
      cancel: () => void finish(false),
    };
  });
}

/** Manually end the current hands-free turn. */
export function stopListening(): void {
  activeListen?.stop();
}

/** Abort the current hands-free turn without result (teardown/skip). */
export function cancelListening(): void {
  activeListen?.cancel();
}

/** Tear down all speech resources (call on screen unmount). */
export async function teardownSpeech(): Promise<void> {
  stopSpeaking();
  cancelListening();
  Voice.stop().catch(() => undefined);
  Voice.destroy().catch(() => undefined);
  recorderPlayer.removeRecordBackListener();
  await cancelRecording();
}
