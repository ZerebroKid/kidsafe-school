'use client';

import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {
  collectionGroup,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {
  getAuthInstance,
  getCurrentUserDoc,
  getFirestoreInstance,
  hasRole,
} from '@zerebro/shared-firebase';
import {LogoutButton} from '@/components/LogoutButton';

/*
 * Auth + role-guarded shell for everything Campus shows once a verified
 * principal is signed in (P4.2.5).
 *
 * Routing decision (runs once per signed-in user):
 *   1. Not signed in            -> /login
 *   2. roles[] includes 'principal'
 *                               -> render the dashboard
 *   3. else, find own pending claim via collectionGroup('principals')
 *      where userId == myUid limit 1:
 *      - pending found          -> /onboarding/pending?schoolId&principalId
 *      - rejected only          -> /onboarding (let them try again)
 *      - none                   -> /onboarding
 *
 * Why `getDoc` + `getDocs` rather than two onSnapshot listeners: we only
 * need to make the routing decision on auth/route transitions, not on
 * every Firestore tick. The pending screen itself uses onSnapshot to react
 * to approval; this layout just gets the user there.
 */

const NAV = [
  {href: '/dashboard', label: 'Dashboard'},
  {href: '/classes', label: 'Classes'},
  {href: '/teachers', label: 'Teachers'},
  {href: '/syllabus', label: 'Syllabus'},
] as const;

type GuardState =
  | {kind: 'loading'}
  | {kind: 'signedOut'}
  | {kind: 'allowed'}
  | {kind: 'redirected'};

export default function CampusDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>({kind: 'loading'});

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(getAuthInstance(), async user => {
      if (cancelled) return;
      if (!user) {
        setState({kind: 'signedOut'});
        router.replace('/login');
        return;
      }
      try {
        const userDoc = await getCurrentUserDoc(user.uid);
        if (cancelled) return;
        if (hasRole(userDoc, 'principal')) {
          setState({kind: 'allowed'});
          return;
        }
        // No principal role -- look for a claim to decide which onboarding
        // screen to show.
        const claims = await getDocs(
          query(
            collectionGroup(getFirestoreInstance(), 'principals'),
            where('userId', '==', user.uid),
            limit(1),
          ),
        );
        if (cancelled) return;
        const claim = claims.docs[0];
        if (claim && claim.data().status === 'pending') {
          const schoolId = claim.ref.parent.parent?.id;
          const principalId = claim.id;
          if (schoolId) {
            setState({kind: 'redirected'});
            router.replace(
              `/onboarding/pending?schoolId=${encodeURIComponent(schoolId)}&principalId=${encodeURIComponent(principalId)}`,
            );
            return;
          }
        }
        setState({kind: 'redirected'});
        router.replace('/onboarding');
      } catch {
        // If the role probe fails (e.g. rules transient), send them to
        // onboarding instead of dead-ending in the dashboard.
        if (!cancelled) {
          setState({kind: 'redirected'});
          router.replace('/onboarding');
        }
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [router]);

  if (state.kind === 'loading') {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading…</p>
      </main>
    );
  }
  if (state.kind !== 'allowed') {
    // signedOut + redirected: the router.replace above is in flight; render
    // nothing to avoid a flash of dashboard chrome.
    return null;
  }

  return (
    <div className="flex min-h-full flex-1">
      <CampusSidebar />
      <section className="flex flex-1 flex-col bg-bg p-8">{children}</section>
    </div>
  );
}

function CampusSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex flex-col gap-1 p-6">
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Zerebro
        </p>
        <p className="text-lg font-semibold text-text">Campus</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                'rounded-md px-3 py-2 text-sm transition-colors ' +
                (active
                  ? 'bg-surface-alt text-text'
                  : 'text-text-muted hover:bg-surface-alt hover:text-text')
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div
        id="campus-sidebar-footer"
        className="border-t border-border p-3"
      >
        <LogoutButton />
      </div>
    </aside>
  );
}
