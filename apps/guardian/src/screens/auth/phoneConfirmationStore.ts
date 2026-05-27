/**
 * Module-scope holder for the live `ConfirmationResult` returned by
 * `auth().signInWithPhoneNumber(...)`.
 *
 * React Navigation params have to be JSON-serialisable; the
 * `ConfirmationResult` carries an instance method (`confirm(code)`) that
 * can't be ferried through navigation state. So we stash the live object
 * under its `verificationId` here and the PhoneConfirm screen reads it
 * back on mount.
 *
 * Memory hygiene:
 *   - `take()` removes the entry on successful retrieval so a back-nav +
 *     re-OTP doesn't leak the previous attempt's `confirmation`.
 *   - There's no global cleanup if the user backgrounds the app mid-flow;
 *     the next sign-in attempt simply overwrites the slot.
 */

import type {FirebaseAuthTypes} from '@react-native-firebase/auth';

const store = new Map<string, FirebaseAuthTypes.ConfirmationResult>();

export function stashConfirmation(
  verificationId: string,
  confirmation: FirebaseAuthTypes.ConfirmationResult,
): void {
  store.set(verificationId, confirmation);
}

/** Retrieve + remove the confirmation. Returns null if no slot. */
export function takeConfirmation(
  verificationId: string,
): FirebaseAuthTypes.ConfirmationResult | null {
  const c = store.get(verificationId) ?? null;
  if (c) store.delete(verificationId);
  return c;
}
