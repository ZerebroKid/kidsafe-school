'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect, useState} from 'react';
import {Timestamp, doc, onSnapshot} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

import {useOwnSchool} from '@/lib/ownSchool';

interface ClassDoc {
  grade?: number;
  section?: string;
  className?: string;
  academicYear?: string;
  teacherIds?: string[];
  studentChildUids?: string[];
  createdAt?: Timestamp;
}

export default function ClassDetailPage() {
  const own = useOwnSchool();
  const params = useParams<{classId: string}>();
  const classId = params?.classId ?? '';

  const [klass, setKlass] = useState<ClassDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!own.schoolId || !classId) return;
    const unsub = onSnapshot(
      doc(
        getFirestoreInstance(),
        'schools',
        own.schoolId,
        'classes',
        classId,
      ),
      snap => setKlass(snap.exists() ? (snap.data() as ClassDoc) : null),
      err => setError(err.message),
    );
    return unsub;
  }, [own.schoolId, classId]);

  if (own.loading || klass === undefined) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }
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
  if (!own.schoolId || klass === null) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">Class not found.</p>
        <Link
          href="/classes"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          Back to classes
        </Link>
      </div>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Class
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">
            {klass.className ?? `${klass.grade ?? ''}${klass.section ?? ''}`}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Grade {klass.grade} · Section {klass.section} · {klass.academicYear}
          </p>
        </div>
        <Link href="/classes" className="text-sm text-text-muted hover:text-text">
          &larr; All classes
        </Link>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text">Overview</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-bg p-4">
            <p className="text-xs uppercase tracking-widest text-text-muted">Teachers</p>
            <p className="mt-1 text-2xl font-semibold text-text">
              {klass.teacherIds?.length ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-bg p-4">
            <p className="text-xs uppercase tracking-widest text-text-muted">Students</p>
            <p className="mt-1 text-2xl font-semibold text-text">
              {klass.studentChildUids?.length ?? 0}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
    </main>
  );
}
