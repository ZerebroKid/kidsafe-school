/**
 * P4.5 -- ZConnect teacher mode Firestore hooks.
 *
 * Thin onSnapshot wrappers used by the teacher Home + Assign screens.
 * Every hook follows the same shape: `{data, loading, error}` where
 * `data === null` means "still loading", `data === []` (or `data === undefined`
 * for single docs) means "loaded, empty", and `error` carries the underlying
 * FirestoreError message.
 *
 * Why hooks instead of one-off snapshots inside each screen:
 *   - Cascading pickers (class -> subject -> chapter -> topic) need to
 *     re-subscribe whenever the previous level's selection changes. A
 *     hook makes the dependency contract explicit via useEffect deps.
 *   - The Assign screen + Home screen share `useTeacherActiveSchool`
 *     (same source-of-truth for "which school am I a teacher in").
 *
 * Reads from these collections REQUIRE the firestore/rules predicates:
 *   - schools/{id}/teachers/{id} (cross-school self-read; rule at top of
 *     firestore/rules permits `resource.data.userId == myUid()`).
 *   - schools/{id}/classes where teacherIds contains myUid (rule allows
 *     `isTeacher() && myUid() in resource.data.teacherIds`).
 *   - curriculum/{id} -- any signed-in user can read (grade-based lookup).
 *   - curriculum/{id}/chapters/{id}/topics -- any signed-in user can read.
 *   - studyAssignments where assignedByTeacherUid == myUid -- per the
 *     P4.5.1 rule update.
 *
 * Indexes required (already added in firestore/indexes.json P4.5):
 *   - studyAssignments (assignedByTeacherUid ASC, assignedDate DESC).
 */

import {useEffect, useState} from 'react';
import firestore from '@react-native-firebase/firestore';

const SCHOOL_TIMEZONE = 'Asia/Kolkata';

export interface HookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface TeacherActiveSchool {
  schoolId: string;
  teacherId: string;
  displayName?: string;
}

/**
 * Resolve the (single) school the caller is an active teacher of, via the
 * cross-school `collectionGroup('teachers')` rule. Limits to 1 because the
 * MVP only supports a teacher belonging to ONE school at a time -- when we
 * extend to multi-school teachers we'll widen this to return an array and
 * add a school-selector to the teacher home.
 */
