'use client';

import {useEffect, useState} from 'react';
import {useParams} from 'next/navigation';
import {collection, doc, getDoc, getDocs, query, where} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';
import {todayYmd} from '@/lib/dates';
import {useSchool} from '@/lib/school';

interface Student {id: string; name: string; rollNo: string}

export default function TeacherAttendancePage() {
  const {classId} = useParams<{classId: string}>();
  const {schoolId, uid} = useSchool();
  const [className, setClassName] = useState('Class');
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, 'P' | 'A'>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = todayYmd();

  useEffect(() => {
    const schoolRef = doc(getFirestoreInstance(), 'schools', schoolId);
    void (async () => {
      const classSnap = await getDoc(doc(schoolRef, 'classes', classId));
      setClassName(String(classSnap.data()?.className ?? 'Class'));
      const [studentSnap, attendance] = await Promise.all([
        getDocs(query(
          collection(schoolRef, 'students'),
          where('classId', '==', classId),
          where('status', '==', 'active'),
          where('readerIds', 'array-contains', uid),
        )),
        getDoc(doc(schoolRef, 'attendance', `${classId}_${today}`)),
      ]);
      const next = studentSnap.docs.map(item => ({
        id: item.id,
        name: String(item.data().name ?? ''),
        rollNo: String(item.data().rollNo ?? ''),
      }));
      next.sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, {numeric: true}));
      setStudents(next);
      const existing = attendance.data()?.marks;
      if (existing && typeof existing === 'object') setMarks(existing as Record<string, 'P' | 'A'>);
    })();
  }, [classId, schoolId, today, uid]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await callFn('submitClassAttendance', {schoolId, classId, date: today, marks});
      setMessage('Attendance saved. The principal can see it now.');
    } catch {
      setError('Mark every student Present or Absent, then save again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">{className}</h1>
      <p className="mb-4 text-sm text-text-muted">Today, {today}. This is the only day a teacher can submit.</p>
      {students.length === 0 ? <p className="text-sm text-text-muted">No active students are assigned to you in this class.</p> : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {students.map(student => (
            <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span>{student.rollNo ? `${student.rollNo}. ` : ''}{student.name}</span>
              <span className="flex gap-2">
                {(['P', 'A'] as const).map(mark => (
                  <button
                    key={mark}
                    className={`rounded-full px-3 py-1 text-sm ${marks[student.id] === mark ? 'bg-primary text-primary-text' : 'border border-border'}`}
                    type="button"
                    onClick={() => setMarks(current => ({...current, [student.id]: mark}))}
                  >
                    {mark === 'P' ? 'Present' : 'Absent'}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-success">{message}</p> : null}
      {students.length > 0 ? (
        <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-primary-text" disabled={saving} type="button" onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save attendance'}
        </button>
      ) : null}
    </div>
  );
}
