/**
 * One-time migration script: v1 `users/{uid}.role: string` -> v2 `roles: Role[]` + `primaryRole`.
 *
 * Idempotent. Re-running on a fully-migrated collection is a no-op.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @zerebro/functions migrate -- [flags]
 *
 * Flags:
 *   --dry-run                 Print what would change, write nothing. DEFAULT.
 *   --apply                   Actually write the updates.
 *   --target=emulator|prod    Where to run. DEFAULT `emulator`.
 *   --project=<id>            Override the Firebase project id (default: from .firebaserc / env).
 *
 * Targets:
 *   emulator -- requires FIRESTORE_EMULATOR_HOST (default `127.0.0.1:8080`)
 *               and the local emulator running (`pnpm dev:emulator`).
 *   prod     -- requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service
 *               account JSON with Firestore + Auth admin scopes, OR an active
 *               `gcloud auth application-default login`.
 *
 * Safety:
 *   - Defaults are intentionally read-only (`--dry-run` true, `--target=emulator`).
 *   - The script PRINTS every doc it touches with before/after so a stray run
 *     against prod is auditable from terminal scrollback.
 *   - Already-migrated docs (have `roles: list`) are skipped without rewriting
 *     their `createdAt` server timestamp -- safe for nightly re-runs.
 */

import {cert, initializeApp, applicationDefault} from 'firebase-admin/app';
import {getFirestore, FieldValue, type Firestore} from 'firebase-admin/firestore';

import type {Role} from '../lib/sharedTypes';

type Target = 'emulator' | 'prod';

interface Flags {
  apply: boolean;
  target: Target;
  project?: string;
}

interface MigrationPlan {
  uid: string;
  before: {role?: string; roles?: unknown; primaryRole?: unknown};
  after: {roles: Role[]; primaryRole: Role};
  reason: 'derived-from-role' | 'role-missing-default-parent';
}

