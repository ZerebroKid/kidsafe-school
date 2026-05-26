/**
 * Browser-side copy of the invite-code generator used by the admin's
 * create-school flow. Mirrors `apps/functions/src/lib/codes.ts` exactly --
 * same alphabet, same length -- so a code minted client-side here looks
 * identical to a code minted server-side by `rotateInviteCode`.
 *
 * Kept as a duplicated 10-LOC file rather than a shared-utils export because
 * (a) admin-web cannot reach into `apps/functions/src/`, and (b) extracting a
 * shared package for one constant + one function would be over-engineering.
 * If a third caller needs the generator, move it to `@zerebro/shared-utils`.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return out;
}
