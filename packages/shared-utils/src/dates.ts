// Date helpers used across apps. Real implementations fill in as needed.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function daysBetween(a: number, b: number): number {
  return Math.floor(Math.abs(b - a) / ONE_DAY_MS);
}
