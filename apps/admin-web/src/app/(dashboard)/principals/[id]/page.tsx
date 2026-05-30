'use client';

import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';

/*
 * P4.2.7 -- pending principal claim detail + approve/reject actions.
 *
 * The route param is the composite `schoolId__principalId`. The page resolves
 * both halves, live-reads the principal doc, and lets the admin Approve or
 * Reject (with a reason). The status is reactive: if another admin approves
 * concurrently, the buttons disappear and the page shows the current state.
 *
 * Both approve + reject are server-side callables (P4.2.6). The callable
 * enforces admin role, status-must-be-pending, and atomicity of the writes
 * -- this UI is intentionally thin (no client-side admin check beyond what
 * the layout guard already does).
 */

interface PrincipalDoc {
  userId?: string;
  displayName?: string;
  phone?: string;
  status?: 'pending' | 'active' | 'rejected';
  requestedAt?: Timestamp;
  approvedAt?: Timestamp;
  rejectedReason?: string;
  requestedGrades?: number[];
  requestedGradeSections?: Record<string, number>;
  requestedClassSubjects?: Array<{classId: string; curriculumId: string}>;
}

interface SchoolDoc {
  name?: string;
  city?: string;
  inviteCode?: string;
}

export default function PrincipalReviewPage() {
  const router = useRouter();
  const params = useParams<{id: string}>();
  const composite = params?.id ?? '';
  const [schoolId, principalId] = useMemo(() => {
    const idx = composite.indexOf('__');
    if (idx === -1) return ['', ''];
    return [composite.slice(0, idx), composite.slice(idx + 2)];
  }, [composite]);

  const [principal, setPrincipal] = useState<PrincipalDoc | null | undefined>(undefined);
  const [school, setSchool] = useState<SchoolDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!schoolId || !principalId) return;
    const unsub = onSnapshot(
      doc(
        getFirestoreInstance(),
        'schools',
        schoolId,
        'principals',
        principalId,
      ),
      snap => setPrincipal(snap.exists() ? (snap.data() as PrincipalDoc) : null),
      err => setError(err.message),
    );
    return unsub;
  }, [schoolId, principalId]);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    getDoc(doc(getFirestoreInstance(), 'schools', schoolId))
      .then(snap => {
        if (!cancelled) setSchool(snap.exists() ? (snap.data() as SchoolDoc) : null);
      })
      .catch(() => {
        // School read failures are non-fatal for the review page; show the
        // ids only.
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const handleApprove = useCallback(async () => {
    if (!schoolId || !principalId) return;
    setBusy('approve');
    setError(null);
    try {
      await callFn<{schoolId: string; principalId: string}, {ok: true}>(
        'approvePrincipal',
        {schoolId, principalId},
      );
      router.replace('/principals');
    } catch (err) {
      setError(
        (err as {message?: string} | null)?.message ?? 'Approval failed.',
      );
    } finally {
      setBusy(null);
    }
  }, [router, schoolId, principalId]);

  const handleReject = useCallback(async () => {
    if (!schoolId || !principalId) return;
    if (rejectReason.trim().length < 3) {
      setError('Please enter a short reason (at least 3 characters).');
      return;
    }
    setBusy('reject');
    setError(null);
    try {
      await callFn<
        {schoolId: string; principalId: string; reason: string},
        {ok: true}
      >('rejectPrincipal', {
        schoolId,
        principalId,
        reason: rejectReason.trim(),
      });
      router.replace('/principals');
    } catch (err) {
      setError(
        (err as {message?: string} | null)?.message ?? 'Rejection failed.',
      );
    } finally {
      setBusy(null);
      setRejectOpen(false);
    }
  }, [router, schoolId, principalId, rejectReason]);

  if (!schoolId || !principalId) {
    return (
      <p className="text-sm text-danger">
        Malformed URL. Expected /principals/{'{schoolId}__{principalId}'}.
      </p>
    );
  }
  if (principal === undefined) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }
  if (principal === null) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">Principal claim not found.</p>
        <Link
          href="/principals"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          Back to pending list
        </Link>
      </div>
    );
  }

  const isPending = principal.status === 'pending';

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Principal claim
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">
            {principal.displayName ?? '—'}
          </h1>
          <p className="mt-1 font-mono text-sm text-text-muted">
            {principal.phone ?? '—'}
          </p>
        </div>
        <Link
          href="/principals"
          className="text-sm text-text-muted hover:text-text"
        >
          &larr; All pending
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            School
          </p>
          <p className="mt-1 text-sm text-text">{school?.name ?? schoolId}</p>
          {school?.city ? (
            <p className="text-xs text-text-muted">{school.city}</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Status
          </p>
          <p className="mt-1 text-sm text-text capitalize">
            {principal.status ?? '—'}
          </p>
          {principal.status === 'rejected' && principal.rejectedReason ? (
            <p className="mt-2 text-xs text-text-muted">
              Reason: {principal.rejectedReason}
            </p>
          ) : null}
        </div>
      </section>

      {principal.requestedGrades && principal.requestedGrades.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Requested grades &amp; sections
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...principal.requestedGrades]
              .sort((a, b) => a - b)
              .map(g => {
                const sections = principal.requestedGradeSections?.[String(g)];
                return (
                  <span
                    key={g}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    Class {g}{sections ? ` (${sections} section${sections > 1 ? 's' : ''})` : ''}
                  </span>
                );
              })}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            On approval these grades become the school&apos;s active curriculum
            and class sections (e.g. 1A, 1B) are auto-created.
          </p>
        </section>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {isPending ? (
        <section className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={busy !== null}
            className="rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy !== null}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-60"
          >
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
        </section>
      ) : (
        <p className="text-sm text-text-muted">
          This claim is no longer pending. No actions available.
        </p>
      )}

      {rejectOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => {
            if (e.target === e.currentTarget && busy !== 'reject') setRejectOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text">Reject this claim?</h2>
            <p className="mt-1 text-sm text-text-muted">
              The principal sees the reason on their pending screen and can
              re-claim with a fresh code.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="text-text-muted">Reason</span>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. We don't recognise this school"
                disabled={busy === 'reject'}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                disabled={busy === 'reject'}
                className="rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={busy === 'reject' || rejectReason.trim().length < 3}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
