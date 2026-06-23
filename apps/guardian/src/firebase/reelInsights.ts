/**
 * P-Reels — ZConnect Firestore hooks for reel insight data.
 *
 * Same `{data, loading, error}` pattern as `studyReports.ts`.
 *   - `useChildReelInsights(childUid)` — last 7 days of daily watch-time rollups
 *   - `useReelTopics()` — all reel topic docs (for parent questions)
 */

import {useEffect, useState} from 'react';
import firestore from '@react-native-firebase/firestore';

import type {ReelInsightDoc, ReelTopicDoc} from '@zerebro/shared-types';
import {formatDateKey} from '@zerebro/shared-firebase/firestore';

export interface HookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Live subscription to the most recent 7 days of `reelInsights` docs for a
 * linked child. Mirrors the `subscribeUsageWeek` pattern.
 */
export function useChildReelInsights(
  childUid: string | null,
): HookState<ReelInsightDoc[]> {
  const [state, setState] = useState<HookState<ReelInsightDoc[]>>({
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

    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startKey = formatDateKey(start);

    const unsub = firestore()
      .collection('children')
      .doc(childUid)
      .collection('reelInsights')
      .where('date', '>=', startKey)
      .orderBy('date')
      .onSnapshot(
        snap => {
          const docs = snap.docs.map(d => d.data() as ReelInsightDoc);
          setState({data: docs, loading: false, error: null});
        },
        err => setState({data: null, loading: false, error: err.message}),
      );
    return unsub;
  }, [childUid]);

  return state;
}

/**
 * One-shot fetch of all reel topic docs. Topics are admin-seeded and rarely
 * change, so a single get() is preferred over a live listener.
 */
export function useReelTopics(): HookState<Record<string, ReelTopicDoc>> {
  const [state, setState] = useState<HookState<Record<string, ReelTopicDoc>>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    firestore()
      .collection('reelTopics')
      .get()
      .then(snap => {
        if (cancelled) return;
        const map: Record<string, ReelTopicDoc> = {};
        for (const doc of snap.docs) {
          const data = doc.data() as ReelTopicDoc;
          map[data.topicTag] = data;
        }
        setState({data: map, loading: false, error: null});
      })
      .catch(err => {
        if (cancelled) return;
        setState({data: null, loading: false, error: err.message});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
