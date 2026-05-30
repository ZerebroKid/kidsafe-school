/**
 * P5.1 -- manual / backfill runner for the class-report aggregator.
 *
 * The nightly `aggregateClassReports` cron aggregates yesterday automatically;
 * this script drives the SAME core (`aggregateClassReportsForDate`) from a plain
 * Node process so you can backfill a past day, re-run an idempotent fix, or
 * produce "today" for the P5.1 acceptance check.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @zerebro/functions aggregate:reports                  # dry-run plan, emulator, yesterday(IST)
 *   pnpm --filter @zerebro/functions aggregate:reports -- --apply 2026-05-30
 *   pnpm --filter @zerebro/functions aggregate:reports -- --apply --target=prod 2026-05-30
 *
 * Date arg: first non-flag `YYYY-MM-DD` token in argv; defaults to
 * yesterday in the school timezone (matching the cron). Like the other scripts
 * it is dry-run unless `--apply` is passed.
 */

import {initScriptAdmin, parseBaseFlags} from './lib/scriptInit';
import {aggregateClassReportsForDate} from '../crons/aggregateClassReports';
import {SCHOOL_TIMEZONE, yesterdayYmdInTz} from '../lib/schoolTime';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateArg(argv: string[]): string {
  for (const arg of argv) {
    if (arg.startsWith('--')) continue;
    if (YMD_RE.test(arg)) return arg;
    throw new Error(`date arg must be YYYY-MM-DD, got '${arg}'`);
  }
  return yesterdayYmdInTz(Date.now(), SCHOOL_TIMEZONE);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flags = parseBaseFlags(argv);
  const date = parseDateArg(argv);
  const {db} = initScriptAdmin(flags);

  console.log(
    `[start] mode=${flags.apply ? 'APPLY' : 'DRY-RUN'} target=${flags.target} date=${date}`,
  );

  if (!flags.apply) {
    // The core always writes; in dry-run we just report what WOULD be scanned
    // by counting the source attempts without committing report docs.
    const snap = await db
      .collection('quizAttempts')
      .where('assignedDate', '==', date)
      .get();
    const classes = new Set(
      snap.docs
        .map(d => (d.data() as Record<string, unknown>).classId)
        .filter((c): c is string => typeof c === 'string'),
    );
    console.log(
      `[dry-run] date=${date} would scan attempts=${snap.docs.length} across classes=${classes.size}. Pass --apply to write classReports.`,
    );
    return;
  }

  if (flags.target === 'prod') {
    console.log('[apply] WAITING 5s before prod writes -- Ctrl-C to abort');
    await new Promise(r => setTimeout(r, 5000));
  }

  const result = await aggregateClassReportsForDate(db, date, {
    source: 'script',
  });
  console.log(
    `[done] date=${result.date} classesWritten=${result.classesWritten} attemptsScanned=${result.attemptsScanned}`,
  );
}

// Guard so importing this file (e.g. in tests) doesn't auto-run main().
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
