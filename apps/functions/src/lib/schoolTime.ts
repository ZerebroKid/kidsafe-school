/**
 * School-timezone date helpers, shared by server code that needs to agree on
 * "which calendar day" an event belongs to.
 *
 * The education stack anchors a "school day" to the school's local timezone
 * (Asia/Kolkata for the single-region pilot) rather than UTC, so the student
 * "today's mission", the `assignedDate` on assignments/attempts, and the
 * nightly `aggregateClassReports` cron all line up on the same `YYYY-MM-DD`.
 *
 * When we go multi-region the school doc will gain a `timezone` field and these
 * helpers will take it as an argument (they already do) instead of the constant.
 */

/** Single-region pilot timezone. IANA name; no DST in modern history. */
export const SCHOOL_TIMEZONE = 'Asia/Kolkata';

/**
 * Format `date` as `YYYY-MM-DD` in the given IANA timezone. Uses
 * `Intl.DateTimeFormat` so DST / regional rules are correct without pulling a
 * dependency. The explicit `year/month/day` parts make the output independent
 * of the locale's default ordering.
 */
export function ymdInTz(date: Date, tz: string = SCHOOL_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

/** `YYYY-MM-DD` for `now` in the school timezone. */
export function todayYmdInTz(
  now: number = Date.now(),
  tz: string = SCHOOL_TIMEZONE,
): string {
  return ymdInTz(new Date(now), tz);
}

/**
 * `YYYY-MM-DD` for the day BEFORE `now` in the school timezone.
 *
 * Implemented by subtracting 24h and re-formatting rather than decrementing the
 * date string, so month/year boundaries are handled by the calendar. Safe in a
 * no-DST zone like IST; in a DST zone the 24h step can occasionally land on the
 * same local date around a transition, which is why this takes `tz` explicitly
 * for the eventual multi-region migration.
 */
export function yesterdayYmdInTz(
  now: number = Date.now(),
  tz: string = SCHOOL_TIMEZONE,
): string {
  return ymdInTz(new Date(now - 24 * 60 * 60 * 1000), tz);
}
