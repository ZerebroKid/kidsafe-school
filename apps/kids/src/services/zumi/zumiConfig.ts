/**
 * Remote Zumi feature flags (Phase 0 kill switch).
 *
 * Reads `appConfig/zumi` from Firestore so we can flip between the LiveKit
 * pipeline and the legacy callable pipeline without shipping a new APK.
 *
 * Lookup order:
 *   1. in-memory cache (same process)
 *   2. Firestore (fresh value; also written to AsyncStorage)
 *   3. AsyncStorage (last-known value if the network read fails)
 *   4. safe defaults (pipeline = "live" -- today's behavior)
 *
 * Missing doc / flaky network must never make the app worse than today.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

import {logInfo} from './zumiPerf';

const STORAGE_KEY = 'zumiConfig.v1';

export type ZumiPipeline = 'live' | 'legacy';

export interface ZumiRemoteConfig {
  /** "live" = LiveKit streaming agent; "legacy" = callable ZumiSessionManager. */
  pipeline: ZumiPipeline;
  /** Placeholder for Phase 5 (whisper | deepgram | sarvam). */
  sttProvider: string;
  /** Placeholder for Phase 6 (kokoro-cpu | kokoro-gpu). */
  ttsProvider: string;
  /** Placeholder for Phase 2 safety layer. */
  moderationEnabled: boolean;
}

const DEFAULTS: ZumiRemoteConfig = {
  pipeline: 'live',
  sttProvider: 'sarvam',
  ttsProvider: 'kokoro-cpu',
  moderationEnabled: false,
};

let memoryCache: ZumiRemoteConfig | null = null;
let inflight: Promise<ZumiRemoteConfig> | null = null;

function normalize(raw: Record<string, unknown> | null | undefined): ZumiRemoteConfig {
  return {
    pipeline: raw?.pipeline === 'legacy' ? 'legacy' : 'live',
    sttProvider:
      typeof raw?.sttProvider === 'string' && raw.sttProvider
        ? raw.sttProvider
        : DEFAULTS.sttProvider,
    ttsProvider:
      typeof raw?.ttsProvider === 'string' && raw.ttsProvider
        ? raw.ttsProvider
        : DEFAULTS.ttsProvider,
    moderationEnabled: raw?.moderationEnabled === true,
  };
}

async function readCached(): Promise<ZumiRemoteConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function writeCached(cfg: ZumiRemoteConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // cache write is best-effort
  }
}

/**
 * Load the remote Zumi config. Concurrent callers share one in-flight fetch.
 * Never throws -- always returns a usable config (defaults on total failure).
 */
export async function loadZumiConfig(): Promise<ZumiRemoteConfig> {
  if (memoryCache) return memoryCache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const snap = await firestore().collection('appConfig').doc('zumi').get();
      if (snap.exists) {
        const cfg = normalize(snap.data() as Record<string, unknown> | undefined);
        memoryCache = cfg;
        void writeCached(cfg);
        logInfo(`zumiConfig from Firestore: pipeline=${cfg.pipeline}`);
        return cfg;
      }
      logInfo('zumiConfig doc missing -- using defaults (pipeline=live)');
    } catch (err) {
      logInfo(
        `zumiConfig Firestore read failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const cached = await readCached();
    if (cached) {
      memoryCache = cached;
      logInfo(`zumiConfig from AsyncStorage: pipeline=${cached.pipeline}`);
      return cached;
    }

    memoryCache = {...DEFAULTS};
    return memoryCache;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** True when the kids app should use the LiveKit streaming session. */
export async function isZumiLive(): Promise<boolean> {
  const cfg = await loadZumiConfig();
  return cfg.pipeline === 'live';
}

/** Test helper -- clears caches so the next load hits the network again. */
export function __resetZumiConfigCacheForTests(): void {
  memoryCache = null;
  inflight = null;
}
