'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useState} from 'react';
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

import {generateInviteCode} from '@/lib/codes';

/*
 * P4.2.3 -- create-school form.
 *
 * Auto-generates the 8-char inviteCode CLIENT-SIDE before write. We rely on
 * the alphabet's 32^8 entropy + a downstream rotation mechanism if a
 * collision ever surfaces; we do NOT pre-check uniqueness here because
 * `claimSchool` queries `where('inviteCode','==', x)` and rejects mismatches
 * with `invalid-argument`. Collisions are detectable at claim time and the
 * admin can rotate.
 *
 * principalUid starts null and gets stamped by the `approvePrincipal`
 * callable. We do NOT set it during create because the school exists for
 * the duration of the admin sharing the code -> principal claiming ->
 * admin approving loop, all of which happens with principalUid == null.
 */

export default function NewSchoolPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        setError('Name must be at least 2 characters.');
        return;
      }
      setSubmitting(true);
      try {
        const ref = await addDoc(
          collection(getFirestoreInstance(), 'schools'),
          {
            name: trimmed,
            city: city.trim() || null,
            inviteCode: generateInviteCode(),
            principalUid: null,
            createdAt: serverTimestamp(),
          },
        );
        router.replace(`/schools/${ref.id}`);
      } catch (err) {
        setError(
          (err as {message?: string} | null)?.message ??
            'Could not create the school.',
        );
        setSubmitting(false);
      }
    },
    [name, city, router],
  );

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Schools
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">New school</h1>
        <p className="mt-2 text-sm text-text-muted">
          Creates a new <code>schools/{'{id}'}</code> doc with an auto-generated
          invite code. After creating, share the code MANUALLY (WhatsApp / SMS
          / in person) with the principal. We never auto-send.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">School name</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Mumbai Public School"
            disabled={submitting}
            required
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">City (optional)</span>
          <input
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="e.g. Mumbai"
            disabled={submitting}
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
            onClick={() => router.replace('/schools')}
            disabled={submitting}
            className="rounded-lg border border-border bg-bg px-4 py-2 text-sm text-text-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || name.trim().length < 2}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create school'}
          </button>
        </div>
      </form>
    </main>
  );
}
