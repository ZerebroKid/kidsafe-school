'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {collection, doc, getDocs, query, where} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';
import {compareClasses} from '@/lib/classes';
import {useSchool} from '@/lib/school';

export default function TeacherHomePage() {
  const {schoolId, uid} = useSchool();
  const [classes, setClasses] = useState<{id: string; className: string; grade: number; section: string}[]>([]);

  useEffect(() => {
    const classesRef = collection(doc(getFirestoreInstance(), 'schools', schoolId), 'classes');
    void getDocs(query(classesRef, where('teacherIds', 'array-contains', uid))).then(snap => {
      const next = snap.docs.map(item => ({
        id: item.id,
        className: String(item.data().className ?? item.id),
        grade: typeof item.data().grade === 'number' ? item.data().grade : 99,
        section: String(item.data().section ?? ''),
      }));
      next.sort(compareClasses);
      setClasses(next);
    });
  }, [schoolId, uid]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">My classes</h1>
      {classes.length === 0 ? (
        <p className="text-sm text-text-muted">No class is assigned to this phone yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {classes.map(item => (
            <li key={item.id}>
              <Link className="block px-4 py-3" href={`/t/class/${item.id}/attendance`}>
                {item.className}
                <span className="ml-2 text-sm text-text-muted">Mark today</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
