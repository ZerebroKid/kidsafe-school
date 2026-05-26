'use client';

import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {useCallback, useEffect, useState} from 'react';
import {
  Timestamp,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';

import {CopyButton} from '@/components/CopyButton';

/*
 * P4.2.3 -- school detail.
 *
 * Live read of one school. Shows the inviteCode prominently with a Copy
 * button + Rotate button. Rotate invokes `rotateInviteCode` (P4.2.4) which
 * runs admin-only on the server, generates a fresh collision-free code, and
 * stamps `inviteCodeRotatedAt`. The onSnapshot listener picks the new code
 * up within ~500ms so the UI feels instant.
 *
 * The "share manually" banner is always visible -- the manual hand-off model
 * is core to the locked Phase 4 onboarding spec (no auto-SMS from our
 * backend, only Firebase Phone Auth's own OTP SMS).
 */

interface SchoolDoc {
  name: string;
  city?: string;
  inviteCode?: string;
  inviteCodeRotatedAt?: Timestamp;
  principalUid?: string | null;
  createdAt?: Timestamp;
}

export default function SchoolDetailPage() {
  const router = useRouter();
  const params = useParams<{id: string}>();
  const schoolId = params?.id;

  const [data, setData] = useState<SchoolDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onSnapshot(
      doc(getFirestoreInstance(), 'schools', schoolId),
      snap => {
        setData(snap.exists() ? (snap.data() as SchoolDoc) : null);
        setError(null);
      },
      err => setError(err.message),
    );
    return unsub;
  }, [schoolId]);

  const handleRotate = useCallback(async () => {
    if (!schoolId) return;
    if (
      !confirm(
        'Rotate the invite code? The current code will stop working for new claims; any pending principal claim is unaffected.',
      )
    )
      return;
    setRotating(true);
    setError(null);
    try {
      await callFn<{schoolId: string}, {inviteCode: string}>(
        'rotateInviteCode',
        {schoolId},
      );
    } catch (err) {
      setError(
        (err as {message?: string} | null)?.message ?? 'Rotation failed.',
      );
    } finally {
      setRotating(false);
    }
  }, [schoolId]);

  if (!schoolId) return null;
  if (data === undefined) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }
  if (data === null) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">School not found.</p>
        <button
          type="button"
          onClick={() => router.replace('/schools')}
          className="mt-3 text-sm text-primary hover:underline"
        >
          Back to schools
        </button>
      </div>
    );
  }

  const status = data.principalUid ? 'active' : 'pending principal';

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            School
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">{data.name}</h1>
          {data.city ? (
            <p className="mt-1 text-sm text-text-muted">{data.city}</p>
          ) : null}
        </div>
        <Link
          href="/schools"
          className="text-sm text-text-muted hover:text-text"
        >
          &larr; All schools
        </Link>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-text-muted">
              Invite code
            </p>
            <p className="mt-2 font-mono text-3xl tracking-widest text-text">
              {data.inviteCode ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.inviteCode ? <CopyButton value={data.inviteCode} /> : null}
            <button
              type="button"
              onClick={handleRotate}
              disabled={rotating || !data.inviteCode}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-medium text-text disabled:opacity-60"
            >
              {rotating ? 'Rotating…' : 'Rotate'}
            </button>
          </div>
        </div>
        <p className="mt-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-text">
          Share this code <strong>manually</strong> (WhatsApp / SMS / in
          person). We never auto-send. The principal enters it once during
          first-time Zerebro Campus signup; after you approve them their
          phone is permanently bound to <code>roles: ['principal']</code>.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Status
          </p>
          <p className="mt-1 text-sm text-text">{status}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Principal UID
          </p>
          <p className="mt-1 break-all font-mono text-xs text-text">
            {data.principalUid ?? '—'}
          </p>
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