const KNOWN_ROLES: Role[] = ['admin', 'principal', 'teacher', 'parent', 'child'];

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {apply: false, target: 'emulator'};
  for (const arg of argv) {
    // pnpm 9 forwards the `--` separator literally when invoked as
    // `pnpm migrate -- --apply` -- skip it so the user's flags after it parse.
    if (arg === '--') continue;
    if (arg === '--apply') flags.apply = true;
    else if (arg === '--dry-run') flags.apply = false;
    else if (arg.startsWith('--target=')) {
      const v = arg.slice('--target='.length);
      if (v !== 'emulator' && v !== 'prod') {
        throw new Error(`--target must be 'emulator' or 'prod', got '${v}'`);
      }
      flags.target = v;
    } else if (arg.startsWith('--project=')) {
      flags.project = arg.slice('--project='.length);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${arg}. Run with --help.`);
    }
  }
  return flags;
}

function printHelp(): void {
  console.log(
    [
      'Migrate users/{uid}.role -> roles[] + primaryRole (idempotent).',
      '',
      'Flags:',
      '  --dry-run                 Print what would change, write nothing. DEFAULT.',
      '  --apply                   Actually write the updates.',
      '  --target=emulator|prod    Where to run. DEFAULT emulator.',
      '  --project=<id>            Override Firebase project id.',
      '  --help, -h                This help.',
    ].join('\n'),
  );
}

const DEFAULT_PROJECT_ID = 'kidsafe-e5eac';

function initAdmin(flags: Flags): Firestore {
  if (flags.target === 'emulator') {
    // Admin SDK auto-detects FIRESTORE_EMULATOR_HOST; default it for convenience
    // so `pnpm migrate` works without exporting the env in every shell.
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    }
    initializeApp({projectId: flags.project ?? DEFAULT_PROJECT_ID});
    console.log(
      `[init] emulator @ ${process.env.FIRESTORE_EMULATOR_HOST} project=${flags.project ?? DEFAULT_PROJECT_ID}`,
    );
  } else {
    // prod: prefer GOOGLE_APPLICATION_CREDENTIALS service-account JSON if set,
    // otherwise fall back to ADC (set up via `gcloud auth application-default login`).
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath) {
      // Lazy import to avoid pulling fs into the emulator path.
      const fs = require('fs') as typeof import('fs');
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount),
        projectId: flags.project ?? serviceAccount.project_id ?? DEFAULT_PROJECT_ID,
      });
      console.log(
        `[init] prod via service account ${credPath} project=${flags.project ?? serviceAccount.project_id ?? DEFAULT_PROJECT_ID}`,
      );
    } else {
      // ADC path: prefer the explicit --project flag, then GCLOUD/GOOGLE_CLOUD_PROJECT
      // env vars, and finally hard-default to the only project in .firebaserc so the
      // user gets a credentials error instead of a confusing 'no project id' one.
      const projectId =
        flags.project ??
        process.env.GOOGLE_CLOUD_PROJECT ??
        process.env.GCLOUD_PROJECT ??
        DEFAULT_PROJECT_ID;
      preflightAdcCredentials();
      initializeApp({credential: applicationDefault(), projectId});
      console.log(`[init] prod via application-default-credentials project=${projectId}`);
    }
  }
  return getFirestore();
}

/**
 * Fail fast with an actionable message if neither GOOGLE_APPLICATION_CREDENTIALS
 * nor a working ADC file exists. The Admin SDK's own error ('Unable to detect a
 * Project Id') hides the real cause (no credentials) and confuses users.
 */
function preflightAdcCredentials(): void {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const adcPath = path.join(
    process.env.HOME ?? '',
    '.config',
    'gcloud',
    'application_default_credentials.json',
  );
  if (fs.existsSync(adcPath)) return;
  // No service-account JSON either (we already know GOOGLE_APPLICATION_CREDENTIALS is unset).
  console.error(
    [
      '',
      '[fatal] No prod credentials found.',
      '',
      'Pick ONE of the following before re-running with --target=prod:',
      '',
      '  A) Service account JSON (recommended, no system install):',
      '     1. Firebase Console -> Project settings -> Service accounts ->',
      `        Generate new private key for ${DEFAULT_PROJECT_ID}.`,
      '     2. Save the file outside the repo, e.g. ~/.zerebro/kidsafe-admin.json',
      '     3. Export:',
      '          export GOOGLE_APPLICATION_CREDENTIALS=~/.zerebro/kidsafe-admin.json',
      '',
      '  B) gcloud Application Default Credentials:',
      '     sudo snap install google-cloud-cli   # Ubuntu',
      '     gcloud auth application-default login',
      `     gcloud config set project ${DEFAULT_PROJECT_ID}`,
      '',
      'See apps/functions/README.md (P3.1.3 -> Production pass) for full notes.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

function isKnownRole(v: unknown): v is Role {
  return typeof v === 'string' && (KNOWN_ROLES as string[]).includes(v);
}

function planFor(uid: string, data: Record<string, unknown>): MigrationPlan | null {
  const existingRoles = data.roles;
  // Already migrated -- has a non-empty roles array AND primaryRole. Skip silently.
  if (Array.isArray(existingRoles) && existingRoles.length > 0 && typeof data.primaryRole === 'string') {
    return null;
  }
  // Has roles[] but missing primaryRole (web OTP confirm writes `roles: []`).
  // Fill primaryRole from the first known role, or default to 'parent' if the array is empty.
  if (Array.isArray(existingRoles)) {
    const firstKnown = existingRoles.find(isKnownRole);
    const primaryRole: Role = firstKnown ?? 'parent';
    // Don't shrink roles -- write the existing array back through unchanged.
    const rolesOut: Role[] = existingRoles.filter(isKnownRole);
    if (rolesOut.length === 0) rolesOut.push('parent');
    return {
      uid,
      before: {roles: existingRoles, primaryRole: data.primaryRole},
      after: {roles: rolesOut, primaryRole},
      reason: existingRoles.length === 0 ? 'role-missing-default-parent' : 'derived-from-role',
    };
  }
  // Has v1 single `role`.
  if (isKnownRole(data.role)) {
    return {
      uid,
      before: {role: data.role},
      after: {roles: [data.role], primaryRole: data.role},
      reason: 'derived-from-role',
    };
  }
  // Has neither -- the doc was created by an OTP confirm that crashed mid-write,
  // or a manual hand-write in the console. Default to 'parent' so the user
  // doesn't get stuck on the WrongAppForRole screen forever; an admin can flip
  // it later.
  return {
    uid,
    before: {role: typeof data.role === 'string' ? data.role : undefined, roles: data.roles},
    after: {roles: ['parent'], primaryRole: 'parent'},
    reason: 'role-missing-default-parent',
  };
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const db = initAdmin(flags);
  const mode = flags.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`[start] mode=${mode} target=${flags.target}`);

  const snap = await db.collection('users').get();
  console.log(`[fetch] ${snap.size} user docs total`);

  const plans: MigrationPlan[] = [];
  let alreadyMigrated = 0;
  snap.forEach(doc => {
    const plan = planFor(doc.id, doc.data() as Record<string, unknown>);
    if (plan) plans.push(plan);
    else alreadyMigrated++;
  });

  console.log(`[plan] ${plans.length} need migration, ${alreadyMigrated} already on v2 shape`);
  for (const p of plans) {
    console.log(
      `  - ${p.uid}  before=${JSON.stringify(p.before)}  after=${JSON.stringify(p.after)}  reason=${p.reason}`,
    );
  }

  if (!flags.apply) {
    console.log('[done] dry-run -- no writes performed. Re-run with --apply to commit.');
    return;
  }

  if (flags.target === 'prod' && plans.length > 0) {
    console.log('[apply] WAITING 5s before prod writes -- Ctrl-C to abort');
    await new Promise(res => setTimeout(res, 5000));
  }

  // Batched writes -- 500-op cap per batch is the Firestore Admin limit.
  const BATCH_SIZE = 400;
  let writes = 0;
  for (let i = 0; i < plans.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = plans.slice(i, i + BATCH_SIZE);
    for (const p of chunk) {
      const ref = db.collection('users').doc(p.uid);
      // Stamp migratedAt so we can spot newly-migrated docs in the console;
      // safe to overwrite on re-run because planFor() only returns docs that
      // weren't on v2 shape yet.
      batch.set(
        ref,
        {
          roles: p.after.roles,
          primaryRole: p.after.primaryRole,
          migratedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      writes++;
    }
    await batch.commit();
    console.log(`[apply] committed batch ${i / BATCH_SIZE + 1} (${chunk.length} docs)`);
  }

  console.log(`[done] migrated=${writes} skipped=${alreadyMigrated}`);
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
