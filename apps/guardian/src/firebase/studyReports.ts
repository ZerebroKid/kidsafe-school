/**
 * P4.11 -- ZConnect study report Firestore hooks (parent + teacher).
 *
 * Same `{data, loading, error}` + `onSnapshot` contract as `teacher.ts`:
 *   - `data === null` means "still loading"
 *   - `data === []` / `{}` means "loaded, empty"
 *   - `error` carries the FirestoreError message
 *
 * All ordering is done CLIENT-SIDE so these queries only ever filter by
 * equality -- that keeps them servable by single-field indexes and dodges
 * "missing composite index" surprises (the one composite we do rely on for
 * the teacher query lives in firestore/indexes.json).
 *
 * Reads here satisfy the firestore/rules predicates exactly so "rules are not
 * filters" never bites us:
 *   - quizAttempts (parent): `isOwnChild(childUid)` -> we filter childUid == X.
 *   - quizAttempts (teacher): `assignedByTeacherUid == myUid()` -> we filter
 *     assignedByTeacherUid == teacherUid AND classId == X.
 *   - rewardUnlocks (parent/child): read by `childUid` -> we filter childUid.
 *   - users/{uid}: any signed-in user may read -> name lookup is allowed.
 *   - schools/{id}/classes/{id}: teacher in `teacherIds` may read.
 */

import {useEffect, useMemo, useState} from 'react';
import firestore from '@react-native-firebase/firestore';

import {todayInSchoolTz, useTeacherActiveSchool} from './teacher';

export interface HookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Subset of QuizAttemptDoc the report UIs render. */
export interface QuizAttemptRow {
  id: string;
  assignmentId: string;
  classId: string;
  childUid: string;
  topicName: string;
  chapterName: string;
  subjectName: string;
  lastPercentage: number;
  bestPercentage: number;
  passed: boolean;
  attemptCount: number;
  assignedDate: string;
  /** epoch ms (Firestore Timestamp coerced) -- used for "latest attempt" sort. */
  updatedAtMs: number;
}

/** Subset of RewardUnlockDoc the report UIs render. */
export interface RewardUnlockRow {
  id: string;
  attemptId: string;
  childUid: string;
  rewardType: string;
  rewardTitle: string;
  rewardUrl: string;
}

function coerceMs(value: unknown): number {
  // Firestore Timestamp has toMillis(); serverTimestamp sentinel may briefly
  // be null on the local echo. Fall back to 0 so sorting is still stable.
  if (value && typeof (value as {toMillis?: unknown}).toMillis === 'function') {
    return (value as {toMillis: () => number}).toMillis();
  }
  if (typeof value === 'number') return value;
  return 0;
}

function mapAttempt(id: string, d: Record<string, unknown>): QuizAttemptRow {
  return {
    id,
    assignmentId: typeof d.assignmentId === 'string' ? d.assignmentId : '',
    classId: typeof d.classId === 'string' ? d.classId : '',
    childUid: typeof d.childUid === 'string' ? d.childUid : '',
    topicName: typeof d.topicName === 'string' ? d.topicName : '',
    chapterName: typeof d.chapterName === 'string' ? d.chapterName : '',
    subjectName: typeof d.subjectName === 'string' ? d.subjectName : '',
    lastPercentage:
      typeof d.lastPercentage === 'number' ? d.lastPercentage : 0,
    bestPercentage:
      typeof d.bestPercentage === 'number' ? d.bestPercentage : 0,
    passed: d.passed === true,
    attemptCount: typeof d.attemptCount === 'number' ? d.attemptCount : 0,
    assignedDate: typeof d.assignedDate === 'string' ? d.assignedDate : '',
    updatedAtMs: coerceMs(d.updatedAt),
  };
}

/**
 * Parent view: a linked child's quiz attempts, filtered to today's school day.
 * One attempt doc per (assignment, child), so this is naturally compact.
 */
export function useChildQuizAttempts(
  childUid: string | null,
): HookState<QuizAttemptRow[]> {
  const [state, setState] = useState<HookState<QuizAttemptRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!childUid) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const today = todayInSchoolTz();
    const unsub = firestore()
      .collection('quizAttempts')
      .where('childUid', '==', childUid)
      .onSnapshot(
        snap => {
          const rows = snap.docs
            .map(doc => mapAttempt(doc.id, doc.data() as Record<string, unknown>))
            .filter(r => r.assignedDate === today)
            .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [childUid]);

  return state;
}

/**
 * Parent view: ALL of a linked child's quiz attempts (no date filter), sorted
 * desc by `updatedAt`. Same single-field `childUid` query as the today hook --
 * the today subset and subject grouping are derived client-side, so one
 * listener feeds both the Today and Overall scopes of the Study tab.
 */
export function useChildQuizAttemptsAll(
  childUid: string | null,
): HookState<QuizAttemptRow[]> {
  const [state, setState] = useState<HookState<QuizAttemptRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!childUid) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('quizAttempts')
      .where('childUid', '==', childUid)
      .onSnapshot(
        snap => {
          const rows = snap.docs
            .map(doc => mapAttempt(doc.id, doc.data() as Record<string, unknown>))
            .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [childUid]);

  return state;
}

