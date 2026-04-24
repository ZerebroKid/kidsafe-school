import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

import {ENV} from '../config/env';
import type {Role, UserDoc} from './types';

GoogleSignin.configure({
  webClientId: ENV.GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export async function signUpWithEmail(input: SignupInput) {
  const {email, password, name, role} = input;
  const cred = await auth().createUserWithEmailAndPassword(email, password);
  try {
    await cred.user.updateProfile({displayName: name});
    await ensureUserDoc(cred.user.uid, {
      role,
      name,
      email,
      photoURL: cred.user.photoURL ?? null,
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
  const cred = await auth().signInWithEmailAndPassword(email, password);
  return cred.user;
}

/**
 * Google Sign-in. If this is the user's first time, they must also pick a role afterwards — the
 * UI routes them to RoleSelectorScreen when the Firestore user doc is missing.
 */
export async function signInWithGoogle() {
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
  await auth().sendPasswordResetEmail(email);
}

export async function reloadCurrentUser() {
  const u = auth().currentUser;
  if (u) {
    await u.reload();
  }
  return auth().currentUser;
}

/**
 * Creates the Firestore user doc if it doesn't already exist. Called by every signup path.
 * Retries transient `unavailable` / `deadline-exceeded` errors before giving up so flaky
 * networks don't wipe the signup flow.
 */
export async function ensureUserDoc(
  uid: string,
  partial: Partial<UserDoc> & Pick<UserDoc, 'role' | 'name' | 'email'>,
) {
  const ref = firestore().collection('users').doc(uid);
  const snap = await withFirestoreRetry(() => ref.get());
  if (snap.exists) {
    return;
  }
  const doc: UserDoc = {
    role: partial.role,
    name: partial.name,
    email: partial.email,
    photoURL: partial.photoURL ?? null,
    fcmToken: partial.fcmToken ?? null,
    createdAt: firestore.FieldValue.serverTimestamp(),
  };
  await withFirestoreRetry(() => ref.set(doc));
}

export async function getUserDoc(uid: string) {
  const snap = await withFirestoreRetry(() =>
    firestore().collection('users').doc(uid).get(),
  );
  return snap.exists ? (snap.data() as UserDoc) : null;
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
