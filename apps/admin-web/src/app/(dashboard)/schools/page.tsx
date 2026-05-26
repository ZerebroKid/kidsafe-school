'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

import {CopyButton} from '@/components/CopyButton';

/*
 * P4.2.3 -- admin schools list.
 *
 * Live `onSnapshot` over `schools` ordered by `createdAt` desc. Status is
 * derived locally from `principalUid`:
 *   - null  -> "pending principal"  (admin still needs to share inviteCode
 *              and approve the principal's claim)
 *   - truthy -> "active"
 *
 * Direct Firestore reads here are gated by firestore.rules `match /schools`
 * `allow read: if isAdmin() || belongsToSchool(schoolId)`. An admin gets the
 * whole list; a non-admin who somehow lands on this URL gets `permission-
 * denied` from the SDK and an empty table (the route guard in the parent
 * layout should have already redirected them, this is defence in depth).
 */

interface SchoolRow {
  id: string;
  name: string;
  city?: string;
  inviteCode?: string;
  principalUid?: string | null;
  createdAt?: Timestamp;
}

export default function AdminSchoolsPage() {
  const [rows, setRows] = useState<SchoolRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(getFirestoreInstance(), 'schools'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setRows(
          snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<SchoolRow, 'id'>),
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
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Schools
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">
            All schools
          </h1>
        </div>
        <Link
          href="/schools/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text"
        >
          + New school
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
            No schools yet. Create the first one to share an inviteCode with a
            principal.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Invite code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const status = r.principalUid ? 'active' : 'pending principal';
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 text-text"
                  >
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.city ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{r.inviteCode ?? '—'}</span>
                        {r.inviteCode ? <CopyButton value={r.inviteCode} /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs ' +
                          (status === 'active'
                            ? 'bg-primary/15 text-primary'
                            : 'bg-surface-alt text-text-muted')
                        }
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {formatTs(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/schools/${r.id}`}
                        className="text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
