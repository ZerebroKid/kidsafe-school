'use client';

import {useEffect, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {Suspense} from 'react';
import {collection, doc, getDoc, getDocs, query, where} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';
import {compareClasses} from '@/lib/classes';
import {todayYmd} from '@/lib/dates';
import {useSchool} from '@/lib/school';

interface ClassOption {id: string; className: string; grade: number; section: string}
interface Row {id: string; name: string; rollNo: string; mark: string}

function AttendanceSplit({rows}: {rows: Row[]}) {
  const present = rows.filter(row => row.mark === 'Present').length;
  const absent = rows.filter(row => row.mark === 'Absent').length;
  const unmarked = rows.length - present - absent;
  const share = (count: number) => `${(count / rows.length) * 100}%`;

  return (
    <section className="rounded-2xl border border-border p-4">
      <p className="text-sm text-text-muted">{present} of {rows.length} students are present</p>
      <div
        className="mt-3 flex h-4 overflow-hidden rounded-full bg-surface-alt"
        role="img"
        aria-label={`${present} present, ${absent} absent${unmarked ? `, ${unmarked} not marked` : ''}`}
      >
        {present > 0 ? <div className="bg-success" style={{width: share(present)}} /> : null}
        {absent > 0 ? <div className="bg-danger" style={{width: share(absent)}} /> : null}
        {unmarked > 0 ? <div className="bg-border" style={{width: share(unmarked)}} /> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-alt px-4 py-3">
          <p className="text-3xl font-semibold text-success">{present}</p>
          <p className="text-sm text-text-muted">Present</p>
        </div>
        <div className="rounded-xl bg-surface-alt px-4 py-3">
          <p className="text-3xl font-semibold text-danger">{absent}</p>
          <p className="text-sm text-text-muted">Absent</p>
        </div>
      </div>
    </section>
  );
}

function AttendanceView() {
  const {schoolId} = useSchool();
  const params = useSearchParams();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState(params.get('classId') ?? '');
  const [date, setDate] = useState(params.get('date') ?? todayYmd());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    void getDocs(collection(doc(getFirestoreInstance(), 'schools', schoolId), 'classes')).then(snap => {
      const next = snap.docs.map(item => ({
        id: item.id,
        className: String(item.data().className ?? item.id),
        grade: typeof item.data().grade === 'number' ? item.data().grade : 99,
        section: String(item.data().section ?? ''),
      }));
      next.sort(compareClasses);
      setClasses(next);
      if (!classId && next[0]) setClassId(next[0].id);
    });
  }, [schoolId, classId]);

  useEffect(() => {
    if (!classId) return;
    const schoolRef = doc(getFirestoreInstance(), 'schools', schoolId);
    void (async () => {
      const [students, attendance] = await Promise.all([
        getDocs(query(collection(schoolRef, 'students'), where('classId', '==', classId), where('status', '==', 'active'))),
        getDoc(doc(schoolRef, 'attendance', `${classId}_${date}`)),
      ]);
      const marks = (attendance.data()?.marks ?? {}) as Record<string, string>;
      const next = students.docs.map(item => ({
        id: item.id,
        name: String(item.data().name ?? ''),
        rollNo: String(item.data().rollNo ?? ''),
        mark: marks[item.id] === 'P' ? 'Present' : marks[item.id] === 'A' ? 'Absent' : '—',
      }));
      next.sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, {numeric: true}));
      setRows(next);
      setSubmitted(attendance.exists());
    })();
  }, [classId, date, schoolId]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Student attendance</h1>
      <div className="flex flex-wrap gap-3">
        <select className="rounded-xl border border-border px-3 py-2" value={classId} onChange={event => setClassId(event.target.value)}>
          {classes.map(item => <option key={item.id} value={item.id}>{item.className}</option>)}
        </select>
        <input className="rounded-xl border border-border px-3 py-2" type="date" value={date} onChange={event => setDate(event.target.value)} />
      </div>
      {!classId ? <p className="text-sm text-text-muted">Create a class first.</p> : null}
      {rows && rows.length === 0 ? <p className="text-sm text-text-muted">This class has no active students.</p> : null}
      {rows && rows.length > 0 && !submitted ? <p className="text-sm text-text-muted">No attendance has been submitted for this day.</p> : null}
      {rows && rows.length > 0 && submitted ? (
        <>
        <AttendanceSplit rows={rows} />
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {rows.map(row => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <span>{row.rollNo ? `${row.rollNo}. ` : ''}{row.name}</span>
              <span className={row.mark === 'Absent' ? 'text-danger' : 'text-success'}>{row.mark}</span>
            </li>
          ))}
        </ul>
        </>
      ) : null}
    </div>
  );
}

export default function PrincipalAttendancePage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Loading attendance…</p>}>
      <AttendanceView />
    </Suspense>
  );
}
