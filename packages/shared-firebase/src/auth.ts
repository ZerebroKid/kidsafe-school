import auth from '@react-native-firebase/auth';
import firestore, {firebase} from '@react-native-firebase/firestore';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

import type {DeviceMode, Role, UserDoc} from '@zerebro/shared-types';

/**
 * Configure Google Sign-In with the calling app's OAuth web client id. Apps MUST
 * invoke this once at startup (before any auth flow) so `signInWithGoogle` below
 * has a configured client. shared-firebase deliberately does NOT read from any
 * `ENV` module -- it stays platform / app agnostic so it can serve ZKid,
 * ZConnect, and the future webs from a single source.
 */
export function initGoogleSignIn(webClientId: string): void {
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
  });
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  /**
   * Only meaningful for `role === 'parent'`. Picks between the two-device flow (default)
   * and the shared-phone flow. Threaded through to `ensureUserDoc` so the user doc is
   * stamped with the right mode at creation time.
   */
  deviceMode?: DeviceMode;
}

export async function signUpWithEmail(input: SignupInput) {
  const {email, password, name, role, deviceMode} = input;
  const cred = await auth().createUserWithEmailAndPassword(email, password);
  try {
    await cred.user.updateProfile({displayName: name});
    await ensureUserDoc(cred.user.uid, {
      role,
      name,
      email,
      photoURL: cred.user.photoURL ?? null,
      deviceMode: role === 'parent' ? deviceMode : undefined,
    });
    // Kick off the verification email — the UI waits for the user to click the link.
    await cred.user.sendEmailVerification();
    return cred.user;
  } catch (err) {
    // If anything after auth creation fails (most commonly Firestore being unavailable),
    // roll back the brand-new auth user so the caller can retry with the same email
    // instead of being stuck with `email-already-in-use` on the next attempt.
    try {
      await cred.user.delete();
    } catch {
      // If the rollback itself fails (e.g. network is really down) there's nothing
      // more we can do here — surface the original error below.
    }
    throw friendlyFirebaseError(err);
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const cred = await auth().signInWithEmailAndPassword(email, password);
    return cred.user;
  } catch (err) {
    throw friendlyFirebaseError(err);
  }
}

/**
 * Google Sign-in. If this is the user's first time, they must also pick a role afterwards — the
 * UI routes them to RoleSelectorScreen when the Firestore user doc is missing.
 */
export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    const result = await GoogleSignin.signIn();
    const idToken =
      (result as unknown as {data?: {idToken?: string}}).data?.idToken ??
      (result as unknown as {idToken?: string}).idToken;
    if (!idToken) {
      throw new Error('No Google ID token returned');
    }
    const credential = auth.GoogleAuthProvider.credential(idToken);
    const cred = await auth().signInWithCredential(credential);
    return cred.user;
  } catch (err) {
    const code = (err as {code?: string}).code;
    if (code === '-5' || code === '12501') {
      throw new Error('Google sign-in was cancelled.');
    }
    throw friendlyFirebaseError(err);
  }
}

export async function signOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // not signed in with Google, ignore
  }
  await auth().signOut();
}

export async function sendPasswordReset(email: string) {
  try {
    await auth().sendPasswordResetEmail(email);
  } catch (err) {
    throw friendlyFirebaseError(err);
  }
}

export async function reloadCurrentUser() {
  const u = auth().currentUser;
  if (u) {
    await u.reload();
  }
  return auth().currentUser;
}

interface EnsureUserDocInput {
  role: Role;
  name: string;
  email: string;
  photoURL?: string | null;
  fcmToken?: string | null;
  deviceMode?: DeviceMode;
}

/**
 * Creates the Firestore user doc if it doesn't already exist. Called by every signup path.
 * Retries transient `unavailable` / `deadline-exceeded` errors before giving up so flaky
 * networks don't wipe the signup flow.
 *
 * Phase 3.2.2: writes BOTH shapes -- the v2 `roles: [role]` + `primaryRole: role` AND the
 * legacy `role: role` -- so fresh installs land already-migrated AND the v1 create rule
 * branch (`firestore/rules`) still accepts the write while the v1 branch is in place.
 * The legacy field drops after Phase 4 widens the create rule to v2-only.
 */
/**
 * P4.3 -- bootstrap the v2 user doc for a phone-OTP signup that just landed
 * from ZConnect's PhoneConfirmScreen.
 *
 * Idempotent: skipped if a doc already exists (so a re-OTP by an existing
 * teacher/parent doesn't blat their roles[]). The fresh-doc shape is
 * `{roles: [], phone, createdAt}` -- intentionally NO `primaryRole` and NO
 * `role` (legacy) -- so RoleOnboardingGate routes them through the
 * intent picker.
 *
 * Matches the v2 create branch in firestore/rules:
 *   `roles is list && hasAll(['roles', 'createdAt']) && phone is string`
 *
 * Errors bubble up to the caller (PhoneConfirmScreen) which surfaces them
 * as an Alert; we don't swallow because a failed write means the user
 * will land on a screen that can't resolve their role.
 */
