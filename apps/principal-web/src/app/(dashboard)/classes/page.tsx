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

/*
 * P4.2.8 -- principal-side classes list.
 *
 * Lists every class under the principal's own school. The (dashboard) guard
 * makes sure only verified principals (roles[] includes 'principal') reach
 * this page; useOwnSchool then resolves which school doc they're stamped on.
 *
 * The table shows class summary fields; per-class detail (subjects, teacher
 * assignments) lives at /classes/[classId].
 */

interface ClassRow {
  id: string;
  grade?: number;
  section?: string;
  className?: string;
  academicYear?: string;
  teacherIds?: string[];
  studentChildUids?: string[];
  createdAt?: Timestamp;
}

export default function ClassesPage() {
  const own = useOwnSchool();
  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!own.schoolId) return;
    const q = query(
      collection(
        getFirestoreInstance(),
        'schools',
        own.schoolId,
        'classes',
      ),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setRows(
          snap.docs.map(d => ({id: d.id, ...(d.data() as Omit<ClassRow, 'id'>)})),
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

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Classes
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">All classes</h1>
        </div>
        <Link
          href="/classes/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text"
        >
          + New class
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
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            No classes yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Academic year</th>
                <th className="px-4 py-3">Teachers</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 text-text"
                >
                  <td className="px-4 py-3 font-medium">
                    {r.className ?? `${r.grade ?? ''}${r.section ?? ''}`}
                  </td>
                  <td className="px-4 py-3">{r.grade ?? '—'}</td>
                  <td className="px-4 py-3">{r.section ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {r.academicYear ?? '—'}
                  </td>
                  <td className="px-4 py-3">{r.teacherIds?.length ?? 0}</td>
                  <td className="px-4 py-3">{r.studentChildUids?.length ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/classes/${r.id}`}
                      className="text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
