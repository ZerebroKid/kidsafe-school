import {MMKV} from 'react-native-mmkv';

/**
 * Per-install device identifier.
 *
 * We need a way to tell "the same child Firebase account just signed in on a different phone"
 * apart from "this is the same phone restarting". Firebase Auth uses the account, not the
 * device, so `uid` is identical across phones — we generate our own opaque per-install id and
 * persist it in MMKV (cleared by uninstall, factory reset, or `clearAppData`).
 *
 * The id is written to `ChildDoc.currentDeviceId` after every reconcile so the parent UI can
 * detect device switches and (later) so server-side logic can audit cross-device behavior.
 */
const storage = new MMKV({id: 'kidsafe.device'});
const KEY = 'kidsafe.deviceId';

export function getOrCreateDeviceId(): string {
  const existing = storage.getString(KEY);
  if (existing) {
    return existing;
  }
  const id = generateId();
  storage.set(KEY, id);
  return id;
}

/**
 * RFC 4122-ish v4-shape id built from `Math.random` — good enough for an opaque per-install
 * tag (we never use it as a cryptographic identifier). Avoids pulling in a `uuid` dep.
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
