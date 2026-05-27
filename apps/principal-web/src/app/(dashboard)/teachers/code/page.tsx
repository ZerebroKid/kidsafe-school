'use client';

import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';
import {Timestamp, doc, onSnapshot} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';

import {CopyButton} from '@/components/CopyButton';
import {useOwnSchool} from '@/lib/ownSchool';

/*
 * P4.3 -- principal's teacher-code rotation page.
 *
 * Twin of the admin-web `schools/[id]` invite-code rotation page, scoped to
 * the principal's OWN school. The principal hits this page, sees the current
 * 6-char teacherCode, Copy + Rotate buttons, and the "share manually"
 * reminder that's central to the locked Phase 4 onboarding spec (no auto-SMS
 * from our backend; only Firebase Phone Auth sends OTPs).
 *
 * Rotation is a deliberate revocation tool -- if a code leaks (wrong WhatsApp
 * group, screenshot in a chat), the principal rotates to invalidate every
 * outstanding share. Pending join requests survive a rotation because
 * `schools/{id}/teachers/{teacherId}` records use the teacher's uid as the
 * doc id (not the code), so the principal can still approve / reject them
 * from /teachers.
 *
 * Live read via onSnapshot so a successful rotation reflects in the UI
 * within ~500ms without a manual refresh.
 */

interface SchoolDoc {
  name?: string;
  teacherCode?: string;
  teacherCodeRotatedAt?: Timestamp;
}

export default function TeachersCodePage() {
  const own = useOwnSchool();
  const [data, setData] = useState<SchoolDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

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

  const handleRotate = useCallback(async () => {
    if (!own.schoolId) return;
    if (
      !confirm(
        'Rotate the teacher code? Pending teacher requests already submitted are NOT cancelled; only new joins will need the fresh code.',
      )
    )
      return;
    setRotating(true);
    setError(null);
    try {
      await callFn<{schoolId: string}, {teacherCode: string}>(
        'rotateTeacherCode',
        {schoolId: own.schoolId},
      );
    } catch (err) {
      setError(
        (err as {message?: string} | null)?.message ?? 'Rotation failed.',
      );
    } finally {
      setRotating(false);
    }
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

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Teachers
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Teacher code</h1>
          {data?.name ? (
            <p className="mt-1 text-sm text-text-muted">{data.name}</p>
          ) : null}
        </div>
        <Link
          href="/teachers"
          className="text-sm text-text-muted hover:text-text"
        >
          &larr; All teachers
        </Link>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-text-muted">
              Current teacher code
            </p>
            <p className="mt-2 font-mono text-3xl tracking-widest text-text">
              {data?.teacherCode ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data?.teacherCode ? <CopyButton value={data.teacherCode} /> : null}
            <button
              type="button"
              onClick={handleRotate}
              disabled={rotating}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-medium text-text disabled:opacity-60"
            >
              {rotating ? 'Rotating…' : data?.teacherCode ? 'Rotate' : 'Generate'}
            </button>
          </div>
        </div>
        <p className="mt-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-text">
          Share this code <strong>manually</strong> (WhatsApp / SMS / in
          person). We never auto-send. The teacher enters it once during
          first-time ZConnect signup; after you approve them their phone is
          permanently bound to <code>roles[]</code> including{' '}
          <code>&apos;teacher&apos;</code>.
        </p>
      </section>
    </main>
  );
}
