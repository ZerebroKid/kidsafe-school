/**
 * Shared admin-init + flag-parsing for the standalone Node scripts that live
 * under `apps/functions/src/scripts/*`. Extracted from
 * `oneTimeMigration_v1_to_v2.ts` so seed-staging and grant-role can reuse the
 * same emulator/ADC/service-account JSON resolution.
 *
 * These scripts are NOT deployed -- they run as plain Node processes via
 * `pnpm seed:staging` / `pnpm grant-role`. The deployed Functions runtime
 * autoloads credentials, so the lib in `../lib/admin.ts` does not need any
 * of this; this file is the script-only equivalent.
 */

import {cert, initializeApp, applicationDefault, getApps} from 'firebase-admin/app';
import {getFirestore, type Firestore} from 'firebase-admin/firestore';
import {getAuth, type Auth} from 'firebase-admin/auth';

export type Target = 'emulator' | 'prod';

export interface BaseFlags {
  apply: boolean;
  target: Target;
  project?: string;
}

export const DEFAULT_PROJECT_ID = 'kidsafe-e5eac';

/**
 * Parse the flags shared by every script (--apply, --dry-run, --target,
 * --project, --help). Script-specific flags should be parsed by the caller
 * AFTER calling this -- pass through the raw argv unchanged.
 */
export function parseBaseFlags(argv: string[]): BaseFlags {
  const flags: BaseFlags = {apply: false, target: 'emulator'};
  for (const arg of argv) {
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
    }
    // Unknown flags are deliberately ignored here -- the caller validates
    // them in its own parser pass.
  }
  return flags;
}

/**
 * Lazy admin init. Mirrors the migration script's exact resolution order:
 *   emulator -> auto-detect FIRESTORE_EMULATOR_HOST (default 127.0.0.1:8080)
 *   prod     -> GOOGLE_APPLICATION_CREDENTIALS service-account JSON
 *               -> applicationDefault() from gcloud ADC
 *
 * Returns {db, auth} ready to use. Throws (and prints a setup recipe) when
 * --target=prod is selected without any credential source.
 */
export function initScriptAdmin(flags: BaseFlags): {db: Firestore; auth: Auth} {
  if (getApps().length === 0) {
    if (flags.target === 'emulator') {
      if (!process.env.FIRESTORE_EMULATOR_HOST) {
        process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      }
      if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
      }
      initializeApp({projectId: flags.project ?? DEFAULT_PROJECT_ID});
      console.log(
        `[init] emulator firestore=${process.env.FIRESTORE_EMULATOR_HOST} auth=${process.env.FIREBASE_AUTH_EMULATOR_HOST} project=${flags.project ?? DEFAULT_PROJECT_ID}`,
      );
    } else {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credPath) {
        const fs = require('fs') as typeof import('fs');
        const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        initializeApp({
          credential: cert(serviceAccount),
          projectId:
            flags.project ?? serviceAccount.project_id ?? DEFAULT_PROJECT_ID,
        });
        console.log(
          `[init] prod via service account ${credPath} project=${flags.project ?? serviceAccount.project_id ?? DEFAULT_PROJECT_ID}`,
        );
      } else {
        const projectId =
          flags.project ??
          process.env.GOOGLE_CLOUD_PROJECT ??
          process.env.GCLOUD_PROJECT ??
          DEFAULT_PROJECT_ID;
        preflightAdcCredentials();
        initializeApp({credential: applicationDefault(), projectId});
        console.log(
          `[init] prod via application-default-credentials project=${projectId}`,
        );
      }
    }
  }
  return {db: getFirestore(), auth: getAuth()};
}

/**
 * Fail fast with an actionable message if neither GOOGLE_APPLICATION_CREDENTIALS
 * nor a working ADC file exists.
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
