'use client';

import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {getAuthInstance, getFirestoreInstance} from '@zerebro/shared-firebase';

/*
 * Reverse-lookup helper: given the signed-in principal's uid, find the
 * school they are stamped onto (schools where principalUid == myUid).
 *
 * Returns {loading, schoolId, error}. Components render a loading state
 * until `loading=false`, then handle `schoolId=null` as "no school
 * assigned" (shouldn't happen post-P4.2.6 -- if it does, the (dashboard)
 * guard would have redirected away).
 *
 * Firestore auto-creates the equality-only index for `schools.principalUid`,
 * so no firestore/indexes.json entry is required.
 */

export interface OwnSchool {
  loading: boolean;
  schoolId: string | null;
  error: string | null;
}

export function useOwnSchool(): OwnSchool {
  const [state, setState] = useState<OwnSchool>({
    loading: true,
    schoolId: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(getAuthInstance(), async user => {
      if (cancelled) return;
      if (!user) {
        setState({loading: false, schoolId: null, error: 'Not signed in.'});
        return;
      }
      try {
        const snap = await getDocs(
          query(
            collection(getFirestoreInstance(), 'schools'),
            where('principalUid', '==', user.uid),
            limit(1),
          ),
        );
        if (cancelled) return;
        if (snap.empty) {
          setState({loading: false, schoolId: null, error: null});
        } else {
          setState({
            loading: false,
            schoolId: snap.docs[0]?.id ?? null,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            schoolId: null,
            error:
              (err as {message?: string} | null)?.message ?? 'Read failed.',
          });
        }
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return state;
}
