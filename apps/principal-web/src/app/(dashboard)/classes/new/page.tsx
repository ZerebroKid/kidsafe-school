'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useMemo, useState} from 'react';
import {addDoc, collection, serverTimestamp} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

import {useOwnSchool} from '@/lib/ownSchool';

/*
 * P4.2.8 -- create-class form.
 *
 * Writes directly to `schools/{ownSchoolId}/classes` -- the
 * `belongsToSchool()` rule predicate authorises the write because the
 * principal-web (dashboard) guard already proved the caller holds the
 * 'principal' role AND useOwnSchool resolved them onto a school they own.
 *
 * teacherIds / studentChildUids start empty -- they get array-unioned by
 * approveTeacher (P4.3) and joinSchool (P4.4) respectively.
 *
 * Default `academicYear` is computed from today's date (e.g. 2026-27). The
 * principal can override.
 */

export default function NewClassPage() {
  const router = useRouter();
  const own = useOwnSchool();

  const defaultYear = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    // Indian academic year usually starts in June. Before June we're still
    // in the prior year's session.
    const start = now.getMonth() >= 5 ? y : y - 1;
    const end = (start + 1) % 100;
    return `${start}-${end.toString().padStart(2, '0')}`;
  }, []);

  const [grade, setGrade] = useState<number>(8);
  const [section, setSection] = useState('A');
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState(defaultYear);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      if (!own.schoolId) return;
      if (grade < 1 || grade > 12) {
        setError('Grade must be between 1 and 12.');
        return;
      }
      const sec = section.trim().toUpperCase();
      if (sec.length === 0) {
        setError('Section is required.');
        return;
      }
      const labelFallback = `${grade}${sec}`;
      const finalName = className.trim() || labelFallback;
      setSubmitting(true);
      try {
        const ref = await addDoc(
          collection(
            getFirestoreInstance(),
            'schools',
            own.schoolId,
            'classes',
          ),
          {
            grade,
            section: sec,
            className: finalName,
            academicYear: academicYear.trim() || defaultYear,
            teacherIds: [],
            studentChildUids: [],
            createdAt: serverTimestamp(),
          },
        );
        router.replace(`/classes/${ref.id}`);
      } catch (err) {
        setError(
          (err as {message?: string} | null)?.message ?? 'Create failed.',
        );
        setSubmitting(false);
      }
    },
    [own.schoolId, grade, section, className, academicYear, defaultYear, router],
  );

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
      <p className="text-sm text-text-muted">
        No school assigned to your account yet.
      </p>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Classes
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">New class</h1>
      </header>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Grade</span>
            <input
              type="number"
              min={1}
              max={12}
              value={grade}
              onChange={e => setGrade(Number(e.target.value))}
              disabled={submitting}
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Section</span>
            <input
              type="text"
              maxLength={2}
              value={section}
              onChange={e => setSection(e.target.value.toUpperCase())}
              disabled={submitting}
              required
              className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-text outline-none focus:border-primary"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">
            Class name (defaults to grade + section)
          </span>
          <input
            type="text"
            value={className}
            onChange={e => setClassName(e.target.value)}
            placeholder={`${grade}${section}`}
            disabled={submitting}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Academic year</span>
          <input
            type="text"
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
            disabled={submitting}
            required
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.replace('/classes')}
            disabled={submitting}
            className="rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create class'}
          </button>
        </div>
      </form>
    </main>
  );
}
