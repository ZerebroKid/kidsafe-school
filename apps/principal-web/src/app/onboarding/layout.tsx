'use client';

import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {getAuthInstance} from '@zerebro/shared-firebase';

/*
 * Minimal auth shell for /onboarding/* -- mirrors the (dashboard) guard but
 * WITHOUT the sidebar/chrome since the user isn't a verified principal yet.
 * We still require auth: the only way to land here is right after OTP
 * confirmation, and a signed-out visitor goes back to /login.
 *
 * The (dashboard) layout's role-guard is what redirects new principals INTO
 * /onboarding in the first place (when roles[] doesn't include 'principal').
 * This layout doesn't gate on role -- if a user with roles=['principal']
 * navigates here manually, they get the onboarding form but the form
 * submission's idempotency in claimSchool prevents harm.
 */

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), user => {
      if (!user) {
        router.replace('/login');
        setSignedIn(false);
      } else {
        setSignedIn(true);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, [router]);

  if (!authChecked) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading…</p>
      </main>
    );
  }
  if (!signedIn) return null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      {children}
    </main>
  );
}
