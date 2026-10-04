'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {collection, deleteDoc, doc, getDocs, limit, query, where} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';
import {compareClasses} from '@/lib/classes';
import {useSchool} from '@/lib/school';

interface ClassRow {
  id: string;
  className: string;
  academicYear: string;
  grade: number;
  section: string;
}

export default function RecordsPage() {
  const {schoolId} = useSchool();
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const snap = await getDocs(collection(doc(getFirestoreInstance(), 'schools', schoolId), 'classes'));
    const next = snap.docs.map(item => {
      const data = item.data();
      return {
        id: item.id,
        className: typeof data.className === 'string' ? data.className : item.id,
        academicYear: typeof data.academicYear === 'string' ? data.academicYear : '',
        grade: typeof data.grade === 'number' ? data.grade : 99,
        section: typeof data.section === 'string' ? data.section : '',
      };
    });
    next.sort(compareClasses);
    setRows(next);
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (row: ClassRow) => {
    if (!window.confirm(`Delete ${row.className}?`)) return;
    setError(null);
    const schoolRef = doc(getFirestoreInstance(), 'schools', schoolId);
    const students = await getDocs(query(collection(schoolRef, 'students'), where('classId', '==', row.id), limit(1)));
    if (!students.empty) {
      setError(`${row.className} still has students. Mark them left before deleting the class.`);
      return;
    }
    await deleteDoc(doc(schoolRef, 'classes', row.id));
    await load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Classes</h1>
        <Link className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-text" href="/p/records/classes/new">
          New class
        </Link>
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">Nursery to class 12, sections A and B, appear after you open the school.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {rows.map(row => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={`/p/records/${row.id}`}>
                <span className="font-medium">{row.className}</span>
                <span className="ml-3 text-sm text-text-muted">{row.academicYear}</span>
              </Link>
              <button className="text-sm text-danger" type="button" onClick={() => void remove(row)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
