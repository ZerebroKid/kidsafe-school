// Lightweight runtime validators (no zod dep — keep this package zero-dep).
// Heavier schema validation (e.g. topic JSON) lives in shared-types/schemas/ in Phase 4.6.1.

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}
