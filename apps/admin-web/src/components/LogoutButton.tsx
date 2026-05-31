'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useState} from 'react';
import {signOut} from 'firebase/auth';
import {getAuthInstance} from '@zerebro/shared-firebase';

/*
 * Footer button in the Admin sidebar. Carbon copy of the Campus
 * LogoutButton -- duplicated on purpose per plan so the two webs can
 * evolve sign-out UX (e.g. confirm dialog for destructive admin actions)
 * independently.
 */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    setBusy(true);
    try {
      await signOut(getAuthInstance());
    } finally {
      setBusy(false);
      router.push('/login');
    }
  }, [router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-alt disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
