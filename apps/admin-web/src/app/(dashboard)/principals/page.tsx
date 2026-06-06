'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {
  Timestamp,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

/*
 * P4.2.7 -- admin pending-principals list
 *
 * Cross-school collection-group query over `principals/*` where
 * status='pending', sorted by `requestedAt asc` so the oldest claim is on
 * top (handle in FIFO order). Requires the collection-group rule + composite
 * index added in Step 0.
 *
 * School name is resolved lazily per row -- a tiny extra read per pending
 * principal -- because the rules don't let us denormalise the school name
 * onto the principal doc (no write access from principal). For a real
 * deployment with thousands of pending claims we'd cache; for the MVP this
 * is fine.
 *
 * Composite route id: we encode `schoolId__principalId` to the detail page so
 * the URL stays opaque + path-safe (no slashes).
 */

interface PendingRow {
  schoolId: string;
  principalId: string;
  schoolName?: string;
  displayName?: string;
  phone?: string;
  requestedAt?: Timestamp;
}

export default function AdminPrincipalsPage() {
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collectionGroup(getFirestoreInstance(), 'principals'),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      async snap => {
        const base: PendingRow[] = snap.docs.map(d => {
          const schoolRef = d.ref.parent.parent;
          return {
            schoolId: schoolRef?.id ?? '',
            principalId: d.id,
            displayName: (d.data() as {displayName?: string}).displayName,
            phone: (d.data() as {phone?: string}).phone,
            requestedAt: (d.data() as {requestedAt?: Timestamp}).requestedAt,
          };
        });
        // Resolve school names in parallel; tolerate missing reads (won't
        // crash the table if a single school read fails).
        const enriched = await Promise.all(
          base.map(async r => {
            if (!r.schoolId) return r;
            try {
              const s = await getDoc(
                doc(getFirestoreInstance(), 'schools', r.schoolId),
              );
              return {...r, schoolName: (s.data() as {name?: string})?.name};
            } catch {
              return r;
            }
          }),
        );
        setRows(enriched);
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
          Principals
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">
          Pending claims
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Principals waiting for verification. Approving grants them the{' '}
          <code>principal</code> role and stamps them onto the school.
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
            No pending claims. New principal requests will appear here within
            a couple of seconds of being submitted.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Principal</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={`${r.schoolId}__${r.principalId}`}
                  className="border-b border-border last:border-0 text-text"
                >
                  <td className="px-4 py-3 font-medium">
                    {r.schoolName ?? r.schoolId}
                  </td>
                  <td className="px-4 py-3">{r.displayName ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">
                    {r.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatTs(r.requestedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/principals/${r.schoolId}__${r.principalId}`}
                      className="text-primary hover:underline"
                    >
                      Review
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

function formatTs(ts?: Timestamp): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return '—';
  }
}
