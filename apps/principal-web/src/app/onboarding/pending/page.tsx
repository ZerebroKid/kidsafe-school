'use client';

import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useState} from 'react';
import {Timestamp, doc, onSnapshot} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

/*
 * P4.2.5 -- "Waiting for verification" screen.
 *
 * Subscribes to schools/{schoolId}/principals/{principalId} live. When the
 * admin calls `approvePrincipal`:
 *   1. principals/{principalId}.status flips from 'pending' to 'active'
 *   2. schools/{id}.principalUid gets stamped with the principal's uid
 *   3. users/{principalUid}.roles += 'principal'
 * All in a single transaction, so when our onSnapshot listener fires with
 * status=active, the user already holds the principal role and the
 * (dashboard) guard will let them through. We just need to nudge the route.
 *
 * If the admin rejects, status -> 'rejected' and we show the reason with a
 * button back to /onboarding so the principal can request a fresh code.
 */

interface PrincipalDoc {
  status: 'pending' | 'active' | 'rejected';
  rejectedReason?: string;
  approvedAt?: Timestamp;
}

export default function PendingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const schoolId = params.get('schoolId');
  const principalId = params.get('principalId');

  const [data, setData] = useState<PrincipalDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !principalId) {
      router.replace('/onboarding');
      return;
    }
    const ref = doc(
      getFirestoreInstance(),
      'schools',
      schoolId,
      'principals',
      principalId,
    );
    const unsub = onSnapshot(
      ref,
      snap => {
        setData(snap.exists() ? (snap.data() as PrincipalDoc) : null);
        setError(null);
      },
      err => setError(err.message),
    );
    return unsub;
  }, [router, schoolId, principalId]);

  // Auto-redirect on approval. Tiny delay so the user briefly sees a
  // "Approved -- redirecting" state rather than an abrupt jump.
  useEffect(() => {
    if (data?.status === 'active') {
      const t = setTimeout(() => router.replace('/subscription'), 600);
      return () => clearTimeout(t);
    }
    return;
  }, [data?.status, router]);

  return (
    <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-lg">
      <p className="text-xs uppercase tracking-widest text-text-muted">
        Zerebro Campus
      </p>

      {data === undefined ? (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-text">Loading…</h1>
        </>
      ) : data === null ? (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-text">
            Claim not found
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            We could not load your claim. Submit the invite code again.
          </p>
          <button
            type="button"
            onClick={() => router.replace('/onboarding')}
            className="mt-4 rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text"
          >
            Back to onboarding
          </button>
        </>
      ) : data.status === 'pending' ? (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-text">
            Waiting for verification
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Your claim has been submitted. A Zerebro administrator will review
            and approve your access shortly. This page will refresh
            automatically -- you can leave it open or come back later.
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-md bg-surface-alt px-3 py-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs text-text-muted">Listening for approval…</span>
          </div>
        </>
      ) : data.status === 'active' ? (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-text">
            Approved!
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Redirecting you to subscription…
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-text">
            Request declined
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {data.rejectedReason ??
              'Your claim was not approved. Contact your admin for a fresh code.'}
          </p>
          <button
            type="button"
            onClick={() => router.replace('/onboarding')}
            className="mt-4 rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text"
          >
            Try again
          </button>
        </>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
