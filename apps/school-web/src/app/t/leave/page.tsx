'use client';

import {useCallback, useEffect, useState} from 'react';
import {collection, doc, getDocs, query, where} from 'firebase/firestore';
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

function leaveLabel(row: LeaveRow): string {
  const when = row.startDate === row.endDate ? row.startDate : `${row.startDate} to ${row.endDate}`;
  return `${when} · ${row.reason}`;
}

export default function TeacherLeavePage() {
  const {schoolId, uid} = useSchool();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const snap = await getDocs(query(
      collection(doc(getFirestoreInstance(), 'schools', schoolId), 'leaves'),
      where('teacherUid', '==', uid),
    ));
    const next = snap.docs.map(item => ({
      id: item.id,
      teacherName: String(item.data().teacherName ?? ''),
      startDate: String(item.data().startDate ?? ''),
      endDate: String(item.data().endDate ?? ''),
      reason: String(item.data().reason ?? ''),
      status: String(item.data().status ?? ''),
    }));
    next.sort((a, b) => b.startDate.localeCompare(a.startDate));
    setRows(next);
  }, [schoolId, uid]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await callFn('submitTeacherLeave', {schoolId, startDate, endDate, reason});
      setStartDate('');
      setEndDate('');
      setReason('');
      await load();
    } catch (err) {
      setError(callableError(err, 'Could not submit the leave.'));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (leaveId: string) => {
    setError(null);
    try {
      await callFn('cancelTeacherLeave', {schoolId, leaveId});
      await load();
    } catch (err) {
      setError(callableError(err, 'Could not cancel the leave.'));
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Leave</h1>
        {rows.length === 0 ? <p className="text-sm text-text-muted">No leave requests yet.</p> : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {rows.map(row => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{leaveLabel(row)}</p>
                  <p className="text-sm capitalize text-text-muted">{row.status}</p>
                </div>
                {row.status === 'pending' ? (
                  <button className="text-sm text-danger" type="button" onClick={() => void cancel(row.id)}>Cancel</button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </section>
      <form className="flex h-fit flex-col gap-3 rounded-2xl border border-border p-4" onSubmit={submit}>
        <h2 className="font-semibold">Request leave</h2>
        <label className="text-sm">Start
          <input className="mt-1 w-full rounded-xl border border-border px-3 py-2" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required />
        </label>
        <label className="text-sm">End
          <input className="mt-1 w-full rounded-xl border border-border px-3 py-2" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} required />
        </label>
        <label className="text-sm">Reason
          <input className="mt-1 w-full rounded-xl border border-border px-3 py-2" value={reason} onChange={event => setReason(event.target.value)} required />
        </label>
        <button className="rounded-xl bg-primary px-4 py-2 text-primary-text" disabled={saving} type="submit">
          {saving ? 'Sending…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
