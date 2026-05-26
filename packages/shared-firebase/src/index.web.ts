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
import {
  type Firestore,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type {Role, UserDoc} from '@zerebro/shared-types';

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
 *
 * IMPORTANT — Next.js / Turbopack only substitutes `NEXT_PUBLIC_*` at build
 * time when the code reads them via a DIRECT member-expression literal like
 * `process.env.NEXT_PUBLIC_FIREBASE_API_KEY`. Assigning `process.env` to a
 * local variable, destructuring, or any other indirection defeats the static
 * analysis and leaves the values undefined in the browser bundle. The repeated
 * literals below are deliberate -- do not "DRY" them up.
 */
export function readFirebaseConfigFromEnv(): ZerebroWebFirebaseConfig {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
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

// ---------------------------------------------------------------------------
// User doc helpers (web). Mirror the native helpers in `./auth.ts` so the
// Campus / Admin apps don't need to fork the migration tolerance logic.
// ---------------------------------------------------------------------------

/**
 * Read `users/{uid}` via the modular Firebase JS SDK and normalise v1 docs
 * (legacy `role: string`) to the v2 shape (`roles[]` + `primaryRole`). Mirrors
 * `getUserDoc` in `./auth.ts` for the React Native apps.
 */
export async function getCurrentUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(getFirestoreInstance(), 'users', uid));
  if (!snap.exists()) return null;
  return normaliseUserDoc(snap.data() as Partial<UserDoc>);
}

/**
 * v1 -> v2 normaliser. Pure function, shared between web reads and the OTP
 * confirm pages so they can fix orphan docs on first read.
 */
export function normaliseUserDoc(raw: Partial<UserDoc>): UserDoc {
  const rolesIn = Array.isArray(raw.roles) ? raw.roles : [];
  const roles =
    rolesIn.length > 0
      ? rolesIn
      : raw.role
        ? [raw.role]
        : ([] as Role[]);
  const primaryRole: Role = raw.primaryRole ?? roles[0] ?? 'parent';
  return {
    ...raw,
    roles: roles.length > 0 ? roles : ['parent'],
    primaryRole,
    createdAt: raw.createdAt ?? 0,
  };
}

/** Whether the user doc holds a given role. */
export function hasRole(d: UserDoc | null | undefined, role: Role): boolean {
  return !!d && Array.isArray(d.roles) && d.roles.includes(role);
}

/**
 * Update the user's `primaryRole`. Refuses to set a role the user doesn't
 * already hold (defence-in-depth against a buggy UI). Used by an eventual
 * web role switcher; not wired up in Phase 3 (the switcher only lives in
 * ZConnect for now).
 */
export async function setPrimaryRole(uid: string, role: Role): Promise<void> {
  const ref = doc(getFirestoreInstance(), 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`setPrimaryRole: users/${uid} missing`);
  const d = normaliseUserDoc(snap.data() as Partial<UserDoc>);
  if (!d.roles.includes(role)) {
    throw new Error(
      `setPrimaryRole: '${role}' not in roles [${d.roles.join(', ')}] for ${uid}`,
    );
  }
  await updateDoc(ref, {primaryRole: role});
}

/**
 * Idempotent web-side user doc upsert used by the OTP confirm pages
 * (Campus + Admin). Writes the v2 shape directly -- no `role:` legacy alias
 * because the web apps were born after Phase 2 and don't need the v1 create
 * rule branch.
 *
 * `defaultRole` is what the app expects this signup to be (Campus passes
 * `'principal'`, Admin passes `'admin'`). The actual GRANT of that role
 * still happens server-side (Phase 4 `approveTeacher` / future admin
 * invite flows); on first OTP confirm we just stamp it as `primaryRole`
 * with an empty `roles[]` so the dashboard layout's guard can flag the
 * user as "awaiting role assignment" via `hasRole(...) === false`.
 */
export async function upsertWebUserDoc(
  uid: string,
  data: {phone: string; defaultRole: Role},
): Promise<void> {
  const ref = doc(getFirestoreInstance(), 'users', uid);
  await setDoc(
    ref,
    {
      phone: data.phone,
      roles: [],
      primaryRole: data.defaultRole,
      createdAt: serverTimestamp(),
    },
    {merge: true},
  );
}

export * from './web-phone';
