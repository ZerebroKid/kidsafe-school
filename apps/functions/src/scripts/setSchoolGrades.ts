/**
 * One-time script to set activeGrades and auto-create class section docs
 * for an existing school that was created before the grade-configuration
 * feature shipped.
 *
 * Usage:
 *   pnpm tsx src/scripts/setSchoolGrades.ts -- \
 *     --schoolId=<id> \
 *     --grades='{"1":2,"2":2,"3":2,"4":2,"5":2,"6":2,"7":2,"8":2}' \
 *     --target=prod --apply
 *
 * The `--grades` flag takes a JSON string mapping grade -> section count.
 * The script is idempotent: it skips classes whose className already exists.
 */

import {FieldValue} from 'firebase-admin/firestore';
import {initScriptAdmin, parseBaseFlags} from './lib/scriptInit';

interface ScriptFlags {
  schoolId?: string;
  grades?: Record<string, number>;
}

function parseScriptFlags(argv: string[]): ScriptFlags {
  const out: ScriptFlags = {};
  for (const arg of argv) {
    if (arg.startsWith('--schoolId=')) {
      out.schoolId = arg.slice('--schoolId='.length);
    } else if (arg.startsWith('--grades=')) {
      try {
        out.grades = JSON.parse(arg.slice('--grades='.length));
      } catch {
        throw new Error('--grades must be valid JSON, e.g. \'{"1":2,"8":1}\'');
      }
    }
  }
  return out;
}

const SECTION_LETTERS = 'ABCDEFGHIJ';

function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 5 ? y : y - 1;
  const end = (start + 1) % 100;
  return `${start}-${end.toString().padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const base = parseBaseFlags(process.argv.slice(2));
  const flags = parseScriptFlags(process.argv.slice(2));

  if (!flags.schoolId || !flags.grades) {
    console.error(
      'Usage: pnpm tsx src/scripts/setSchoolGrades.ts -- ' +
        "--schoolId=<id> --grades='{\"1\":2}' [--target=prod] [--apply]",
    );
    process.exit(1);
  }

  const {db} = initScriptAdmin(base);
  const schoolRef = db.collection('schools').doc(flags.schoolId);
  const schoolSnap = await schoolRef.get();

  if (!schoolSnap.exists) {
    console.error(`[fatal] School ${flags.schoolId} not found.`);
    process.exit(1);
  }

  const activeGrades = Object.keys(flags.grades)
    .map(Number)
    .sort((a, b) => a - b);

  console.log(`[plan] Set activeGrades = [${activeGrades.join(', ')}]`);

  const academicYear = currentAcademicYear();
  const classesRef = schoolRef.collection('classes');
  const existingSnap = await classesRef.get();
  const existingNames = new Set(
    existingSnap.docs.map(d => d.data().className as string),
  );

  const toCreate: Array<{grade: number; section: string; className: string}> =
    [];
  for (const [gradeStr, sectionCount] of Object.entries(flags.grades)) {
    const grade = Number(gradeStr);
    const count = Math.min(sectionCount, SECTION_LETTERS.length);
    for (let i = 0; i < count; i++) {
      const section = SECTION_LETTERS[i];
      const className = `${grade}${section}`;
      if (existingNames.has(className)) {
        console.log(`[skip] ${className} already exists`);
      } else {
        toCreate.push({grade, section, className});
      }
    }
  }

  console.log(`[plan] Create ${toCreate.length} class docs (skip ${existingNames.size} existing)`);
  for (const c of toCreate) {
    console.log(`  + ${c.className}`);
  }

  if (!base.apply) {
    console.log('[done] dry-run -- no writes. Re-run with --apply.');
    return;
  }

  await schoolRef.update({activeGrades});
  console.log('[write] activeGrades updated on school doc');

  for (const c of toCreate) {
    await classesRef.add({
      grade: c.grade,
      section: c.section,
      className: c.className,
      academicYear,
      teacherIds: [],
      studentChildUids: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`[write] created ${c.className}`);
  }

  console.log('[done] all writes committed.');
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
