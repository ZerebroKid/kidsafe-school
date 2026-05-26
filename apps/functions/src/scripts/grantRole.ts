/**
 * P4.2.9 -- CLI to grant (or revoke) a role on a user's Firestore profile.
 *
 * Idempotent. Dry-runs by default. Designed for two recurring chores:
 *   1. Bootstrap the FIRST admin in a new environment (no other path grants
 *      'admin' until a Phase 4.x admin invite flow ships).
 *   2. Granular grants during testing -- e.g. flipping a test user to
 *      'teacher' without going through the full claim/approve flow.
 *
 * Usage:
 *   pnpm grant-role -- --phone=+918791234849 --role=admin              # dry-run, emulator
 *   pnpm grant-role -- --phone=... --role=admin --apply                # commit, emulator
 *   pnpm grant-role -- --phone=... --role=admin --target=prod --apply  # commit, prod
 *   pnpm grant-role -- --phone=... --role=teacher --remove --apply     # arrayRemove
 *
 * Resolves the user by `auth.getUserByPhoneNumber(phone)` so the script
 * works even if the Firestore `users/{uid}` doc was never created (in
 * which case it gets created on apply with the requested role + primaryRole).
 */

import {FieldValue} from 'firebase-admin/firestore';
import type {Role} from '../lib/sharedTypes';

import {initScriptAdmin, parseBaseFlags} from './lib/scriptInit';

const KNOWN_ROLES: Role[] = ['admin', 'principal', 'teacher', 'parent', 'child'];

interface GrantFlags {
  phone?: string;
  role?: Role;
  remove: boolean;
}

function parseGrantFlags(argv: string[]): GrantFlags {
  const out: GrantFlags = {remove: false};
  for (const arg of argv) {
    if (arg.startsWith('--phone=')) out.phone = arg.slice('--phone='.length);
    else if (arg.startsWith('--role=')) {
      const v = arg.slice('--role='.length);
      if ((KNOWN_ROLES as string[]).includes(v)) out.role = v as Role;
      else throw new Error(`Unknown role '${v}'. Allowed: ${KNOWN_ROLES.join(', ')}`);
    } else if (arg === '--remove') out.remove = true;
  }
  return out;
}

function usage(): never {
  console.error(
    [
      'Usage: pnpm grant-role -- [flags]',
      '',
      'Flags:',
      '  --phone=+91...        E.164 phone number of the user (required).',
      '  --role=<role>         One of: admin, principal, teacher, parent, child (required).',
      '  --remove              Remove the role instead of granting it.',
      '  --apply               Commit. Defaults to dry-run.',
      '  --target=emulator|prod  Where to run. DEFAULT emulator.',
      '  --project=<id>        Override Firebase project id.',
      '',
      'Examples:',
      '  pnpm grant-role -- --phone=+918791234849 --role=admin            # dry-run',
      '  pnpm grant-role -- --phone=+918791234849 --role=admin --apply    # commit',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const base = parseBaseFlags(process.argv.slice(2));
  const grant = parseGrantFlags(process.argv.slice(2));
  if (!grant.phone || !grant.role) usage();

  const {db, auth} = initScriptAdmin(base);

  console.log(
    `[start] mode=${base.apply ? 'APPLY' : 'DRY-RUN'} target=${base.target} phone=${grant.phone} role=${grant.role} action=${grant.remove ? 'remove' : 'grant'}`,
  );

  let uid: string;
  try {
    const user = await auth.getUserByPhoneNumber(grant.phone!);
    uid = user.uid;
    console.log(`[lookup] phone=${grant.phone} -> uid=${uid}`);
  } catch (err) {
    console.error(
      `[fatal] No auth user with phone=${grant.phone}. Sign in once via OTP first so Firebase creates the user record, then re-run.`,
    );
    process.exit(1);
  }

  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() ?? {} : {};
  const currentRoles: string[] = Array.isArray(data.roles)
    ? data.roles.filter((r: unknown): r is string => typeof r === 'string')
    : [];

  console.log(`[before] users/${uid} roles=${JSON.stringify(currentRoles)} primaryRole=${JSON.stringify(data.primaryRole)}`);

  if (grant.remove) {
    if (!currentRoles.includes(grant.role!)) {
      console.log(`[skip] role=${grant.role} not present on users/${uid}`);
      return;
    }
    const afterRoles = currentRoles.filter(r => r !== grant.role);
    const afterPrimary = data.primaryRole === grant.role ? afterRoles[0] ?? null : data.primaryRole;
    console.log(`[plan] users/${uid} roles=${JSON.stringify(afterRoles)} primaryRole=${JSON.stringify(afterPrimary)}`);
    if (!base.apply) {
      console.log('[done] dry-run -- no writes performed. Re-run with --apply.');
      return;
    }
    const update: Record<string, unknown> = {
      roles: FieldValue.arrayRemove(grant.role),
    };
    if (data.primaryRole === grant.role) {
      update.primaryRole = afterRoles[0] ?? null;
    }
    await ref.set(update, {merge: true});
  } else {
    if (currentRoles.includes(grant.role!) && data.primaryRole) {
      console.log(`[skip] role=${grant.role} already present on users/${uid}`);
      return;
    }
    const afterRoles = currentRoles.includes(grant.role!)
      ? currentRoles
      : [...currentRoles, grant.role!];
    const afterPrimary =
      typeof data.primaryRole === 'string' && afterRoles.includes(data.primaryRole)
        ? data.primaryRole
        : grant.role!;
    console.log(`[plan] users/${uid} roles=${JSON.stringify(afterRoles)} primaryRole=${afterPrimary}`);
    if (!base.apply) {
      console.log('[done] dry-run -- no writes performed. Re-run with --apply.');
      return;
    }
    if (!snap.exists) {
      // Create the doc on the fly. Mirrors upsertWebUserDoc but with the
      // role already granted.
      await ref.set({
        phone: grant.phone,
        roles: [grant.role],
        primaryRole: grant.role,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      const update: Record<string, unknown> = {
        roles: FieldValue.arrayUnion(grant.role!),
      };
      if (
        typeof data.primaryRole !== 'string' ||
        data.primaryRole.length === 0
      ) {
        update.primaryRole = grant.role!;
      }
      await ref.set(update, {merge: true});
    }
  }

  const after = (await ref.get()).data() ?? {};
  console.log(
    `[after]  users/${uid} roles=${JSON.stringify(after.roles)} primaryRole=${JSON.stringify(after.primaryRole)}`,
  );
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
