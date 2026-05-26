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
import {type Auth, connectAuthEmulator, getAuth} from 'firebase/auth';
import {
  type Firestore,
  connectFirestoreEmulator,
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

// Emulator-connect guards. `connectXxxEmulator()` THROWS if invoked twice on
// the same SDK instance, and Next.js Fast-Refresh / RSC double-renders can
// re-enter these getters even after the singletons are cached (the singleton
// caches survive HMR but the connect side-effect is per-instance). We mirror
// the same booleans used by `./callable.web.ts` for the Functions emulator.
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

// Default emulator hosts -- must match scripts/dev-emulator.sh + firebase.json.
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_HOST = '127.0.0.1';
const FIRESTORE_EMULATOR_PORT = 8080;

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
  // Route to the local Auth emulator (9099) when the opt-in env flag is set
  // AND we're in the browser. Gated on `isBrowser()` so SSR / RSC builds
  // never try to talk to localhost from a Vercel edge worker.
  if (
    !authEmulatorConnected &&
    process.env.NEXT_PUBLIC_USE_EMULATOR === 'true' &&
    isBrowser()
  ) {
    connectAuthEmulator(authSingleton, AUTH_EMULATOR_URL, {
      disableWarnings: true,
    });
    authEmulatorConnected = true;
  }
  return authSingleton;
}

export function getFirestoreInstance(): Firestore {
  if (firestoreSingleton) return firestoreSingleton;
  firestoreSingleton = getFirestore(initFirebase());
  if (
    !firestoreEmulatorConnected &&
    process.env.NEXT_PUBLIC_USE_EMULATOR === 'true' &&
    isBrowser()
  ) {
    connectFirestoreEmulator(
      firestoreSingleton,
      FIRESTORE_EMULATOR_HOST,
      FIRESTORE_EMULATOR_PORT,
    );
    firestoreEmulatorConnected = true;
  }
  return firestoreSingleton;
}

function camelToEnv(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toUpperCase();
}

/**
 * Browser-only guard. Duplicated (not imported) from `./callable.web.ts` to
 * keep this file's import graph linear -- it's a 5-LOC helper, not worth a
 * cross-file dependency for symmetry's sake.
 */
function isBrowser(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as {document?: unknown}).document !== 'undefined'
  );
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
 * (Campus + Admin). Writes the v2 shape on first signin and is a no-op-ish
 * `phone` refresh on re-signins.
 *
 * `defaultRole` is what the app expects this signup to be (Campus passes
 * `'principal'`, Admin passes `'admin'`). The actual GRANT of that role
 * still happens server-side (Phase 4 `approvePrincipal`, `grant-role` CLI,
 * future admin-invite flows); on first OTP confirm we stamp it as
 * `primaryRole` with an empty `roles[]` so the dashboard layout's guard can
 * flag the user as "awaiting role assignment" via `hasRole(...) === false`.
 *
 * Why we DON'T just `setDoc(..., {merge: true})` blindly:
 *   The Firestore update rule (`!('roles' in ... affectedKeys())`) blocks any
 *   self-write that overwrites `roles`. A blind `setDoc({roles: []}, merge)`
 *   on a doc that already has e.g. `roles: ['admin']` flips it back to `[]`
 *   on the wire and the rule rejects with `permission-denied`. Result:
 *   every subsequent OTP signin after the first role grant breaks with
 *   "Sign-in succeeded but the server rejected the profile write."
 *
 *   The split below ensures:
 *     - first signin (doc missing)  -> create with the v2 shape (passes the
 *                                      create rule's v2 branch)
 *     - re-signin (doc exists)      -> only touch `phone`, leaving `roles`
 *                                      and `primaryRole` exactly as the
 *                                      admin / approve flow set them
 */
export async function upsertWebUserDoc(
  uid: string,
  data: {phone: string; defaultRole: Role},
): Promise<void> {
  const ref = doc(getFirestoreInstance(), 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data() as Partial<UserDoc> | undefined;
    if (existing?.phone === data.phone) return;
    await updateDoc(ref, {phone: data.phone});
    return;
  }
  await setDoc(ref, {
    phone: data.phone,
    roles: [],
    primaryRole: data.defaultRole,
    createdAt: serverTimestamp(),
  });
}

export * from './web-phone';
export {callFn} from './callable.web';