export async function ensurePhoneUserDoc(
  uid: string,
  phone: string,
): Promise<void> {
  const ref = firestore().collection('users').doc(uid);
  const snap = await withFirestoreRetry(() => ref.get());
  if (snap.exists) return;
  await withFirestoreRetry(() =>
    ref.set({
      roles: [],
      phone,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
  );
}

export async function ensureUserDoc(uid: string, partial: EnsureUserDocInput) {
  const ref = firestore().collection('users').doc(uid);
  const snap = await withFirestoreRetry(() => ref.get());
  if (snap.exists) {
    return;
  }
  const doc: UserDoc = {
    roles: [partial.role],
    primaryRole: partial.role,
    role: partial.role,
    name: partial.name,
    email: partial.email,
    photoURL: partial.photoURL ?? null,
    fcmToken: partial.fcmToken ?? null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  // Stamp deviceMode only when explicitly provided (parent signups). Leaving it absent for
  // child accounts keeps the type narrow and avoids polluting child docs.
  if (partial.deviceMode) {
    doc.deviceMode = partial.deviceMode;
  }
  await withFirestoreRetry(() => ref.set(doc));
}

/**
 * Read `users/{uid}` and normalise v1 docs (legacy `role: string`) to the v2 shape
 * (`roles: [role]`, `primaryRole: role`) IN MEMORY. The on-disk doc is not rewritten by
 * this read -- the one-time migration script handles persistence. Callers can rely on
 * `doc.roles` and `doc.primaryRole` always being present on a returned doc, regardless
 * of whether the cutover has reached this user yet.
 */
export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await withFirestoreRetry(() =>
    firestore().collection('users').doc(uid).get(),
  );
  if (!snap.exists) return null;
  return normaliseUserDoc(snap.data() as Partial<UserDoc>);
}

/**
 * v1 -> v2 normaliser. Pure function so call sites can also use it on Firestore
 * `onSnapshot` payloads (e.g. ZConnect's RootNavigator subscription).
 *
 * P4.3 -- the previous implementation silently coerced an empty `roles[]`
 * into `['parent']` so that downstream consumers always had a non-empty
 * array. That coercion HID the role-intent picker: RootNavigator decides
 * to mount `RoleOnboardingGate` (the new parent vs teacher picker) when
 * `userDoc.roles.length === 0`, and the legacy fallback meant brand-new
 * phone-OTP signups silently slipped into the ParentNavigator branch
 * instead. We now preserve `roles=[]` end-to-end and only fall back to
 * the legacy single-`role` field if a true v1 doc is read.
 *
 * `primaryRole` keeps a 'parent' placeholder when both fields are absent
 * because the type is non-optional and downstream code (RoleSwitcher,
 * Wrong-app screens) reads it unconditionally. The placeholder is
 * navigationally inert when `roles.length === 0` -- RootNavigator's gate
 * predicate fires first and short-circuits the `primaryRole` switch.
 */
export function normaliseUserDoc(raw: Partial<UserDoc>): UserDoc {
  const roles =
    Array.isArray(raw.roles) && raw.roles.length > 0
      ? raw.roles
      : Array.isArray(raw.roles)
        ? raw.roles
        : raw.role
          ? [raw.role]
          : [];
  const primaryRole: Role = raw.primaryRole ?? roles[0] ?? 'parent';
  const normalised: UserDoc = {
    ...raw,
    roles,
    primaryRole,
    createdAt: raw.createdAt ?? 0,
  };
  return normalised;
}

/** Whether the (normalised) user doc holds a given role. */
export function hasRole(doc: UserDoc | null | undefined, role: Role): boolean {
  return !!doc && Array.isArray(doc.roles) && doc.roles.includes(role);
}

/**
 * Persist a new `primaryRole` on the user's own doc. Used by ZConnect's RoleSwitcher.
 * Throws if `role` isn't already in the user's `roles[]` -- we never let the client
 * pick a primary that they don't actually hold (defence-in-depth against a buggy UI
 * mutating arbitrary state).
 */
export async function setPrimaryRole(uid: string, role: Role): Promise<void> {
  const ref = firestore().collection('users').doc(uid);
  const snap = await withFirestoreRetry(() => ref.get());
  if (!snap.exists) {
    throw new Error(`setPrimaryRole: users/${uid} missing`);
  }
  const data = normaliseUserDoc(snap.data() as Partial<UserDoc>);
  if (!data.roles.includes(role)) {
    throw new Error(
      `setPrimaryRole: '${role}' not in roles [${data.roles.join(', ')}] for ${uid}`,
    );
  }
  await withFirestoreRetry(() => ref.update({primaryRole: role}));
}

// --- internals ---------------------------------------------------------------

const TRANSIENT_FIRESTORE_CODES = new Set([
  'firestore/unavailable',
  'firestore/deadline-exceeded',
  'firestore/internal',
  'firestore/cancelled',
]);

async function withFirestoreRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code = (err as {code?: string}).code;
      if (!code || !TRANSIENT_FIRESTORE_CODES.has(code)) {
        throw err;
      }
      // Exponential backoff: 400ms, 800ms, 1600ms
      await new Promise(res => setTimeout(res, 400 * Math.pow(2, i)));
    }
  }
  throw lastError;
}

function friendlyFirebaseError(err: unknown): Error {
  const code = (err as {code?: string}).code;
  if (code === 'auth/invalid-email') {
    return new Error('That email address looks invalid.');
  }
  if (code === 'auth/user-disabled') {
    return new Error('This account has been disabled.');
  }
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return new Error('Incorrect email or password. Try again.');
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return new Error('Incorrect email or password. Try again.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Too many attempts. Wait a moment and try again.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Network error. Check your connection and try again.');
  }
  if (code === 'firestore/unavailable') {
    return new Error(
      "Can't reach the database. Make sure the Firestore database has been created in " +
        'the Firebase console (Build → Firestore Database → Create database), then try again.',
    );
  }
  if (code === 'firestore/permission-denied') {
    return new Error(
      'The database rejected the write. Publish firestore.rules from this repo to your ' +
        'Firebase project and retry.',
    );
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}
