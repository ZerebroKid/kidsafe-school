'use client';

import {useCallback, useEffect, useState} from 'react';
import {
  Timestamp,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';

/*
 * Admin page: list all pending grade-change requests across schools.
 * Uses collectionGroup('gradeChangeRequests') with status=='pending'.
 * Approve/reject invoke the server-side callables.
 */

interface GradeRequestRow {
  id: string;
  schoolId: string;
  schoolName: string;
  currentGrades: number[];
  gradesToAdd: number[];
  gradesSections?: Record<string, number>;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt?: Timestamp;
}

export default function GradeRequestsPage() {
  const [rows, setRows] = useState<GradeRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<GradeRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collectionGroup(getFirestoreInstance(), 'gradeChangeRequests'),
        where('status', '==', 'pending'),
        orderBy('requestedAt', 'desc'),
      ),
      async snap => {
        const rawRows = snap.docs.map(d => {
          const data = d.data();
          const schoolId = d.ref.parent.parent?.id ?? '';
          return {
            id: d.id,
            schoolId,
            schoolName: '',
            currentGrades: [] as number[],
            gradesToAdd: (data.gradesToAdd ?? []) as number[],
            gradesSections: (data.gradesSections ?? undefined) as
              | Record<string, number>
              | undefined,
            status: (data.status ?? 'pending') as GradeRequestRow['status'],
            requestedAt: data.requestedAt as Timestamp | undefined,
          };
        });

        // Resolve school names and current grades in parallel
        const schoolIds = [...new Set(rawRows.map(r => r.schoolId))];
        const schoolMap = new Map<string, {name: string; activeGrades: number[]}>();
        await Promise.all(
          schoolIds.map(async sid => {
            try {
              const snap = await getDoc(
                doc(getFirestoreInstance(), 'schools', sid),
              );
              if (snap.exists()) {
                const data = snap.data();
                schoolMap.set(sid, {
                  name: (data.name as string) ?? sid,
                  activeGrades: Array.isArray(data.activeGrades)
                    ? (data.activeGrades as number[])
                    : [],
                });
              }
            } catch {
              // Ignore individual school read failures
            }
          }),
        );

        for (const row of rawRows) {
          const info = schoolMap.get(row.schoolId);
          if (info) {
            row.schoolName = info.name;
            row.currentGrades = info.activeGrades;
          }
        }

        setRows(rawRows);
        setError(null);
      },
      err => setError(err.message),
    );
    return unsub;
  }, []);

  const handleApprove = useCallback(
    async (row: GradeRequestRow) => {
      setBusy(row.id);
      setActionError(null);
      try {
        await callFn<{schoolId: string; requestId: string}, {ok: true}>(
          'approveGradeChange',
          {schoolId: row.schoolId, requestId: row.id},
        );
      } catch (err) {
        setActionError(
          (err as {message?: string} | null)?.message ?? 'Approval failed.',
        );
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      setActionError('Reason must be at least 3 characters.');
      return;
    }
    setBusy(rejectTarget.id);
    setActionError(null);
    try {
      await callFn<
        {schoolId: string; requestId: string; reason: string},
        {ok: true}
      >('rejectGradeChange', {
        schoolId: rejectTarget.schoolId,
        requestId: rejectTarget.id,
        reason: rejectReason.trim(),
      });
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      setActionError(
        (err as {message?: string} | null)?.message ?? 'Rejection failed.',
      );
    } finally {
      setBusy(null);
    }
  }, [rejectTarget, rejectReason]);

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Administration
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">
          Grade change requests
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Pending requests from principals to add new grades to their school.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {actionError}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            No pending grade change requests.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(row => (
            <div
              key={row.id}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-text">
                    {row.schoolName || row.schoolId}
                  </h2>
                  {row.currentGrades.length > 0 ? (
                    <p className="mt-1 text-xs text-text-muted">
                      Current grades:{' '}
                      {row.currentGrades.map(g => `Class ${g}`).join(', ')}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-text-muted">
                      No grades configured yet
                    </p>
                  )}
                </div>
                {row.requestedAt ? (
                  <span className="shrink-0 text-xs text-text-muted">
                    {(row.requestedAt as Timestamp).toDate?.()
                      ? (row.requestedAt as Timestamp)
                          .toDate()
                          .toLocaleDateString()
                      : ''}
                  </span>
                ) : null}
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
                  Requesting to add
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {row.gradesToAdd.map(g => {
                    const sections = row.gradesSections?.[String(g)];
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
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRejectTarget(row);
                    setRejectReason('');
                    setActionError(null);
                  }}
                  disabled={busy !== null}
                  className="rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(row)}
                  disabled={busy !== null}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-60"
                >
                  {busy === row.id ? 'Approving…' : 'Approve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => {
            if (e.target === e.currentTarget && busy === null) {
              setRejectTarget(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text">
              Reject grade request?
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {rejectTarget.schoolName || rejectTarget.schoolId} wants to add{' '}
              {rejectTarget.gradesToAdd.map(g => `Class ${g}`).join(', ')}.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="text-text-muted">Reason</span>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Content not available for these grades yet"
                disabled={busy !== null}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={busy !== null}
                className="rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={busy !== null || rejectReason.trim().length < 3}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy === rejectTarget.id ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
