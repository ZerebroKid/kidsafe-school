'use client';

import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {useCallback, useEffect, useState} from 'react';
import {Timestamp, doc, onSnapshot} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';

import {useOwnSchool} from '@/lib/ownSchool';

/*
 * P4.3 -- review one pending teacher request + approve/reject.
 *
 * Unlike admin-web/principals/[id], we do NOT use a composite
 * `schoolId__teacherId` URL because the principal is always reviewing
 * teachers under their OWN school. The route param is just teacherId; the
 * schoolId comes from useOwnSchool().
 *
 * Live read via onSnapshot so concurrent action by another principal
 * (rare but possible if two principals share an account during handover)
 * is reflected immediately.
 *
 * Both Approve and Reject are server-side callables. The callable enforces
 *   1. caller has 'principal' role,
 *   2. caller IS the principalUid of THIS school,
 *   3. teacher request status is currently 'pending',
 *   4. atomicity of the writes (teacher status + users.roles array-union).
 * So this UI is intentionally thin -- no client-side principal-of-school
 * check beyond what the layout guard already does for routing.
 */

interface TeacherDoc {
  userId?: string;
  displayName?: string;
  phone?: string;
  status?: 'pending' | 'active' | 'rejected';
  requestedAt?: Timestamp;
  approvedAt?: Timestamp;
  rejectedReason?: string;
}

export default function TeacherReviewPage() {
  const router = useRouter();
  const params = useParams<{id: string}>();
  const teacherId = params?.id ?? '';
  const own = useOwnSchool();

  const [teacher, setTeacher] = useState<TeacherDoc | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!own.schoolId || !teacherId) return;
    const unsub = onSnapshot(
      doc(
        getFirestoreInstance(),
        'schools',
        own.schoolId,
        'teachers',
        teacherId,
      ),
      snap =>
        setTeacher(snap.exists() ? (snap.data() as TeacherDoc) : null),
      err => setError(err.message),
    );
    return unsub;
  }, [own.schoolId, teacherId]);

  const handleApprove = useCallback(async () => {
    if (!own.schoolId || !teacherId) return;
    setBusy('approve');
    setError(null);
    try {
      await callFn<{schoolId: string; teacherId: string}, {ok: true}>(
        'approveTeacher',
        {schoolId: own.schoolId, teacherId},
      );
      router.replace('/teachers');
    } catch (err) {
      setError(
        (err as {message?: string} | null)?.message ?? 'Approval failed.',
      );
    } finally {
      setBusy(null);
    }
  }, [router, own.schoolId, teacherId]);

  const handleReject = useCallback(async () => {
    if (!own.schoolId || !teacherId) return;
    if (rejectReason.trim().length < 3) {
      setError('Please enter a short reason (at least 3 characters).');
      return;
    }
    setBusy('reject');
    setError(null);
    try {
      await callFn<
        {schoolId: string; teacherId: string; reason: string},
        {ok: true}
      >('rejectTeacher', {
        schoolId: own.schoolId,
        teacherId,
        reason: rejectReason.trim(),
      });
      router.replace('/teachers');
    } catch (err) {
      setError(
        (err as {message?: string} | null)?.message ?? 'Rejection failed.',
      );
    } finally {
      setBusy(null);
      setRejectOpen(false);
    }
  }, [router, own.schoolId, teacherId, rejectReason]);

  if (own.loading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (own.error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-danger/40 bg-danger/10 p-8 text-center"
      >
        <p className="text-sm font-medium text-danger">
          Could not load your school
        </p>
        <p className="mt-2 font-mono text-xs text-danger/80">{own.error}</p>
      </div>
    );
  }
  if (!own.schoolId) {
    return (
      <p className="text-sm text-text-muted">
        No school assigned to your account.
      </p>
    );
  }
  if (!teacherId) {
    return <p className="text-sm text-danger">Malformed URL.</p>;
  }
  if (teacher === undefined) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }
  if (teacher === null) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">Teacher request not found.</p>
        <Link
          href="/teachers"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          Back to teachers
        </Link>
      </div>
    );
  }

  const isPending = teacher.status === 'pending';

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Teacher request
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">
            {teacher.displayName ?? '—'}
          </h1>
          <p className="mt-1 font-mono text-sm text-text-muted">
            {teacher.phone ?? '—'}
          </p>
        </div>
        <Link
          href="/teachers"
          className="text-sm text-text-muted hover:text-text"
        >
          &larr; All teachers
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Status
          </p>
          <p className="mt-1 text-sm text-text capitalize">
            {teacher.status ?? '—'}
          </p>
          {teacher.status === 'rejected' && teacher.rejectedReason ? (
            <p className="mt-2 text-xs text-text-muted">
              Reason: {teacher.rejectedReason}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Requested
          </p>
          <p className="mt-1 text-sm text-text">
            {teacher.requestedAt
              ? teacher.requestedAt.toDate().toLocaleString()
              : '—'}
          </p>
        </div>
      </section>

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
          This request is no longer pending. No actions available.
        </p>
      )}

      {rejectOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => {
            if (e.target === e.currentTarget && busy !== 'reject')
              setRejectOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text">
              Reject this teacher?
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              The teacher sees the reason on their pending screen and can
              re-submit with a fresh code if you ask them to.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="text-text-muted">Reason</span>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. We don't recognise this teacher"
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
