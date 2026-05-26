'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useCallback, useEffect, useState} from 'react';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

import {useOwnSchool} from '@/lib/ownSchool';

/*
 * P4.2.8 -- class detail with subjects table + inline "Add subject" form.
 *
 * Subjects live under `schools/{schoolId}/classes/{classId}/subjects`. The
 * curriculumId is a free-text field for now -- the curriculum import script
 * (P4.6) will eventually seed a `curriculum/{id}` collection and we can
 * upgrade this to a dropdown. Until then the principal types the same
 * curriculumId they'll receive from the content team's spreadsheet.
 */

interface ClassDoc {
  grade?: number;
  section?: string;
  className?: string;
  academicYear?: string;
  teacherIds?: string[];
  studentChildUids?: string[];
  createdAt?: Timestamp;
}

interface SubjectRow {
  id: string;
  name?: string;
  code?: string;
  curriculumId?: string;
  teacherIds?: string[];
}

export default function ClassDetailPage() {
  const own = useOwnSchool();
  const params = useParams<{classId: string}>();
  const classId = params?.classId ?? '';

  const [klass, setKlass] = useState<ClassDoc | null | undefined>(undefined);
  const [subjects, setSubjects] = useState<SubjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [curriculumId, setCurriculumId] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    if (!own.schoolId || !classId) return;
    const unsub = onSnapshot(
      collection(
        getFirestoreInstance(),
        'schools',
        own.schoolId,
        'classes',
        classId,
        'subjects',
      ),
      snap => {
        setSubjects(
          snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<SubjectRow, 'id'>),
          })),
        );
      },
      err => setError(err.message),
    );
    return unsub;
  }, [own.schoolId, classId]);

  const handleAddSubject = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      if (!own.schoolId || !classId) return;
      if (name.trim().length < 2 || curriculumId.trim().length === 0) {
        setError('Name and curriculumId are required.');
        return;
      }
      setSubmitting(true);
      try {
        await addDoc(
          collection(
            getFirestoreInstance(),
            'schools',
            own.schoolId,
            'classes',
            classId,
            'subjects',
          ),
          {
            name: name.trim(),
            code: code.trim() || null,
            curriculumId: curriculumId.trim(),
            teacherIds: [],
          },
        );
        setName('');
        setCode('');
        setCurriculumId('');
      } catch (err) {
        setError(
          (err as {message?: string} | null)?.message ?? 'Could not add subject.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [own.schoolId, classId, name, code, curriculumId],
  );

  if (own.loading || klass === undefined) {
    return <p className="text-sm text-text-muted">Loading…</p>;
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
        <h2 className="text-lg font-semibold text-text">Subjects</h2>
        {subjects === null ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : subjects.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            No subjects yet. Add one below.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {subjects.map(s => (
              <li
                key={s.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium text-text">{s.name}</p>
                  <p className="text-xs text-text-muted">
                    {s.code ? `${s.code} · ` : ''}
                    <span className="font-mono">{s.curriculumId ?? '—'}</span>
                  </p>
                </div>
                <p className="text-xs text-text-muted">
                  {s.teacherIds?.length ?? 0} teachers
                </p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddSubject} className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm font-semibold text-text">Add subject</p>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Subject name"
              disabled={submitting}
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Short code (opt.)"
              disabled={submitting}
              className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-text outline-none focus:border-primary"
            />
            <input
              type="text"
              value={curriculumId}
              onChange={e => setCurriculumId(e.target.value)}
              placeholder="curriculumId"
              disabled={submitting}
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-text outline-none focus:border-primary"
            />
          </div>
          <p className="text-xs text-text-muted">
            curriculumId is a free-text reference today (e.g.{' '}
            <code>cbse_8_science</code>). Curriculum import + dropdown ship
            in P4.6.
          </p>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-60"
            >
              {submitting ? 'Adding…' : 'Add subject'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
