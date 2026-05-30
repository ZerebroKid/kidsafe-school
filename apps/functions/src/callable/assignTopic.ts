/**
 * P4.5.1 -- teacher assigns a curated topic to a class.
 *
 * Inputs: {schoolId, classId, curriculumId, chapterId, topicId, dueAt}
 *
 * Validation chain (each step has a distinct HttpsError):
 *   1. `requireAuth` + `requireRole(uid, 'teacher')` -- caller must hold
 *      the teacher role on `users/{uid}.roles[]`.
 *   2. Input shape (string ids + finite-number `dueAt`).
 *   3. `dueAt` is in the future AND <= now + 30 days. Past dueAts would
 *      mean the assignment is overdue the second it's created; >30d in
 *      the future is almost certainly a typo (year typo, month/day swap).
 *   4. School exists AND has an active principal -- `principalUid != null`.
 *      A school without a principal isn't fully set up, so it can't have
 *      meaningful teacher class memberships either.
 *   5. The caller has an ACTIVE `teachers/{uid}` doc under this school
 *      (cross-school collectionGroup query, pre-transaction because
 *      Firestore doesn't allow query operations inside `runTransaction`).
 *   6. Class exists AND `teacherIds array-contains caller.uid`. Belt +
 *      braces: requireRole proves the caller is *a* teacher; teacherIds
 *      proves they're a teacher of *this* class.
 *   7. Curriculum exists -- the global `curriculum/{curriculumId}` doc
 *      (same for all schools). Captures `subject` for denormalisation.
 *   8. Topic exists AND `status == 'published'`. Captures `topicName`.
 *   9. No active assignment already exists at the deterministic doc id
 *      `{classId}_{topicId}_{assignedDate}` (hard-block per the P4.5 plan).
 *      A stale `status='cancelled'` doc with the same id may be overwritten.
 *
 * On success, writes `studyAssignments/{deterministicId}` in a transaction
 * and returns `{assignmentId, alreadyExisted: false}`. The `alreadyExisted`
 * field is reserved for a future `force=true` override path; the production
 * callable always returns `false`.
 *
 * Why `assignedDate` lives in the school's TZ (Asia/Kolkata):
 *   The student-facing UI ("today's mission") is anchored to the kid's
 *   local school day, not UTC. Using `Asia/Kolkata` keeps the date stable
 *   for the MVP (single-region pilot). When we go multi-region the school
 *   doc will gain a `timezone` field and we'll derive `assignedDate` from
 *   that -- the deterministic doc id format absorbs the change cleanly.
 *
 * Error contract:
 *   - unauthenticated      -> caller not signed in
 *   - permission-denied    -> caller doesn't hold 'teacher' OR not in class.teacherIds OR not active in this school
 *   - invalid-argument     -> inputs missing/wrong type OR dueAt out of bounds
 *   - failed-precondition  -> school missing/unset principal OR topic not published OR duplicate assignment today
 *   - not-found            -> class / curriculum / topic doc doesn't exist
 *   - internal             -> Firestore write failed; user can retry.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth, requireRole} from '../lib/auth';
import type {AssignTopicInput, AssignTopicOutput} from '../lib/sharedTypes';

/** Hard cap on how far ahead `dueAt` may be (30 days in ms). */
const MAX_DUE_AT_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tiny `dueAt` underflow tolerance. The client computes "today 23:59" in
 * its own timezone; clock skew between the device and the server can push
 * that value a couple of seconds into the past at the moment the callable
 * runs. Allowing 60s of slack keeps a punctual teacher from getting
 * "due date in the past" on the last-second click.
 */
const DUE_AT_PAST_TOLERANCE_MS = 60 * 1000;

const SCHOOL_TIMEZONE = 'Asia/Kolkata';

