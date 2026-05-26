'use client';

import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {
  collectionGroup,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {getAuthInstance, getFirestoreInstance} from '@zerebro/shared-firebase';

/*
 * Reverse-lookup helper: given the signed-in principal's uid, find the
 * school they were approved onto.
 *
 * We resolve via the `principals` collection-GROUP (not a query against
 * `schools` filtered by `principalUid`). This is intentional and matters:
 *
 *   1. The cross-school rule at firestore/rules `/{path=**}/principals/{principalId}`
 *      allows ANY signed-in user to read their OWN principal doc
 *      (`resource.data.userId == myUid`). There is no `isPrincipal()`
 *      indirection, so it works the instant after `approvePrincipal`
 *      flips status to 'active' -- before the cached `users/{uid}` doc
 *      necessarily reflects the new `roles[]`.
 *
 *   2. The same pattern is already used by the (dashboard) layout guard
 *      to decide where to send a freshly-signed-in user; sharing it here
 *      means "if you can see the dashboard, you can see your schoolId".
 *
 *   3. The previous schools-collection query (where principalUid == myUid)
 *      depended on rules calling `belongsToSchool(schoolId)`, which itself
 *      issues TWO `get()` lookups during rule evaluation per matched doc.
 *      That double-get racing with role-propagation produced the silent
 *      empty result the user hit on /classes immediately post-approval.
 *
 * `schoolId` is derived from `claim.ref.parent.parent.id`
 *   = `schools/{schoolId}/principals/{principalId}` -> `schools/{schoolId}`.
 *
 * The composite index `principals: userId+status` is already deployed
 * (see firestore/indexes.json from the P4.2 chunk), so the AND filter
 * below does not need a fresh index build.
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
        const claims = await getDocs(
          query(
            collectionGroup(getFirestoreInstance(), 'principals'),
            where('userId', '==', user.uid),
            where('status', '==', 'active'),
            limit(1),
          ),
        );
        if (cancelled) return;
        const claim = claims.docs[0];
        const schoolId = claim?.ref.parent.parent?.id ?? null;
        setState({loading: false, schoolId, error: null});
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
