/**
 * Firestore hooks for the Reels feed.
 *
 * `useReelsFeed(grade)` fetches active reels for the child's grade, then
 * builds a randomized, interleaved feed (2 topic : 1 fun) biased away from
 * recently-seen items via an MMKV ring buffer.
 */

import {useEffect, useMemo, useState} from 'react';
import firestore from '@react-native-firebase/firestore';
import {MMKV} from 'react-native-mmkv';

import type {ReelDoc} from '@zerebro/shared-types';

export interface HookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const reelsStorage = new MMKV({id: 'kidsafe.reels'});
const SEEN_KEY = 'reels.seen';
const MAX_SEEN = 50;

function getRecentlySeen(): string[] {
  const raw = reelsStorage.getString(SEEN_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function markSeen(reelId: string) {
  const seen = getRecentlySeen();
  const filtered = seen.filter(id => id !== reelId);
  filtered.push(reelId);
  if (filtered.length > MAX_SEEN) filtered.splice(0, filtered.length - MAX_SEEN);
  reelsStorage.set(SEEN_KEY, JSON.stringify(filtered));
}

/**
 * Fisher-Yates shuffle with a bias: recently-seen items are pushed toward the
 * end of the array so the child sees fresh content first.
 */
function weightedShuffle(items: ReelDoc[], recentlySeen: Set<string>): ReelDoc[] {
  const fresh: ReelDoc[] = [];
  const stale: ReelDoc[] = [];
  for (const item of items) {
    if (recentlySeen.has(item.reelId)) {
      stale.push(item);
    } else {
      fresh.push(item);
    }
  }
  shuffle(fresh);
  shuffle(stale);
  return [...fresh, ...stale];
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Interleave topic and fun reels at a ~2:1 ratio. If either pool runs out,
 * append the remainder.
 */
function interleave(topics: ReelDoc[], funs: ReelDoc[]): ReelDoc[] {
  const result: ReelDoc[] = [];
  let ti = 0;
  let fi = 0;
  while (ti < topics.length || fi < funs.length) {
    if (ti < topics.length) result.push(topics[ti++]);
    if (ti < topics.length) result.push(topics[ti++]);
    if (fi < funs.length) result.push(funs[fi++]);
  }
  return result;
}

/**
 * Live subscription to active reels for a grade. Builds a randomized,
 * de-duplicated, interleaved feed on each load.
 */
export function useReelsFeed(grade: number | null): HookState<ReelDoc[]> {
  const [raw, setRaw] = useState<ReelDoc[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (grade === null) {
      setRaw(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = firestore()
      .collection('reelsCatalog')
      .where('active', '==', true)
      .where('gradeBand', 'array-contains', grade)
      .onSnapshot(
        snap => {
          const docs = snap.docs.map(d => d.data() as ReelDoc);
          setRaw(docs);
          setLoading(false);
          setError(null);
        },
        err => {
          setError(err.message);
          setLoading(false);
        },
      );
    return unsub;
  }, [grade]);

  const feed = useMemo(() => {
    if (!raw) return null;
    const seen = new Set(getRecentlySeen());
    const topics = weightedShuffle(
      raw.filter(r => r.kind === 'topic'),
      seen,
    );
    const funs = weightedShuffle(
      raw.filter(r => r.kind === 'fun'),
      seen,
    );
    return interleave(topics, funs);
  }, [raw]);

  return {data: feed, loading, error};
}
