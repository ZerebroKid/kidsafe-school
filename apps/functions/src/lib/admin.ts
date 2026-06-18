/**
 * Lazy Firebase Admin SDK bootstrap shared by every Phase 4+ callable, trigger,
 * and script in this package.
 *
 * Why a separate module:
 *   - `initializeApp()` MUST be called exactly once per process. Inside the
 *     deployed Functions runtime that happens implicitly on first import of a
 *     `firebase-admin/*` submodule, but our local scripts (migrate, seed,
 *     grant-role) run as plain Node processes -- they need an explicit init.
 *   - Caching the Firestore handle here lets call sites do `db()` everywhere
 *     instead of threading a Firestore instance through arguments.
 *
 * SAFE TO IMPORT from any callable. The function only initialises on first
 * access and is idempotent against the `getApps()` check so re-entry via
 * Fast-Refresh / emulator hot-reload won't throw "duplicate app".
 */

import {getApp, initializeApp} from 'firebase-admin/app';
import {getFirestore, type Firestore} from 'firebase-admin/firestore';
import {getAuth, type Auth} from 'firebase-admin/auth';
import {getStorage} from 'firebase-admin/storage';

type StorageBucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

let firestoreSingleton: Firestore | null = null;
let authSingleton: Auth | null = null;
let bucketSingleton: StorageBucket | null = null;

function ensureApp(): void {
  // Probe specifically for the DEFAULT app. The previous
  // `getApps().length > 0` check was wrong: under Firebase Functions v2 +
  // firebase-admin v12 the runtime can register non-default named apps at
  // boot, so any-app-exists short-circuits past `initializeApp()`, and the
  // next `getFirestore()` then throws `app/no-app`. `getApp()` (no args)
  // returns the default app or throws `app/no-app`, which is exactly the
  // condition we want to gate on.
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

/** Lazy-cached Firestore handle. First call initialises the Admin app. */
export function db(): Firestore {
  if (firestoreSingleton) return firestoreSingleton;
  ensureApp();
  firestoreSingleton = getFirestore();
  return firestoreSingleton;
}

/** Lazy-cached Auth handle (for callables that need to look up phone numbers). */
export function auth(): Auth {
  if (authSingleton) return authSingleton;
  ensureApp();
  authSingleton = getAuth();
  return authSingleton;
}

/** Lazy-cached default Storage bucket handle (Zumi TTS cache + STT uploads). */
export function bucket(): StorageBucket {
  if (bucketSingleton) return bucketSingleton;
  ensureApp();
  bucketSingleton = getStorage().bucket();
  return bucketSingleton;
}
