/**
 * Web entry point for `@zerebro/shared-firebase`.
 *
 * The native track (ZKid, ZConnect) keeps using `@react-native-firebase`; the
 * webs (Zerebro Campus, Zerebro Admin) use the modular Firebase JS SDK and go
 * through this file. The `react-native` condition in `package.json` "exports"
 * makes Metro never see this module, so importing `firebase/app` here is safe
 * for both bundlers.
 *
 * Singletons are intentionally lazy: each `getXxx()` call returns the same
 * instance after the first call, so Next.js' double-renders (RSC + client
 * hydration), Fast Refresh and `'use client'` boundaries can't accidentally
 * reinitialise the SDK and trigger the "duplicate app" warning.
 */

import {type FirebaseApp, getApps, initializeApp} from 'firebase/app';
import {type Auth, getAuth} from 'firebase/auth';
import {type Firestore, getFirestore} from 'firebase/firestore';

export const PLATFORM = 'web' as const;

export interface ZerebroWebFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
  storageBucket: string;
}

/**
 * Reads the six required `NEXT_PUBLIC_FIREBASE_*` env vars Next.js inlines at
 * build time. Throws a precise error listing the missing keys so a fresh
 * checkout that forgot `.env.local` fails fast at boot instead of producing a
 * confusing "invalid-api-key" toast on the OTP screen.
 */
export function readFirebaseConfigFromEnv(): ZerebroWebFirebaseConfig {
  const env: Record<string, string | undefined> =
    typeof process !== 'undefined' && process.env ? process.env : {};
  const config = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => `NEXT_PUBLIC_FIREBASE_${camelToEnv(k)}`);
  if (missing.length > 0) {
    throw new Error(
      `@zerebro/shared-firebase: missing Firebase web env vars: ${missing.join(', ')}. ` +
        'Copy .env.local.example -> .env.local and fill in the six values from the ' +
        'Firebase Console (Project settings -> General -> Your apps -> Web app).',
    );
  }
  return config as ZerebroWebFirebaseConfig;
}

let appSingleton: FirebaseApp | null = null;
let authSingleton: Auth | null = null;
let firestoreSingleton: Firestore | null = null;

export function initFirebase(
  configOverride?: ZerebroWebFirebaseConfig,
): FirebaseApp {
  if (appSingleton) return appSingleton;
  // Cover the case where another part of the app (e.g. a Firebase debug tool
  // loaded via script tag) already registered the default app -- reuse it
  // rather than throwing a "duplicate app" error.
  const existing = getApps();
  if (existing.length > 0 && existing[0]) {
    appSingleton = existing[0];
    return existing[0];
  }
  const config = configOverride ?? readFirebaseConfigFromEnv();
  const app = initializeApp(config);
  appSingleton = app;
  return app;
}

export function getAuthInstance(): Auth {
  if (authSingleton) return authSingleton;
  authSingleton = getAuth(initFirebase());
  return authSingleton;
}

export function getFirestoreInstance(): Firestore {
  if (firestoreSingleton) return firestoreSingleton;
  firestoreSingleton = getFirestore(initFirebase());
  return firestoreSingleton;
}

function camelToEnv(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toUpperCase();
}

export * from './web-phone';
