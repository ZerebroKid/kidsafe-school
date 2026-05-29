'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect, useState} from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

interface CurriculumDoc {
  id?: string;
  board?: string;
  grade?: number;
  subject?: string;
}

interface ChapterRow {
  id: string;
  chapterNo?: number;
  chapterName?: string;
  status?: 'draft' | 'published';
}

export default function CurriculumDetailPage() {
  const params = useParams<{id: string}>();
  const curriculumId = params?.id;
  const [curriculum, setCurriculum] = useState<CurriculumDoc | null | undefined>(
    undefined,
  );
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!curriculumId) return;
    const unsub = onSnapshot(
      doc(getFirestoreInstance(), 'curriculum', curriculumId),
      snap => {
        setCurriculum(snap.exists() ? (snap.data() as CurriculumDoc) : null);
      },
      err => setError(err.message),
    );
    return unsub;
  }, [curriculumId]);

  useEffect(() => {
    if (!curriculumId) return;
    const q = query(
      collection(
        getFirestoreInstance(),
        'curriculum',
        curriculumId,
        'chapters',
      ),
      orderBy('chapterNo', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setChapters(
          snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<ChapterRow, 'id'>),
          })),
        );
      },
      err => setError(err.message),
    );
    return unsub;
  }, [curriculumId]);

  if (!curriculumId) return null;

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Curriculum
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">
            {curriculumId}
          </h1>
          {curriculum ? (
            <p className="mt-1 text-sm text-text-muted">
              {curriculum.board ?? '—'} • Grade {curriculum.grade ?? '—'} •{' '}
              {curriculum.subject ?? '—'}
            </p>
          ) : null}
        </div>
        <Link
          href="/curriculum"
          className="text-sm text-text-muted hover:text-text"
        >
          &larr; All curricula
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

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text">Chapters</h2>
        {chapters === null ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : chapters.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            No chapters yet. Re-run the importer.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {chapters.map(c => (
              <li
                key={c.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="text-text">
                    {c.chapterNo ?? '?'}. {c.chapterName ?? c.id}
                  </p>
                  <p className="text-xs text-text-muted">
                    id: <code>{c.id}</code> • status: {c.status ?? 'draft'}
                  </p>
                </div>
                <Link
                  href={`/curriculum/${curriculumId}/${c.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  Topics
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
