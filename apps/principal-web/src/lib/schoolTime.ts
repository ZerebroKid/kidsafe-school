/*
 * Client-side school-timezone date helpers for the principal dashboards.
 *
 * The education stack anchors a "school day" to the school's local timezone
 * (Asia/Kolkata for the single-region pilot), so `assignedDate` on assignments
 * and the `date` on classReports are `YYYY-MM-DD` strings in IST -- NOT UTC.
 * These helpers let the dashboard compare against "today"/"this month" in the
 * same frame, regardless of the principal's browser timezone.
 *
 * Mirrors the server convention in apps/functions/src/lib/schoolTime.ts. When
 * the product goes multi-region the school doc will carry a `timezone` and
 * these will take it as an argument (they already accept `tz`).
 */

export const SCHOOL_TIMEZONE = 'Asia/Kolkata';

/** Format a Date as `YYYY-MM-DD` in the given IANA timezone. */
export function ymdInSchoolTz(
  date: Date = new Date(),
  tz: string = SCHOOL_TIMEZONE,
): string {
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

/** `YYYY-MM-DD` for now in the school timezone. */
export function todayYmdInSchoolTz(tz: string = SCHOOL_TIMEZONE): string {
  return ymdInSchoolTz(new Date(), tz);
}

/** `YYYY-MM` prefix for the current month in the school timezone. */
export function currentMonthPrefix(tz: string = SCHOOL_TIMEZONE): string {
  return todayYmdInSchoolTz(tz).slice(0, 7);
}

/**
 * Whole-day gap between a `YYYY-MM-DD` report date and today (school TZ).
 * Returns 0 for today, 1 for yesterday, etc. Used to label/flag stale reports.
 * Returns `null` for an unparseable input.
 */
export function daysAgoInSchoolTz(
  ymd: string,
  tz: string = SCHOOL_TIMEZONE,
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const today = todayYmdInSchoolTz(tz);
  // Parse both as UTC midnights so the subtraction is a clean day count
  // independent of the local clock (we only compare calendar dates).
  const a = Date.parse(`${ymd}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
