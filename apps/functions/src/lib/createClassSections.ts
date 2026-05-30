/**
 * Shared helper to auto-create class section docs under a school.
 *
 * Used by `approvePrincipal` (initial onboarding) and `approveGradeChange`
 * (later grade additions). Creates one `classes/{autoId}` doc per section
 * with alphabetical section names (A, B, C...).
 */

import {FieldValue} from 'firebase-admin/firestore';
import type {DocumentReference, Transaction} from 'firebase-admin/firestore';

const SECTION_LETTERS = 'ABCDEFGHIJ';

/**
 * Compute the Indian academic year string (e.g. "2026-27") from the current
 * date. Indian academic year starts in June -- before June we're still in
 * the prior year's session.
 */
export function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 5 ? y : y - 1;
  const end = (start + 1) % 100;
  return `${start}-${end.toString().padStart(2, '0')}`;
}

/**
 * Validate a grade-sections map. Keys must be stringified integers 1-12,
 * values must be integers 1-10. Returns a cleaned map or null if invalid.
 */
export function validateGradeSections(
  raw: unknown,
): Record<string, number> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const grade = Number(key);
    if (
      !Number.isInteger(grade) ||
      grade < 1 ||
      grade > 12 ||
      typeof val !== 'number' ||
      !Number.isInteger(val) ||
      val < 1 ||
      val > 10
    ) {
      return null;
    }
    result[String(grade)] = val;
  }
  if (Object.keys(result).length === 0) return null;
  return result;
}

/**
 * Extract sorted grade numbers from a grade-sections map.
 */
export function gradesFromSections(
  sections: Record<string, number>,
): number[] {
  return Object.keys(sections)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * Create class section docs under `schoolRef/classes/` inside a transaction.
 * For each grade in `gradesSections`, creates N docs with section names
 * A, B, C...
 */
export function createClassSections(
  tx: Transaction,
  schoolRef: DocumentReference,
  gradesSections: Record<string, number>,
  academicYear: string,
): void {
  const classesRef = schoolRef.collection('classes');

  for (const [gradeStr, sectionCount] of Object.entries(gradesSections)) {
    const grade = Number(gradeStr);
    const count = Math.min(sectionCount, SECTION_LETTERS.length);
    for (let i = 0; i < count; i++) {
      const section = SECTION_LETTERS[i];
      const className = `${grade}${section}`;
      const docRef = classesRef.doc();
      tx.create(docRef, {
        grade,
        section,
        className,
        academicYear,
        teacherIds: [],
        studentChildUids: [],
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
}
