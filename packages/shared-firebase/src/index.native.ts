/**
 * React Native entry point for @zerebro/shared-firebase.
 *
 * Re-exports the v1 RN-Firebase implementations so ZKid + ZConnect can
 * `import {paths, signInWithEmail, ...} from '@zerebro/shared-firebase'`
 * regardless of which sub-module the helper actually lives in.
 *
 * The web entry point (`index.web.ts`) provides matching stubs for the
 * Firebase Web SDK -- land alongside the Zerebro Campus / Admin apps.
 */

export const PLATFORM = 'native' as const;

export * from './auth';
export * from './firestore';
