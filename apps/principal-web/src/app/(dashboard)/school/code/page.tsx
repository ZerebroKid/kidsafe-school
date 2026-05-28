'use client';

import {useEffect, useState} from 'react';
import {Timestamp, doc, onSnapshot} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

import {CopyButton} from '@/components/CopyButton';
import {useOwnSchool} from '@/lib/ownSchool';

/*
 * P4.4 -- principal's read-only view of their school invite code.
 *
 * UNLIKE the teacher code page, the principal CANNOT rotate the school
 * inviteCode -- that's an admin-only action (rotateInviteCode callable),
 * because the inviteCode is the same code the admin issues to the
 * principal during onboarding (§6.1 of the tech spec). If the code leaks,
 * the principal has to ask the admin to rotate.
 *
 * The page is purely a convenience: give the principal a one-click Copy
 * button + the reminder that they must SHARE THIS CODE MANUALLY with
 * parents (WhatsApp / SMS / in person), who in turn share it with their
 * children. There is no auto-SMS from our backend.
 *
 * Live read via onSnapshot so an admin-side rotation reflects within
 * ~500ms without a manual refresh.
 */

interface SchoolDoc {
  name?: string;
  inviteCode?: string;
  inviteCodeRotatedAt?: Timestamp;
}

export default function SchoolCodePage() {
  const own = useOwnSchool();
  const [data, setData] = useState<SchoolDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!own.schoolId) return;
    const unsub = onSnapshot(
      doc(getFirestoreInstance(), 'schools', own.schoolId),
      snap => {
        setData(snap.exists() ? (snap.data() as SchoolDoc) : null);
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
  if (data === undefined) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-danger/40 bg-danger/10 p-6"
      >
        <p className="text-sm font-medium text-danger">Could not load school</p>
        <p className="mt-2 font-mono text-xs text-danger/80">{error}</p>
      </div>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-text-muted">
          School
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">School code</h1>
        {data?.name ? (
          <p className="mt-1 text-sm text-text-muted">{data.name}</p>
        ) : null}
      </header>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-text-muted">
              Current school code
            </p>
            <p className="mt-2 font-mono text-3xl tracking-widest text-text">
              {data?.inviteCode ?? '—'}
            </p>
          </div>
          {data?.inviteCode ? <CopyButton value={data.inviteCode} /> : null}
        </div>
        <p className="mt-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-text">
          Share this code <strong>manually</strong> with parents (WhatsApp /
          SMS / in person). Each parent enters it once during their first ZConnect
          signup, then re-shares it with their child (along with the child&apos;s
          grade + section) for ZKid signup. We never auto-send. To rotate / revoke
          this code, ask your admin.
        </p>
      </section>
    </main>
  );
}
