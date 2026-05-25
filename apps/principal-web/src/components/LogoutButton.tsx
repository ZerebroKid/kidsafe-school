'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useState} from 'react';
import {signOut} from 'firebase/auth';
import {getAuthInstance} from '@zerebro/shared-firebase';

/*
 * Footer button in the Campus sidebar. signOut() resolves locally, then we
 * router.push('/login') -- the auth guard in (dashboard)/layout.tsx will also
 * bounce on the next refresh thanks to onAuthStateChanged firing with null.
 *
 * Per plan we kept this component duplicated per app (vs extracting into a
 * shared package) because the two webs intentionally diverge as each grows.
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
      className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
