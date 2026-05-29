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
import {safeValidateTopicContent} from '@zerebro/shared-types';

interface ChapterDoc {
  chapterNo?: number;
  chapterName?: string;
}

interface TopicRow {
  id: string;
  topicName?: string;
  status?: string;
  raw: Record<string, unknown>;
}

/*
 * P4.6.3 (lite) -- chapter view with raw topic JSON viewer.
 *
 * Lists every topic in the chapter and lets QA expand any row to inspect
 * the raw Firestore data (one click). Each row also runs the Zod
 * validator against the doc and renders a green "valid" badge or a red
 * "issues" badge with the first failing path. This is the quickest way
 * for a content editor to spot a malformed import without going to the
 * console.
 *
 * No edit affordance -- imports are write-once via the CLI script (P4.6.2).
 */
export default function ChapterDetailPage() {
  const params = useParams<{id: string; chapterId: string}>();
  const curriculumId = params?.id;
  const chapterId = params?.chapterId;
  const [chapter, setChapter] = useState<ChapterDoc | null>(null);
  const [topics, setTopics] = useState<TopicRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!curriculumId || !chapterId) return;
    const unsub = onSnapshot(
      doc(
        getFirestoreInstance(),
        'curriculum',
        curriculumId,
        'chapters',
        chapterId,
      ),
      snap => {
        setChapter(snap.exists() ? (snap.data() as ChapterDoc) : null);
      },
      err => setError(err.message),
    );
    return unsub;
  }, [curriculumId, chapterId]);

  useEffect(() => {
    if (!curriculumId || !chapterId) return;
    const q = query(
      collection(
        getFirestoreInstance(),
        'curriculum',
        curriculumId,
        'chapters',
        chapterId,
        'topics',
      ),
      orderBy('topicName', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setTopics(
          snap.docs.map(d => ({
            id: d.id,
            raw: d.data() as Record<string, unknown>,
            topicName: (d.data() as {topicName?: string}).topicName,
            status: (d.data() as {status?: string}).status,
          })),
        );
      },
      err => setError(err.message),
    );
    return unsub;
  }, [curriculumId, chapterId]);

  if (!curriculumId || !chapterId) return null;

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Chapter
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">
            {chapter?.chapterNo ?? '?'}. {chapter?.chapterName ?? chapterId}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            <code>{curriculumId}</code> /{' '}
            <code>{chapterId}</code>
          </p>
        </div>
        <Link
          href={`/curriculum/${curriculumId}`}
          className="text-sm text-text-muted hover:text-text"
        >
          &larr; Back
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
        <h2 className="text-lg font-semibold text-text">Topics</h2>
        {topics === null ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : topics.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            No topics imported yet for this chapter.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {topics.map(t => {
              const result = safeValidateTopicContent(t.raw);
              const isOpen = expanded === t.id;
              return (
                <li key={t.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-text">
                        {t.topicName ?? t.id}{' '}
                        <span className="ml-2 text-xs text-text-muted">
                          id: <code>{t.id}</code>
                        </span>
                      </p>
                      <p className="text-xs text-text-muted">
                        status: {t.status ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.ok ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                          schema ok
                        </span>
                      ) : (
                        <span
                          className="rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger"
                          title={result.errors
                            ?.map(e => `${e.path}: ${e.message}`)
                            .join('\n')}
                        >
                          {result.errors?.length ?? 0} schema issue(s)
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : t.id)}
                        className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs text-text"
                      >
                        {isOpen ? 'Hide JSON' : 'View JSON'}
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <pre className="mt-3 max-h-[480px] overflow-auto rounded-md border border-border bg-bg p-3 text-xs text-text">
                      {JSON.stringify(t.raw, null, 2)}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
