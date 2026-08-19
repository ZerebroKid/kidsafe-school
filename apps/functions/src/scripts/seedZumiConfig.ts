/**
 * Seed (or update) the `appConfig/zumi` remote-config doc -- the Phase 0
 * switchboard every Zumi flag reads:
 *
 *   pipeline          kids app: "live" (LiveKit agent) | "legacy" (callables)
 *   sttProvider       agent: "sarvam" | "whisper"          (Phase 5)
 *   ttsProvider       agent: "kokoro-cpu" | "kokoro-gpu"   (Phase 6)
 *   moderationEnabled agent: input/output safety checks    (Phase 2)
 *   memoryEnabled     agent: last-session recall in intro  (Phase 3)
 *   dailyMinutesLimit zumiLiveKitToken: per-child daily quota, 0 = no limit
 *
 * Until this doc exists every reader falls back to code defaults -- which
 * notably means moderationEnabled=false (safety layer OFF). Seeding it is
 * what actually turns moderation on.
 *
 * Usage (from monorepo root):
 *   pnpm seed:zumi-config                              # dry-run, emulator
 *   pnpm seed:zumi-config -- --apply --target=prod     # write to prod
 *   pnpm seed:zumi-config -- --apply --target=prod --stt=whisper --tts=kokoro-gpu
 *
 * Provider flips can also be done by editing the doc in the Firebase console
 * (no deploy either way); this script just makes the change reviewable and
 * repeatable. Writes with merge, so unknown/extra fields already on the doc
 * survive.
 */

import {FieldValue} from 'firebase-admin/firestore';

import {initScriptAdmin, parseBaseFlags, type BaseFlags} from './lib/scriptInit';

const STT_PROVIDERS = ['sarvam', 'whisper'] as const;
const TTS_PROVIDERS = ['kokoro-cpu', 'kokoro-gpu'] as const;
const PIPELINES = ['live', 'legacy'] as const;

interface SeedFlags extends BaseFlags {
  pipeline: (typeof PIPELINES)[number];
  stt: (typeof STT_PROVIDERS)[number];
  tts: (typeof TTS_PROVIDERS)[number];
  moderation: boolean;
  memory: boolean;
  minutes: number;
}

function pick<T extends readonly string[]>(
  arg: string,
  name: string,
  allowed: T,
): T[number] {
  if (!(allowed as readonly string[]).includes(arg)) {
    throw new Error(`--${name} must be one of: ${allowed.join(', ')} (got '${arg}')`);
  }
  return arg as T[number];
}

function parseSeedFlags(argv: string[]): SeedFlags {
  const base = parseBaseFlags(argv);
  const flags: SeedFlags = {
    ...base,
    // Safe defaults = today's behavior, with safety + quota switched ON.
    pipeline: 'live',
    stt: 'sarvam',
    tts: 'kokoro-cpu',
    moderation: true,
    memory: true,
    minutes: 20,
  };
  for (const arg of argv) {
    if (arg.startsWith('--pipeline=')) {
      flags.pipeline = pick(arg.slice(11), 'pipeline', PIPELINES);
    } else if (arg.startsWith('--stt=')) {
      flags.stt = pick(arg.slice(6), 'stt', STT_PROVIDERS);
    } else if (arg.startsWith('--tts=')) {
      flags.tts = pick(arg.slice(6), 'tts', TTS_PROVIDERS);
    } else if (arg.startsWith('--minutes=')) {
      const n = Number(arg.slice(10));
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`--minutes must be a number >= 0 (0 = no limit)`);
      }
      flags.minutes = n;
    } else if (arg === '--no-moderation') {
      flags.moderation = false;
    } else if (arg === '--no-memory') {
      flags.memory = false;
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseSeedFlags(process.argv.slice(2));
  const {db} = initScriptAdmin(flags);

  const payload = {
    pipeline: flags.pipeline,
    sttProvider: flags.stt,
    ttsProvider: flags.tts,
    moderationEnabled: flags.moderation,
    memoryEnabled: flags.memory,
    dailyMinutesLimit: flags.minutes,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = db.collection('appConfig').doc('zumi');
  const snap = await ref.get();

  console.log(
    `[start] mode=${flags.apply ? 'APPLY' : 'DRY-RUN'} target=${flags.target}`,
  );
  console.log(`[plan] appConfig/zumi (${snap.exists ? 'update' : 'create'})`);
  if (snap.exists) {
    console.log('[plan] current:', JSON.stringify(snap.data()));
  }
  console.log(
    '[plan] writing:',
    JSON.stringify({...payload, updatedAt: '(server timestamp)'}),
  );

  if (!flags.apply) {
    console.log('[done] dry-run -- re-run with --apply to write');
    return;
  }

  if (flags.target === 'prod') {
    console.log('[apply] WAITING 5s before prod write -- Ctrl-C to abort');
    await new Promise(r => setTimeout(() => r(undefined), 5000));
  }

  await ref.set(payload, {merge: true});
  const after = await ref.get();
  console.log('[done] appConfig/zumi now:', JSON.stringify(after.data()));
}

if (require.main === module) {
  main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}

export {parseSeedFlags};
