'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

import {useOwnSchool} from '@/lib/ownSchool';
import {
  useSchoolAssignments,
  groupTeacherActivity,
  type TeacherActivity,
} from '@/lib/schoolReports';
import {currentMonthPrefix, daysAgoInSchoolTz} from '@/lib/schoolTime';

/*
 * P4.3 -- principal's teacher roster.
 *
 * Two tables: Pending requests (action required) and Active teachers. The
 * principal CTAs are:
 *   - "Manage teacher code" -> /teachers/code (generate + share)
 *   - "Review" on a pending row -> /teachers/{teacherId} (approve / reject)
 *
 * Live read via onSnapshot so a freshly-approved teacher leaves Pending and
 * appears in Active without a manual refresh. We sort by requestedAt so the
 * oldest pending request is at the top of the queue (FIFO -- if the
 * principal can't get to all of them today, the longest-waiting teacher is
 * the first one they'll see tomorrow morning).
 */

interface TeacherRow {
  id: string;
  userId?: string;
  displayName?: string;
  phone?: string;
  status?: 'pending' | 'active' | 'rejected';
  requestedAt?: Timestamp;
  rejectedReason?: string;
}

export default function TeachersListPage() {
  const own = useOwnSchool();
  const [rows, setRows] = useState<TeacherRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const assignments = useSchoolAssignments(own.schoolId);
  const activityByTeacher = assignments.data
    ? groupTeacherActivity(assignments.data, currentMonthPrefix())
    : {};

  useEffect(() => {
    if (!own.schoolId) return;
    const q = query(
      collection(getFirestoreInstance(), 'schools', own.schoolId, 'teachers'),
      orderBy('requestedAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setRows(
          snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<TeacherRow, 'id'>),
          })),
        );
        setError(null);
      },
      err => setError(err.message),
    );
    return unsub;
  }, [own.schoolId]);

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
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">
          We could not find a school assigned to your account. If you just got
          approved, refresh the page; otherwise contact your admin.
        </p>
      </div>
    );
  }

  const pending = (rows ?? []).filter(r => r.status === 'pending');
  const active = (rows ?? []).filter(r => r.status === 'active');
  const rejected = (rows ?? []).filter(r => r.status === 'rejected');

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Teachers
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">All teachers</h1>
        </div>
        <Link
          href="/teachers/code"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text"
        >
          Manage teacher code
        </Link>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <>
          <TeacherTable
            title="Pending requests"
            emptyHint="No one is waiting on you. When a teacher submits the code from ZConnect they'll appear here."
            rows={pending}
            renderAction={row => (
              <Link
                href={`/teachers/${row.id}`}
                className="text-primary hover:underline"
              >
                Review
              </Link>
            )}
          />
          <TeacherTable
            title="Active teachers"
            emptyHint="No teachers have been approved yet."
            rows={active}
            activityByTeacher={activityByTeacher}
            activityLoading={assignments.loading}
          />
          {rejected.length > 0 ? (
            <TeacherTable
              title="Rejected"
              emptyHint=""
              rows={rejected}
              showReason
            />
          ) : null}
        </>
      )}
    </main>
  );
}

function TeacherTable({
  title,
  emptyHint,
  rows,
  renderAction,
  showReason,
  activityByTeacher,
  activityLoading,
}: {
  title: string;
  emptyHint: string;
  rows: TeacherRow[];
  renderAction?: (row: TeacherRow) => React.ReactNode;
  showReason?: boolean;
  /** Per-teacher assignment activity keyed by the teacher's `userId`. */
  activityByTeacher?: Record<string, TeacherActivity>;
  activityLoading?: boolean;
}) {
  const showActivity = activityByTeacher !== undefined;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-text">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">{emptyHint}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Requested</th>
                {showActivity ? <th className="px-4 py-3">Last assigned</th> : null}
                {showActivity ? <th className="px-4 py-3">This month</th> : null}
                {showReason ? <th className="px-4 py-3">Reason</th> : null}
                {renderAction ? <th className="px-4 py-3"></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 text-text"
                >
                  <td className="px-4 py-3 font-medium">
                    {r.displayName ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {r.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {r.requestedAt
                      ? r.requestedAt.toDate().toLocaleDateString()
                      : '—'}
                  </td>
                  {showActivity ? (
                    <ActivityCells
                      activity={
                        r.userId
                          ? activityByTeacher?.[r.userId]
                          : undefined
                      }
                      loading={activityLoading ?? false}
                    />
                  ) : null}
                  {showReason ? (
                    <td className="px-4 py-3 text-text-muted">
                      {r.rejectedReason ?? '—'}
                    </td>
                  ) : null}
                  {renderAction ? (
                    <td className="px-4 py-3 text-right">{renderAction(r)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/*
 * Two cells for the Active-teachers table: when this teacher was last assigned
 * and how many topics they assigned this calendar month (school TZ). A teacher
 * with nothing this month is flagged "Inactive" so the principal can spot them.
 */
function ActivityCells({
  activity,
  loading,
}: {
  activity?: TeacherActivity;
  loading: boolean;
}) {
  if (loading) {
    return (
      <>
        <td className="px-4 py-3 text-text-muted">…</td>
        <td className="px-4 py-3 text-text-muted">…</td>
      </>
    );
  }
  const last = activity?.lastAssignedDate ?? null;
  const thisMonth = activity?.assignmentsThisMonth ?? 0;
  const days = last ? daysAgoInSchoolTz(last) : null;
  const inactive = thisMonth === 0;
  return (
    <>
      <td className="px-4 py-3 text-text-muted">
        {last ? (
          <span>
            {last}
            {days !== null && days > 0 ? (
              <span className="ml-1 text-xs">({days}d)</span>
            ) : null}
          </span>
        ) : (
          'Never'
        )}
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-text">{thisMonth}</span>
        {inactive ? (
          <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-warning">
            Inactive
          </span>
        ) : null}
      </td>
    </>
  );
}
