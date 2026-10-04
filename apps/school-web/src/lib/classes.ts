export function classLabel(grade: number, section: string): string {
  return grade === 0 ? `Nursery ${section}` : `${grade}${section}`;
}

export function compareClasses(
  a: {grade: number; section: string},
  b: {grade: number; section: string},
): number {
  if (a.grade !== b.grade) return a.grade - b.grade;
  return a.section.localeCompare(b.section);
}
