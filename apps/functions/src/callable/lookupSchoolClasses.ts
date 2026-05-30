/**
 * Lightweight read-only callable that validates a teacher code and returns the
 * school's class list along with available curricula and existing subject
 * assignments. The teacher calls this BEFORE `requestTeacherJoin` so they can
 * pick which class(es) and subject(s) they teach.
 *
 * Auth: caller must be signed in (phone-OTP). No role requirement -- the
 * teacher doesn't have any role yet at this stage.
 *
 * Error contract:
 *   - unauthenticated   -> caller not signed in
 *   - invalid-argument  -> teacherCode missing or no matching school
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';

interface Input {
  teacherCode: string;
}

interface ClassSummary {
  id: string;
  className: string;
  grade: number;
  section: string;
  /** curriculumId -> teacherUid. Shows which subjects already have a teacher. */
  subjectTeachers: Record<string, string>;
}

interface CurriculumSummary {
  id: string;
  subject: string;
  grade: number;
  board: string;
}

interface Output {
  schoolId: string;
  schoolName: string;
  classes: ClassSummary[];
  curricula: CurriculumSummary[];
}

export const lookupSchoolClasses = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    requireAuth(request);
    const {teacherCode} = request.data ?? {};

    if (typeof teacherCode !== 'string' || teacherCode.trim().length === 0) {
      throw new HttpsError(
        'invalid-argument',
        'Code is incorrect or has been rotated.',
      );
    }

    const normCode = teacherCode.trim().toUpperCase();
    const matches = await db()
      .collection('schools')
      .where('teacherCode', '==', normCode)
      .limit(1)
      .get();

    if (matches.empty) {
      throw new HttpsError(
        'invalid-argument',
        'Code is incorrect or has been rotated.',
      );
    }

    const schoolSnap = matches.docs[0];
    if (!schoolSnap) {
      throw new HttpsError(
        'invalid-argument',
        'Code is incorrect or has been rotated.',
      );
    }

    const schoolData = schoolSnap.data() ?? {};
    const schoolName =
      typeof schoolData.name === 'string' ? schoolData.name : '';

    // Fetch classes
    const classesSnap = await schoolSnap.ref.collection('classes').get();
    const grades = new Set<number>();

    const classes: ClassSummary[] = classesSnap.docs.map(d => {
      const data = d.data();
      const grade = typeof data.grade === 'number' ? data.grade : 0;
      grades.add(grade);
      const subjectTeachers: Record<string, string> =
        data.subjectTeachers && typeof data.subjectTeachers === 'object'
          ? (data.subjectTeachers as Record<string, string>)
          : {};
      return {
        id: d.id,
        className: typeof data.className === 'string' ? data.className : '',
        grade,
        section: typeof data.section === 'string' ? data.section : '',
        subjectTeachers,
      };
    });

    classes.sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));

    // Fetch curricula for all grades present in the school's classes
    const curricula: CurriculumSummary[] = [];
    if (grades.size > 0) {
      const gradeArr = Array.from(grades);
      // Firestore 'in' supports up to 30 values
      const currSnap = await db()
        .collection('curriculum')
        .where('grade', 'in', gradeArr.slice(0, 30))
        .get();
      for (const d of currSnap.docs) {
        const data = d.data();
        curricula.push({
          id: d.id,
          subject: typeof data.subject === 'string' ? data.subject : '',
          grade: typeof data.grade === 'number' ? data.grade : 0,
          board: typeof data.board === 'string' ? data.board : '',
        });
      }
      curricula.sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));
    }

    return {schoolId: schoolSnap.id, schoolName, classes, curricula};
  },
);
