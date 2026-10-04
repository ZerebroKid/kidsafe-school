'use client';

import {useCallback, useEffect, useState} from 'react';
import {collection, doc, getDocs} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';
import {callableError} from '@/lib/callableError';
import {useSchool} from '@/lib/school';

interface LeaveRow {
  id: string;
  teacherName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
}

function when(row: LeaveRow): string {
  return row.startDate === row.endDate ? row.startDate : `${row.startDate} to ${row.endDate}`;
}

export default function PrincipalLeavePage() {
  const {schoolId} = useSchool();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const snap = await getDocs(collection(doc(getFirestoreInstance(), 'schools', schoolId), 'leaves'));
    const next = snap.docs.map(item => ({
      id: item.id,
      teacherName: String(item.data().teacherName ?? 'Teacher'),
      startDate: String(item.data().startDate ?? ''),
      endDate: String(item.data().endDate ?? ''),
      reason: String(item.data().reason ?? ''),
      status: String(item.data().status ?? ''),
    }));
    next.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return b.startDate.localeCompare(a.startDate);
    });
    setRows(next);
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (leaveId: string, decision: 'approved' | 'rejected') => {
    setError(null);
    try {
      await callFn('decideTeacherLeave', {schoolId, leaveId, decision});
      await load();
    } catch (err) {
      setError(callableError(err, 'Could not update the leave.'));
    }
  };

  const pending = rows.filter(row => row.status === 'pending');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Leave requests</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-text-muted">No leave requests yet.</p> : null}
      {rows.length > 0 && pending.length === 0 ? <p className="text-sm text-text-muted">No leave is waiting.</p> : null}
      {rows.length > 0 ? (
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {rows.map(row => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{row.teacherName}</p>
              <p className="text-sm text-text-muted">{when(row)} · {row.reason}</p>
            </div>
            {row.status === 'pending' ? (
              <span className="flex gap-3 text-sm">
                <button type="button" onClick={() => void decide(row.id, 'approved')}>Approve</button>
                <button className="text-danger" type="button" onClick={() => void decide(row.id, 'rejected')}>Reject</button>
              </span>
            ) : <span className="text-sm capitalize text-text-muted">{row.status}</span>}
          </li>
        ))}
      </ul>
      ) : null}
    </div>
  );
}
