'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

/*
 * P4.6.3 (lite) -- admin curriculum browser.
 *
 * Live list of every `curriculum/{id}` doc with a quick drill into its
 * chapters. The MVP intentionally renders the raw JSON in the drill-down
 * (no styled topic preview yet -- enough for QA to confirm an import
 * landed correctly before students see it). The richer rendered preview
 * lands later in P4.6.3.
 *
 * Direct Firestore reads here use the `curriculum/{id}` rule
 * (any signed-in user can read; only admin can write). Route is
 * additionally guarded by the (dashboard) layout's auth check.
 */

interface CurriculumRow {
  id: string;
  board?: string;
  grade?: number;
  subject?: string;
}

export default function AdminCurriculumPage() {
  const [rows, setRows] = useState<CurriculumRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(getFirestoreInstance(), 'curriculum'),
      orderBy('__name__'),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setRows(
          snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<CurriculumRow, 'id'>),
          })),
        );
        setError(null);
      },
      err => setError(err.message),
    );
    return unsub;
  }, []);

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Curriculum
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">
          Imported curricula
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Each row is a top-level <code>curriculum/{'{id}'}</code> doc imported
          via <code>pnpm import:curriculum</code>. Drill in to view chapters
          and topic JSON.
        </p>
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
            No curriculum bundles imported yet. Run{' '}
            <code className="rounded bg-bg px-1 py-0.5">
              pnpm import:curriculum -- --apply
            </code>{' '}
            with a bundle under <code>content/</code>.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Board</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 text-text">
                  <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-3 text-text-muted">{r.board ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{r.grade ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{r.subject ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/curriculum/${r.id}`}
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