/** Parent view: a linked child's reward unlocks (all-time; small set). */
export function useChildRewardUnlocks(
  childUid: string | null,
): HookState<RewardUnlockRow[]> {
  const [state, setState] = useState<HookState<RewardUnlockRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!childUid) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('rewardUnlocks')
      .where('childUid', '==', childUid)
      .onSnapshot(
        snap => {
          const rows = snap.docs.map(doc => {
            const d = doc.data() as Record<string, unknown>;
            return {
              id: doc.id,
              attemptId: typeof d.attemptId === 'string' ? d.attemptId : '',
              childUid: typeof d.childUid === 'string' ? d.childUid : '',
              rewardType:
                typeof d.rewardType === 'string' ? d.rewardType : 'youtube_link',
              rewardTitle:
                typeof d.rewardTitle === 'string' ? d.rewardTitle : 'Reward',
              rewardUrl: typeof d.rewardUrl === 'string' ? d.rewardUrl : '',
            } satisfies RewardUnlockRow;
          });
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [childUid]);

  return state;
}

/** Teacher view: the class roster (student child uids). */
export function useClassRoster(
  schoolId: string | null,
  classId: string | null,
): HookState<string[]> {
  const [state, setState] = useState<HookState<string[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!schoolId || !classId) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('schools')
      .doc(schoolId)
      .collection('classes')
      .doc(classId)
      .onSnapshot(
        snap => {
          const data = snap.data() as {studentChildUids?: unknown} | undefined;
          const roster = Array.isArray(data?.studentChildUids)
            ? data!.studentChildUids.filter(
                (u): u is string => typeof u === 'string',
              )
            : [];
          setState({data: roster, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [schoolId, classId]);

  return state;
}

/**
 * Resolve display names for a set of child uids from `users/*`. Names are
 * effectively static, so a one-shot chunked read (max 10 per `in` query) is
 * cheaper than N live listeners. Re-runs when the roster set changes.
 */
export function useStudentNames(
  childUids: string[] | null,
): HookState<Record<string, string>> {
  const [state, setState] = useState<HookState<Record<string, string>>>({
    data: null,
    loading: true,
    error: null,
  });

  // Stable key so the effect only re-runs when the actual set changes.
  const key = (childUids ?? []).slice().sort().join('|');

  useEffect(() => {
    const uids = key ? key.split('|') : [];
    if (uids.length === 0) {
      setState({data: {}, loading: false, error: null});
      return;
    }
    let cancelled = false;
    setState(s => ({...s, loading: true}));

    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += 10) {
      chunks.push(uids.slice(i, i + 10));
    }

    Promise.all(
      chunks.map(chunk =>
        firestore()
          .collection('users')
          .where(firestore.FieldPath.documentId(), 'in', chunk)
          .get(),
      ),
    )
      .then(snaps => {
        if (cancelled) return;
        const names: Record<string, string> = {};
        for (const snap of snaps) {
          for (const doc of snap.docs) {
            const d = doc.data() as {displayName?: unknown; name?: unknown};
            const name =
              (typeof d.displayName === 'string' && d.displayName) ||
              (typeof d.name === 'string' && d.name) ||
              '';
            if (name) names[doc.id] = name;
          }
        }
        setState({data: names, loading: false, error: null});
      })
      .catch(err => {
        if (cancelled) return;
        setState({data: null, loading: false, error: err.message});
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}

/**
 * Teacher view: quiz attempts for a class, scoped to topics THIS teacher
 * assigned. Both filters are equalities matching the firestore/rules teacher
 * predicate, so every returned doc is readable. Backed by the
 * (assignedByTeacherUid, classId) composite index.
 */
export function useClassQuizAttempts(
  classId: string | null,
  teacherUid: string | null,
): HookState<QuizAttemptRow[]> {
  const [state, setState] = useState<HookState<QuizAttemptRow[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!classId || !teacherUid) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const unsub = firestore()
      .collection('quizAttempts')
      .where('assignedByTeacherUid', '==', teacherUid)
      .where('classId', '==', classId)
      .onSnapshot(
        snap => {
          const rows = snap.docs
            .map(doc => mapAttempt(doc.id, doc.data() as Record<string, unknown>))
            .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [classId, teacherUid]);

  return state;
}

/** One row per roster student joined to their most-recent attempt. */
export interface ClassStudentRow {
  childUid: string;
  name: string;
  /** Most-recent attempt for this student, or null if they haven't attempted. */
  latest: QuizAttemptRow | null;
}

/**
 * Composed teacher hook: resolves the active school, class roster, student
 * names, and this-teacher's attempts, then joins them into per-student rows
 * (sorted by name). Shared by the class report + the full student list screen
 * so both stay in sync from a single source of truth.
 */
export function useClassStudentRows(
  classId: string | null,
  teacherUid: string | null,
): {rows: ClassStudentRow[]; loading: boolean; error: string | null} {
  const schoolState = useTeacherActiveSchool(teacherUid);
  const rosterState = useClassRoster(schoolState.data?.schoolId ?? null, classId);
  const namesState = useStudentNames(rosterState.data);
  const attemptsState = useClassQuizAttempts(classId, teacherUid);

  // Latest attempt per student (attempts already sorted desc by updatedAt).
  const latestByChild = useMemo(() => {
    const map = new Map<string, QuizAttemptRow>();
    for (const a of attemptsState.data ?? []) {
      if (!map.has(a.childUid)) map.set(a.childUid, a);
    }
    return map;
  }, [attemptsState.data]);

  const rows = useMemo<ClassStudentRow[]>(() => {
    const names = namesState.data ?? {};
    return (rosterState.data ?? [])
      .map(childUid => ({
        childUid,
        name: names[childUid] || 'Student',
        latest: latestByChild.get(childUid) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rosterState.data, namesState.data, latestByChild]);

  const loading =
    (schoolState.loading && !schoolState.data) ||
    (rosterState.loading && !rosterState.data) ||
    (attemptsState.loading && !attemptsState.data);

  const error = schoolState.error || rosterState.error || attemptsState.error;

  return {rows, loading, error};
}
