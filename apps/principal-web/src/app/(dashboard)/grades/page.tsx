'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';

import {useOwnSchool} from '@/lib/ownSchool';

/*
 * Manage Grades page -- shows the school's active grades and lets the
 * principal request additional grades (admin-approved).
 */

const ALL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface GradeRequest {
  id: string;
  gradesToAdd: number[];
  status: 'pending' | 'approved' | 'rejected';
  requestedAt?: Timestamp;
  rejectedReason?: string;
}

export default function ManageGradesPage() {
  const own = useOwnSchool();
  const [requests, setRequests] = useState<GradeRequest[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [newGrades, setNewGrades] = useState<number[]>([]);
  const [newSectionCounts, setNewSectionCounts] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeGrades = own.activeGrades ?? [];

  // Available grades for the "request more" modal: grades not already active
  // and not in any pending request.
  const pendingGrades = useMemo(() => {
    const pending = new Set<number>();
    for (const r of requests) {
      if (r.status === 'pending') {
        for (const g of r.gradesToAdd) pending.add(g);
      }
    }
    return pending;
  }, [requests]);

  const availableForRequest = useMemo(
    () => ALL_GRADES.filter(g => !activeGrades.includes(g) && !pendingGrades.has(g)),
    [activeGrades, pendingGrades],
  );

  useEffect(() => {
    if (!own.schoolId) return;
    const unsub = onSnapshot(
      query(
        collection(
          getFirestoreInstance(),
          'schools',
          own.schoolId,
          'gradeChangeRequests',
        ),
        orderBy('requestedAt', 'desc'),
      ),
      snap => {
        setRequests(
          snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<GradeRequest, 'id'>),
          })),
        );
        setRequestsError(null);
      },
      err => {
        // Permissions error on an empty subcollection is expected before
        // the updated Firestore rules are deployed -- treat as empty.
        setRequests([]);
        setRequestsError(null);
        console.warn('gradeChangeRequests read failed:', err.message);
      },
    );
    return unsub;
  }, [own.schoolId]);

  const toggleNewGrade = useCallback((g: number) => {
    setNewGrades(prev => {
      if (prev.includes(g)) {
        setNewSectionCounts(c => {
          const next = {...c};
          delete next[g];
          return next;
        });
        return prev.filter(x => x !== g);
      }
      setNewSectionCounts(c => ({...c, [g]: 1}));
      return [...prev, g];
    });
  }, []);

  const handleRequestSubmit = useCallback(async () => {
    if (!own.schoolId || newGrades.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const gradesSections: Record<string, number> = {};
      for (const g of newGrades) {
        gradesSections[String(g)] = newSectionCounts[g] ?? 1;
      }
      await callFn<
        {
          schoolId: string;
          gradesToAdd: number[];
          gradesSections: Record<string, number>;
        },
        {requestId: string; status: 'pending'}
      >('requestGradeChange', {
        schoolId: own.schoolId,
        gradesToAdd: [...newGrades].sort((a, b) => a - b),
        gradesSections,
      });
      setModalOpen(false);
      setNewGrades([]);
      setNewSectionCounts({});
    } catch (err) {
      setSubmitError(
        (err as {message?: string} | null)?.message ?? 'Request failed.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [own.schoolId, newGrades, newSectionCounts]);

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
        No school assigned to your account yet.
      </p>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-text-muted">
          School configuration
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">Grades</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage which grades your school teaches. Adding new grades requires
          admin approval.
        </p>
      </header>

      {/* Active grades */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-text-muted">
          Active grades
        </h2>
        {activeGrades.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeGrades.map(g => (
              <span
                key={g}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
              >
                Class {g}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-muted">
            No grades configured yet. Request grades below to get started.
          </p>
        )}

        {availableForRequest.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setModalOpen(true);
              setNewGrades([]);
              setNewSectionCounts({});
              setSubmitError(null);
            }}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text"
          >
            Request more grades
          </button>
        ) : null}
      </section>

      {/* Grade change requests history */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-text-muted">
          Grade change requests
        </h2>
        {requestsError ? (
          <p className="mt-3 text-sm text-danger">{requestsError}</p>
        ) : null}
        {requests.length === 0 && !requestsError ? (
          <p className="mt-3 text-sm text-text-muted">
            No grade change requests yet.
          </p>
        ) : null}
        {requests.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3">
            {requests.map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg bg-surface-alt px-4 py-3"
              >
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.gradesToAdd.map(g => (
                      <span
                        key={g}
                        className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-text"
                      >
                        Class {g}
                      </span>
                    ))}
                  </div>
                  {r.status === 'rejected' && r.rejectedReason ? (
                    <p className="mt-1 text-xs text-danger">
                      Rejected: {r.rejectedReason}
                    </p>
                  ) : null}
                  {r.requestedAt ? (
                    <p className="mt-1 text-xs text-text-muted">
                      {(r.requestedAt as Timestamp).toDate?.()
                        ? (r.requestedAt as Timestamp).toDate().toLocaleDateString()
                        : ''}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Request more grades modal */}
      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => {
            if (e.target === e.currentTarget && !submitting) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text">
              Request additional grades
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Select the grades you want to add. An admin will review and
              approve your request.
            </p>
            <div className="mt-4 grid grid-cols-6 gap-2">
              {availableForRequest.map(g => {
                const selected = newGrades.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleNewGrade(g)}
                    disabled={submitting}
                    className={
                      'rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ' +
                      (selected
                        ? 'border-primary bg-primary text-primary-text'
                        : 'border-border bg-bg text-text hover:border-primary/60')
                    }
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            {newGrades.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs text-text-muted">
                  Sections per grade:
                </p>
                {[...newGrades].sort((a, b) => a - b).map(g => (
                  <div key={g} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-text">Class {g}</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newSectionCounts[g] ?? 1}
                      onChange={e =>
                        setNewSectionCounts(c => ({
                          ...c,
                          [g]: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                        }))
                      }
                      disabled={submitting}
                      className="w-16 rounded-lg border border-border bg-bg px-2 py-1 text-center text-sm text-text outline-none focus:border-primary"
                    />
                    <span className="text-xs text-text-muted">
                      section{(newSectionCounts[g] ?? 1) > 1 ? 's' : ''} ({Array.from(
                        {length: newSectionCounts[g] ?? 1},
                        (_, i) => `${g}${String.fromCharCode(65 + i)}`,
                      ).join(', ')})
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {submitError ? (
              <p className="mt-3 text-sm text-danger">{submitError}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestSubmit}
                disabled={submitting || newGrades.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatusBadge({status}: {status: 'pending' | 'approved' | 'rejected'}) {
  const styles = {
    pending:
      'border-warning/40 bg-warning/10 text-warning',
    approved:
      'border-green-500/40 bg-green-500/10 text-green-600',
    rejected:
      'border-danger/40 bg-danger/10 text-danger',
  };
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${styles[status]}`}
    >
      {status}
    </span>
  );
}