export function useTeacherActiveSchool(
  uid: string | null,
): HookState<TeacherActiveSchool> {
  const [state, setState] = useState<HookState<TeacherActiveSchool>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!uid) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collectionGroup('teachers')
      .where('userId', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .onSnapshot(
        snap => {
          const docSnap = snap.docs[0];
          if (!docSnap) {
            setState({data: null, loading: false, error: null});
            return;
          }
          const schoolId = docSnap.ref.parent.parent?.id;
          if (!schoolId) {
            setState({
              data: null,
              loading: false,
              error: 'Teacher record has no parent school.',
            });
            return;
          }
          const data = docSnap.data() as {displayName?: string};
          setState({
            data: {
              schoolId,
              teacherId: docSnap.id,
              ...(data.displayName ? {displayName: data.displayName} : {}),
            },
            loading: false,
            error: null,
          });
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [uid]);

  return state;
}

export interface ClassRow {
  id: string;
  grade: number;
  section: string;
  className: string;
  academicYear?: string;
  teacherIds: string[];
  subjectTeachers?: Record<string, string>;
}

export function useTeacherClasses(
  schoolId: string | null,
  uid: string | null,
): HookState<ClassRow[]> {
  const [state, setState] = useState<HookState<ClassRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!schoolId || !uid) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('schools')
      .doc(schoolId)
      .collection('classes')
      .where('teacherIds', 'array-contains', uid)
      .onSnapshot(
        snap => {
          const rows = snap.docs.map(d => {
            const data = d.data() as Omit<ClassRow, 'id'>;
            return {id: d.id, ...data};
          });
          // Stable sort: grade asc, then section asc. Firestore won't sort
          // for us without an index, and there's no value in adding one
          // for the typical "5-10 classes per teacher" payload.
          rows.sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [schoolId, uid]);

  return state;
}

export interface CurriculumRow {
  id: string;
  subject: string;
  board: string;
  grade: number;
}

/**
 * Fetch all curricula for a given grade from the global `curriculum`
 * collection. Replaces the old per-class `subjects` subcollection --
 * curriculum is universal across schools and sections.
 */
export function useCurriculaForGrade(
  grade: number | null,
): HookState<CurriculumRow[]> {
  const [state, setState] = useState<HookState<CurriculumRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (grade == null) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('curriculum')
      .where('grade', '==', grade)
      .onSnapshot(
        snap => {
          const rows = snap.docs.map(d => {
            const data = d.data() as Omit<CurriculumRow, 'id'>;
            return {id: d.id, ...data};
          });
          rows.sort((a, b) => a.subject.localeCompare(b.subject));
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [grade]);

  return state;
}

export interface ChapterRow {
  id: string;
  chapterNo: number;
  chapterName: string;
  status: 'draft' | 'published';
}

export function useChaptersForCurriculum(
  curriculumId: string | null,
): HookState<ChapterRow[]> {
  const [state, setState] = useState<HookState<ChapterRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!curriculumId) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('curriculum')
      .doc(curriculumId)
      .collection('chapters')
      .where('status', '==', 'published')
      .onSnapshot(
        snap => {
          const rows = snap.docs.map(d => {
            const data = d.data() as Omit<ChapterRow, 'id'>;
            return {id: d.id, ...data};
          });
          rows.sort((a, b) => a.chapterNo - b.chapterNo);
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [curriculumId]);

  return state;
}

export interface TopicRow {
  id: string;
  topicName: string;
  status: 'draft' | 'published';
}

const TOPIC_ORDER_PREFIX = /^(\d+)\.\s*/;

/** Parse leading "N. " from curated topic names (e.g. "3. Product Law"). */
export function parseTopicOrder(topicName: string): number | null {
  const match = TOPIC_ORDER_PREFIX.exec(topicName);
  return match ? Number.parseInt(match[1], 10) : null;
}

/** Sort topics 1, 2, 3… not 1, 10, 11, 2 (plain string sort). */
export function compareTopicOrder(
  a: {topicName: string; id?: string},
  b: {topicName: string; id?: string},
): number {
  const orderA = parseTopicOrder(a.topicName);
  const orderB = parseTopicOrder(b.topicName);
  if (orderA != null && orderB != null && orderA !== orderB) {
    return orderA - orderB;
  }
  if (orderA != null && orderB == null) return -1;
  if (orderA == null && orderB != null) return 1;
  const byName = a.topicName.localeCompare(b.topicName);
  if (byName !== 0) return byName;
  return (a.id ?? '').localeCompare(b.id ?? '');
}

export function usePublishedTopics(
  curriculumId: string | null,
  chapterId: string | null,
): HookState<TopicRow[]> {
  const [state, setState] = useState<HookState<TopicRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!curriculumId || !chapterId) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('curriculum')
      .doc(curriculumId)
      .collection('chapters')
      .doc(chapterId)
      .collection('topics')
      .where('status', '==', 'published')
      .onSnapshot(
        snap => {
          const rows = snap.docs.map(d => {
            const data = d.data() as {topicName?: string; status?: string};
            return {
              id: d.id,
              topicName: data.topicName ?? d.id,
              status: (data.status as 'draft' | 'published') ?? 'draft',
            };
          });
          rows.sort(compareTopicOrder);
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [curriculumId, chapterId]);

  return state;
}

export interface AssignmentRow {
  id: string;
  schoolId: string;
  classId: string;
  curriculumId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  assignedDate: string;
  dueAt: number;
  status: 'active' | 'cancelled';
}

/**
 * Today's assignments by the caller. We filter by `assignedByTeacherUid`
 * + `assignedDate` (today in school TZ) and order DESC by `assignedDate`
 * for forward-compat when we add a "next N days" widget. Requires the
 * studyAssignments composite index added in P4.5.
 */
export function useTeacherAssignmentsToday(
  uid: string | null,
): HookState<AssignmentRow[]> {
  const [state, setState] = useState<HookState<AssignmentRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!uid) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const today = todayInSchoolTz();
    const unsub = firestore()
      .collection('studyAssignments')
      .where('assignedByTeacherUid', '==', uid)
      .where('assignedDate', '==', today)
      .onSnapshot(
        snap => {
          const rows = snap.docs
            .map(d => {
              const data = d.data() as Omit<AssignmentRow, 'id'>;
              return {id: d.id, ...data};
            })
            .filter(r => r.status === 'active');
          rows.sort((a, b) => b.dueAt - a.dueAt);
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [uid]);

  return state;
}

export interface WeakTopic {
  topicId: string;
  topicName: string;
  subjectName: string;
  avgBestPercentage: number;
}

export interface ClassWeakTopics {
  classId: string;
  className: string;
  topics: WeakTopic[];
}

/**
 * P5.4 -- weak topics across all classes the caller teaches, for the home
 * "Re-teach" callout.
 *
 * Reads the cron-written pointer docs `classReports/{classId}` via a single
 * `teacherIds array-contains uid` query. firestore/rules allows this for a
 * teacher because every returned doc carries them in `teacherIds`; the
 * array-contains uses the automatic single-field index (no composite). Classes
 * with an empty `weakTopics` list are dropped so the callout only shows
 * actionable rows.
 */
export function useTeacherWeakTopics(
  uid: string | null,
): HookState<ClassWeakTopics[]> {
  const [state, setState] = useState<HookState<ClassWeakTopics[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!uid) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('classReports')
      .where('teacherIds', 'array-contains', uid)
      .onSnapshot(
        snap => {
          const rows: ClassWeakTopics[] = [];
          for (const d of snap.docs) {
            const data = d.data() as {
              classId?: string;
              className?: string;
              weakTopics?: Array<{
                topicId?: string;
                topicName?: string;
                subjectName?: string;
                avgBestPercentage?: number;
              }>;
            };
            const topics: WeakTopic[] = Array.isArray(data.weakTopics)
              ? data.weakTopics.map(t => ({
                  topicId: typeof t.topicId === 'string' ? t.topicId : '',
                  topicName:
                    typeof t.topicName === 'string'
                      ? t.topicName
                      : (t.topicId ?? ''),
                  subjectName:
                    typeof t.subjectName === 'string' ? t.subjectName : '',
                  avgBestPercentage:
                    typeof t.avgBestPercentage === 'number'
                      ? t.avgBestPercentage
                      : 0,
                }))
              : [];
            if (topics.length === 0) continue;
            rows.push({
              classId: data.classId ?? d.id,
              className: data.className ?? data.classId ?? d.id,
              topics,
            });
          }
          rows.sort((a, b) => a.className.localeCompare(b.className));
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [uid]);

  return state;
}

/**
 * `YYYY-MM-DD` today in the school's local TZ. Mirrors the server-side
 * helper in `apps/functions/src/callable/assignTopic.ts` so the client
 * and server agree on the same calendar day.
 */
export function todayInSchoolTz(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

/**
 * Default `dueAt` for new assignments: today 23:59 in the school TZ.
 * Returned as epoch ms in UTC so it can be sent straight to the
 * `assignTopic` callable.
 */
export function defaultDueAtEpochMs(): number {
  const ymd = todayInSchoolTz();
  // Construct a Date in the school's TZ at 23:59:00, then convert to UTC ms.
  // `new Date('2026-05-28T23:59:00+05:30')` works because the offset is
  // hard-coded (Asia/Kolkata never had DST in modern history). If we ever
  // ship in a region with DST we'll swap this for a small TZ library.
  const isoLocal = `${ymd}T23:59:00+05:30`;
  return new Date(isoLocal).getTime();
}