export const assignTopic = onCall<AssignTopicInput, Promise<AssignTopicOutput>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'teacher');

    const {schoolId, classId, curriculumId, chapterId, topicId, dueAt} =
      request.data ?? ({} as Partial<AssignTopicInput>);

    if (
      typeof schoolId !== 'string' ||
      schoolId.length === 0 ||
      typeof classId !== 'string' ||
      classId.length === 0 ||
      typeof curriculumId !== 'string' ||
      curriculumId.length === 0 ||
      typeof chapterId !== 'string' ||
      chapterId.length === 0 ||
      typeof topicId !== 'string' ||
      topicId.length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'schoolId, classId, curriculumId, chapterId, and topicId are required.',
      );
    }

    if (typeof dueAt !== 'number' || !Number.isFinite(dueAt)) {
      throw new HttpsError(
        'invalid-argument',
        'dueAt must be a number (epoch milliseconds).',
      );
    }

    const now = Date.now();
    if (dueAt < now - DUE_AT_PAST_TOLERANCE_MS) {
      throw new HttpsError(
        'invalid-argument',
        'Due date cannot be in the past.',
      );
    }
    if (dueAt > now + MAX_DUE_AT_AHEAD_MS) {
      throw new HttpsError(
        'invalid-argument',
        'Due date cannot be more than 30 days in the future.',
      );
    }

    // ---- Pre-transaction resolution -------------------------------------
    // Firestore transactions can only run point GETs, never queries. So we
    // resolve the teacher's school-membership doc via a collectionGroup
    // query FIRST, then carry the resulting path into the transaction. The
    // transaction re-reads the same doc so a concurrent revoke is still
    // safe (the tx-read sees the canonical state at commit time).
    const teacherMatches = await db()
      .collectionGroup('teachers')
      .where('userId', '==', caller.uid)
      .where('status', '==', 'active')
      .get();
    let teacherSchoolMatch: {schoolId: string; teacherId: string; displayName?: string} | null =
      null;
    for (const docSnap of teacherMatches.docs) {
      const parentSchool = docSnap.ref.parent.parent;
      if (parentSchool?.id === schoolId) {
        const d = docSnap.data() as {displayName?: string};
        teacherSchoolMatch = {
          schoolId: parentSchool.id,
          teacherId: docSnap.id,
          displayName: d.displayName,
        };
        break;
      }
    }
    if (!teacherSchoolMatch) {
      throw new HttpsError(
        'permission-denied',
        'You are not an active teacher of this school.',
      );
    }

    const schoolRef = db().collection('schools').doc(schoolId);
    const classRef = schoolRef.collection('classes').doc(classId);
    const curriculumRef = db().collection('curriculum').doc(curriculumId);
    const teacherRef = schoolRef.collection('teachers').doc(teacherSchoolMatch.teacherId);

    // assignedDate is "today" in the school's TZ. Format: YYYY-MM-DD.
    const assignedDate = formatYmdInTz(new Date(now), SCHOOL_TIMEZONE);
    const deterministicId = `${classId}_${topicId}_${assignedDate}`;
    const assignmentRef = db()
      .collection('studyAssignments')
      .doc(deterministicId);

    await db().runTransaction(async tx => {
      const [schoolSnap, classSnap, curriculumSnap, teacherSnap, assignmentSnap] =
        await Promise.all([
          tx.get(schoolRef),
          tx.get(classRef),
          tx.get(curriculumRef),
          tx.get(teacherRef),
          tx.get(assignmentRef),
        ]);

      if (!schoolSnap.exists) {
        throw new HttpsError('not-found', 'School not found.');
      }
      const school = schoolSnap.data() ?? {};
      if (!school.principalUid) {
        throw new HttpsError(
          'failed-precondition',
          'School is not fully set up (no active principal).',
        );
      }

      if (!teacherSnap.exists) {
        throw new HttpsError('permission-denied', 'Teacher record not found.');
      }
      const teacher = teacherSnap.data() ?? {};
      if (teacher.status !== 'active') {
        throw new HttpsError(
          'permission-denied',
          `Teacher status is ${teacher.status}, not active.`,
        );
      }

      if (!classSnap.exists) {
        throw new HttpsError('not-found', 'Class not found.');
      }
      const classData = classSnap.data() ?? {};
      const teacherIds: string[] = Array.isArray(classData.teacherIds)
        ? classData.teacherIds.filter(
            (t: unknown): t is string => typeof t === 'string',
          )
        : [];
      if (!teacherIds.includes(caller.uid)) {
        throw new HttpsError(
          'permission-denied',
          'You are not assigned to teach this class.',
        );
      }

      // Subject-level check: if subjectTeachers is set on the class,
      // enforce that this teacher owns the specific subject (curriculum).
      const subjectTeachers =
        classData.subjectTeachers &&
        typeof classData.subjectTeachers === 'object'
          ? (classData.subjectTeachers as Record<string, string>)
          : {};
      const subjectOwner = subjectTeachers[curriculumId];
      if (subjectOwner && subjectOwner !== caller.uid) {
        throw new HttpsError(
          'permission-denied',
          'You are not assigned to teach this subject in this class.',
        );
      }

      if (!curriculumSnap.exists) {
        throw new HttpsError('not-found', 'Curriculum not found.');
      }
      const curriculum = curriculumSnap.data() ?? {};
      const subjectName =
        typeof curriculum.subject === 'string' ? curriculum.subject : curriculumId;

      const topicRef = db()
        .collection('curriculum')
        .doc(curriculumId)
        .collection('chapters')
        .doc(chapterId)
        .collection('topics')
        .doc(topicId);
      const topicSnap = await tx.get(topicRef);
      if (!topicSnap.exists) {
        throw new HttpsError(
          'not-found',
          'Topic not found in curriculum -- has it been imported?',
        );
      }
      const topic = topicSnap.data() ?? {};
      if (topic.status !== 'published') {
        throw new HttpsError(
          'failed-precondition',
          'Topic is not published yet -- ask admin to publish it first.',
        );
      }
      const topicName =
        typeof topic.topicName === 'string' ? topic.topicName : topicId;

      // Hard-block duplicate: an active assignment at this deterministic
      // id means a same-day re-assign attempt for the same (class, topic).
      // A stale cancelled doc is fine to overwrite.
      if (assignmentSnap.exists) {
        const existing = assignmentSnap.data() ?? {};
        if (existing.status === 'active') {
          throw new HttpsError(
            'failed-precondition',
            'This topic is already assigned to this class today.',
          );
        }
      }

      tx.set(
        assignmentRef,
        {
          id: deterministicId,
          schoolId,
          classId,
          curriculumId,
          subjectName,
          chapterId,
          topicId,
          topicName,
          assignedByTeacherUid: caller.uid,
          ...(teacherSchoolMatch?.displayName
            ? {assignedByTeacherDisplayName: teacherSchoolMatch.displayName}
            : {}),
          assignedDate,
          assignedAt: FieldValue.serverTimestamp(),
          dueAt,
          status: 'active',
        },
        {merge: true},
      );
    });

    return {assignmentId: deterministicId, alreadyExisted: false};
  },
);

/**
 * Format `date` as `YYYY-MM-DD` in the given IANA TZ. Uses
 * `Intl.DateTimeFormat` so DST / regional rules are correct without
 * pulling a dependency. `en-CA` locale happens to emit ISO-8601 by
 * default; the explicit parts are belt-and-braces.
 */
function formatYmdInTz(date: Date, tz: string): string {
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
