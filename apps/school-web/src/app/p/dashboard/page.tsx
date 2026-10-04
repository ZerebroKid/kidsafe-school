'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {collection, doc, getDoc, getDocs, query, where} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';
import {compareClasses} from '@/lib/classes';
import {currentMonth, todayYmd} from '@/lib/dates';
import {useSchool} from '@/lib/school';

interface ClassRow {
  id: string;
  className: string;
  marked: boolean;
  grade: number;
  section: string;
}

export default function DashboardPage() {
  const {schoolId} = useSchool();
  const [schoolName, setSchoolName] = useState('My School');
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [pendingFees, setPendingFees] = useState(0);
  const today = todayYmd();
  const month = currentMonth();

  useEffect(() => {
    const db = getFirestoreInstance();
    const schoolRef = doc(db, 'schools', schoolId);
    void (async () => {
      const school = await getDoc(schoolRef);
      const name = school.data()?.name;
      if (typeof name === 'string' && name) setSchoolName(name);
      const classes = await getDocs(collection(schoolRef, 'classes'));
      const next = await Promise.all(
        classes.docs.map(async classDoc => {
          const attendance = await getDoc(doc(schoolRef, 'attendance', `${classDoc.id}_${today}`));
          const data = classDoc.data();
          return {
            id: classDoc.id,
            className: typeof data.className === 'string' ? data.className : classDoc.id,
            marked: attendance.exists(),
            grade: typeof data.grade === 'number' ? data.grade : 99,
            section: typeof data.section === 'string' ? data.section : '',
          };
        }),
      );
      next.sort(compareClasses);
      setRows(next);
      const [leaveSnap, feeSnap] = await Promise.all([
        getDocs(query(collection(schoolRef, 'leaves'), where('status', '==', 'pending'))),
        getDocs(query(collection(schoolRef, 'fees'), where('month', '==', month), where('pending', '==', true))),
      ]);
      setPendingLeave(leaveSnap.size);
      setPendingFees(feeSnap.size);
    })();
  }, [month, schoolId, today]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{schoolName}</h1>
        <p className="text-sm text-text-muted">Attendance for {today}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link className="rounded-2xl border border-border p-4" href="/p/attendance/students">
          <p className="text-2xl font-semibold">{rows.filter(row => row.marked).length} of {rows.length}</p>
          <p className="text-sm text-text-muted">classes marked today</p>
        </Link>
        <Link className="rounded-2xl border border-border p-4" href="/p/leave">
          <p className="text-2xl font-semibold">{pendingLeave}</p>
          <p className="text-sm text-text-muted">{pendingLeave === 1 ? 'leave request waiting' : 'leave requests waiting'}</p>
        </Link>
        <Link className="rounded-2xl border border-border p-4" href="/p/fees?view=pending">
          <p className="text-2xl font-semibold">{pendingFees}</p>
          <p className="text-sm text-text-muted">students with a pending fee this month</p>
        </Link>
      </div>
      <section>
        <h2 className="mb-3 font-semibold">Today’s class attendance</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-text-muted">No classes yet. Add one from Students.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {rows.map(row => (
              <li key={row.id} className="flex items-center justify-between px-4 py-3">
                <span>{row.className}</span>
                <Link className="text-sm" href={`/p/attendance/students?classId=${row.id}&date=${today}`}>
                  {row.marked ? <span className="text-success">Marked</span> : <span className="text-warning">Not yet</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
