/**
 * P4.7 + P4.8 -- ZKid study Firestore hooks.
 *
 * Three hooks that power the Study Mission and Topic Learn screens:
 *   - useChildClassId: resolves the child's class from children/{uid}
 *   - useTodayAssignments: live subscription to today's active assignments
 *   - useTopicContent: one-shot fetch of a curriculum topic doc
 *
 * All hooks follow the same {data, loading, error} shape used throughout
 * the codebase (see apps/guardian/src/firebase/teacher.ts for the pattern).
 */

import {useEffect, useMemo, useState} from 'react';
import firestore from '@react-native-firebase/firestore';

const SCHOOL_TIMEZONE = 'Asia/Kolkata';

export interface HookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface ChildClassRef {
  schoolId: string;
  classId: string;
}

export function useChildClassId(uid: string | null): HookState<ChildClassRef> {
  const [state, setState] = useState<HookState<ChildClassRef>>({
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
      .collection('children')
      .doc(uid)
      .onSnapshot(
        snap => {
          if (!snap.exists) {
            setState({data: null, loading: false, error: null});
            return;
          }
          const data = snap.data() as {classId?: ChildClassRef};
          if (data.classId?.schoolId && data.classId?.classId) {
            setState({data: data.classId, loading: false, error: null});
          } else {
            setState({data: null, loading: false, error: null});
          }
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [uid]);

  return state;
}

export interface AssignmentCard {
  id: string;
  schoolId: string;
  classId: string;
  curriculumId: string;
  subjectName: string;
  chapterId: string;
  topicId: string;
  topicName: string;
  assignedDate: string;
  dueAt: number;
  status: 'active' | 'cancelled';
}

export function useTodayAssignments(
  classId: string | null,
): HookState<AssignmentCard[]> {
  const [state, setState] = useState<HookState<AssignmentCard[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!classId) {
      setState({data: null, loading: false, error: null});
      return;
    }
    setState(s => ({...s, loading: true}));
    const today = todayInSchoolTz();
    const unsub = firestore()
      .collection('studyAssignments')
      .where('classId', '==', classId)
      .where('assignedDate', '==', today)
      .onSnapshot(
        snap => {
          const rows = snap.docs
            .map(d => {
              const raw = d.data() as Omit<AssignmentCard, 'id'>;
              return {id: d.id, ...raw};
            })
            .filter(r => r.status === 'active');
          rows.sort((a, b) => b.dueAt - a.dueAt);
          setState({data: rows, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [classId]);

  return state;
}

export interface ChapterMeta {
  chapterNo: number;
  chapterName: string;
}

export function chapterMetaKey(
  curriculumId: string,
  chapterId: string,
): string {
  return `${curriculumId}:${chapterId}`;
}

/**
 * Live map of chapter metadata for today's assignments. Keyed by
 * `${curriculumId}:${chapterId}` so the Study Mission can show
 * "Ch 11. Force and Pressure" instead of prettified doc ids.
 */
export function useChapterMetaMap(
  assignments: AssignmentCard[] | null,
): HookState<Record<string, ChapterMeta>> {
  const [state, setState] = useState<HookState<Record<string, ChapterMeta>>>({
    data: null,
    loading: true,
    error: null,
  });

  const refsKey = useMemo(() => {
    if (!assignments?.length) return '';
    const keys = new Set<string>();
    for (const a of assignments) {
      keys.add(chapterMetaKey(a.curriculumId, a.chapterId));
    }
    return [...keys].sort().join('|');
  }, [assignments]);

  useEffect(() => {
    if (!refsKey) {
      setState({data: {}, loading: false, error: null});
      return;
    }

    const refs = refsKey.split('|').map(key => {
      const sep = key.indexOf(':');
      return {
        key,
        curriculumId: key.slice(0, sep),
        chapterId: key.slice(sep + 1),
      };
    });

    setState(s => ({...s, loading: true}));
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    for (const {key, curriculumId, chapterId} of refs) {
      const unsub = firestore()
        .collection('curriculum')
        .doc(curriculumId)
        .collection('chapters')
        .doc(chapterId)
        .onSnapshot(
          snap => {
            if (cancelled) return;
            setState(prev => {
              const next = {...(prev.data ?? {})};
              if (snap.exists) {
                const d = snap.data() as {
                  chapterNo?: number;
                  chapterName?: string;
                };
                if (
                  typeof d.chapterNo === 'number' &&
                  typeof d.chapterName === 'string' &&
                  d.chapterName.length > 0
                ) {
                  next[key] = {
                    chapterNo: d.chapterNo,
                    chapterName: d.chapterName,
                  };
                } else {
                  delete next[key];
                }
              } else {
                delete next[key];
              }
              return {data: next, loading: false, error: null};
            });
          },
          err => {
            if (cancelled) return;
            setState(prev => ({
              ...prev,
              loading: false,
              error: err.message,
            }));
          },
        );
      unsubs.push(unsub);
    }

    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
    };
  }, [refsKey]);

  return state;
}

export interface BrainstormingItem {
  question: string;
  answer: string;
  videoUrl?: string;
}

export interface QuizQuestion {
  questionId: string;
  type: 'mcq';
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface TopicContent {
  curriculumId: string;
  grade: number;
  subject: string;
  chapterNo: number;
  chapterName: string;
  topicId: string;
  topicName: string;
  explanation: string;
  examples: string[];
  videoUrl?: string;
  brainstorming: BrainstormingItem[];
  quiz: QuizQuestion[];
  status: 'draft' | 'published';
}

export function useTopicContent(
  curriculumId: string | null,
  chapterId: string | null,
  topicId: string | null,
): HookState<TopicContent> {
  const [state, setState] = useState<HookState<TopicContent>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!curriculumId || !chapterId || !topicId) {
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
      .doc(topicId)
      .onSnapshot(
        snap => {
          if (!snap.exists) {
            setState({data: null, loading: false, error: 'Topic not found.'});
            return;
          }
          setState({
            data: snap.data() as TopicContent,
            loading: false,
            error: null,
          });
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [curriculumId, chapterId, topicId]);

  return state;
}

function todayInSchoolTz(): string {
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
