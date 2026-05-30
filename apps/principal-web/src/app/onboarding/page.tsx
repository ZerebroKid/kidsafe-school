'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useState} from 'react';
import {callFn} from '@zerebro/shared-firebase';

/*
 * P4.2.5 -- principal first-time onboarding form.
 *
 * The principal pastes the inviteCode the admin shared MANUALLY and their
 * display name, then we call `claimSchool` (P4.2.4). On success we route to
 * /onboarding/pending which subscribes to the principal doc and auto-flips
 * to /dashboard when an admin approves.
 *
 * Common errors are humanised inline:
 *   - functions/invalid-argument    -> wrong code
 *   - functions/failed-precondition -> school already has an active principal
 *                                       OR caller already active on this school
 *   - functions/unauthenticated     -> session expired (rare; the layout
 *                                       already guards on auth)
 */

interface ClaimResponse {
  schoolId: string;
  principalId: string;
  status: 'pending';
}

const ALL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function OnboardingPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [sectionCounts, setSectionCounts] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleGrade = useCallback((grade: number) => {
    setSelectedGrades(prev => {
      if (prev.includes(grade)) {
        setSectionCounts(c => {
          const next = {...c};
          delete next[grade];
          return next;
        });
        return prev.filter(g => g !== grade);
      }
      setSectionCounts(c => ({...c, [grade]: 1}));
      return [...prev, grade];
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      const code = inviteCode.trim().toUpperCase();
      const name = displayName.trim();
      if (code.length < 4 || name.length < 2) {
        setError('Enter the invite code and your full name.');
        return;
      }
      if (selectedGrades.length === 0) {
        setError('Select at least one grade your school teaches.');
        return;
      }
      setSubmitting(true);
      try {
        const gradeSections: Record<string, number> = {};
        for (const g of selectedGrades) {
          gradeSections[String(g)] = sectionCounts[g] ?? 1;
        }
        const res = await callFn<
          {
            inviteCode: string;
            displayName: string;
            requestedGrades: number[];
            requestedGradeSections: Record<string, number>;
          },
          ClaimResponse
        >('claimSchool', {
          inviteCode: code,
          displayName: name,
          requestedGrades: [...selectedGrades].sort((a, b) => a - b),
          requestedGradeSections: gradeSections,
        });
        router.replace(
          `/onboarding/pending?schoolId=${encodeURIComponent(res.schoolId)}&principalId=${encodeURIComponent(res.principalId)}`,
        );
      } catch (err) {
        setError(humaniseClaimError(err));
        setSubmitting(false);
      }
    },
    [inviteCode, displayName, selectedGrades, router],
  );

  return (
    <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-lg">
      <p className="text-xs uppercase tracking-widest text-text-muted">
        Zerebro Campus
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-text">Claim your school</h1>
      <p className="mt-1 text-sm text-text-muted">
        Paste the invite code your Zerebro administrator shared with you over
        WhatsApp / SMS. After admin verification you will be able to manage
        classes, teachers, and reports for your school.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Invite code</span>
          <input
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="e.g. ABCD2345"
            maxLength={12}
            disabled={submitting}
            required
            autoFocus
            className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-lg tracking-widest text-text outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Your full name</span>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Anita Sharma"
            disabled={submitting}
            required
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>
        <fieldset disabled={submitting} className="flex flex-col gap-2">
          <legend className="text-sm text-text-muted">
            Grades taught in your school
          </legend>
          <div className="mt-1 grid grid-cols-6 gap-2">
            {ALL_GRADES.map(g => {
              const selected = selectedGrades.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={
                    'rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ' +
                    (selected
                      ? 'border-primary bg-primary text-primary-text'
                      : 'border-border bg-bg text-text hover:border-primary/60')
                  }
                >
                  {g}
                </button>
              );
            })}
          </div>
          {selectedGrades.length > 0 ? (
            <>
              <p className="mt-2 text-xs text-text-muted">
                {selectedGrades.length} grade{selectedGrades.length > 1 ? 's' : ''} selected
                &mdash; set section count for each grade:
              </p>
              <div className="mt-1 flex flex-col gap-2">
                {[...selectedGrades].sort((a, b) => a - b).map(g => (
                  <div key={g} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-text">Class {g}</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={sectionCounts[g] ?? 1}
                      onChange={e =>
                        setSectionCounts(c => ({
                          ...c,
                          [g]: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                        }))
                      }
                      className="w-16 rounded-lg border border-border bg-bg px-2 py-1 text-center text-sm text-text outline-none focus:border-primary"
                    />
                    <span className="text-xs text-text-muted">
                      section{(sectionCounts[g] ?? 1) > 1 ? 's' : ''} ({Array.from(
                        {length: sectionCounts[g] ?? 1},
                        (_, i) => `${g}${String.fromCharCode(65 + i)}`,
                      ).join(', ')})
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </fieldset>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || inviteCode.length < 4 || displayName.length < 2 || selectedGrades.length === 0}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-text disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit for verification'}
        </button>
      </form>
    </section>
  );
}

function humaniseClaimError(err: unknown): string {
  const code = (err as {code?: string} | null)?.code ?? '';
  const message = (err as {message?: string} | null)?.message ?? '';
  switch (code) {
    case 'functions/invalid-argument':
      return 'That invite code is not valid or has been rotated. Double-check with your admin.';
    case 'functions/failed-precondition':
      return message || 'This school already has an active principal.';
    case 'functions/unauthenticated':
      return 'Session expired. Sign in again.';
    default:
      return message || 'Could not submit. Please try again.';
  }
}
