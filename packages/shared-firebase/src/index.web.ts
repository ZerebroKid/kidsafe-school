/**
 * Web entry point for @zerebro/shared-firebase.
 *
 * Stubs only -- the Firebase Web SDK port lands alongside the Zerebro Campus
 * (principal) and Zerebro Admin webs in Phase 2. React Native apps never
 * resolve to this file thanks to the `react-native` condition in
 * package.json exports.
 */

export const PLATFORM = 'web' as const;

export function notImplementedOnWeb(name: string): never {
  throw new Error(
    `@zerebro/shared-firebase: "${name}" has no web implementation yet. ` +
      'The Firebase Web SDK port lands in Phase 2 alongside Zerebro Campus.',
  );
}
