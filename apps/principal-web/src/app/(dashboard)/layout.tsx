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
  callFn,
  getAuthInstance,
  getCurrentUserDoc,
  getFirestoreInstance,
  hasRole,
} from '@zerebro/shared-firebase';
import {LogoutButton} from '@/components/LogoutButton';
import {SubscriptionBanner} from '@/components/SubscriptionBanner';

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

const ICON =
  'inline-block size-4 shrink-0 fill-none stroke-current stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]';

const NAV: readonly {href: string; label: string; icon: React.ReactNode}[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: '/classes',
    label: 'Classes',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: '/teachers',
    label: 'Teachers',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/grades',
    label: 'Grades',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <path d="M3 3v18h18" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
      </svg>
    ),
  },
  {
    href: '/school/code',
    label: 'School code',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    href: '/subscription',
    label: 'Subscription',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
];

/** Paths that remain accessible even when subscription is inactive */
const SUBSCRIPTION_EXEMPT_PATHS = ['/subscription', '/subscription/history'];

type GuardState =
  | {kind: 'loading'}
  | {kind: 'signedOut'}
  | {kind: 'allowed'; schoolId: string}
  | {kind: 'redirected'};

export default function CampusDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>({kind: 'loading'});
  const [subLoading, setSubLoading] = useState(true);
  const [subActive, setSubActive] = useState(true);
  const [graceRemainingHours, setGraceRemainingHours] = useState<number | null>(null);

  // Auth + role guard
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
          const activeClaims = await getDocs(
            query(
              collectionGroup(getFirestoreInstance(), 'principals'),
              where('userId', '==', user.uid),
              where('status', '==', 'active'),
              limit(1),
            ),
          );
          if (cancelled) return;
          const schoolId =
            activeClaims.docs[0]?.ref.parent.parent?.id ?? '';
          setState({kind: 'allowed', schoolId});
          return;
        }
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

  // Subscription gate (runs after auth resolves with schoolId)
  useEffect(() => {
    if (state.kind !== 'allowed' || !state.schoolId) {
      setSubLoading(false);
      setSubActive(true); // Don't block if no schoolId yet
      return;
    }

    let cancelled = false;
    setSubLoading(true);

    callFn<
      {schoolId: string},
      {isActive: boolean; graceRemainingHours: number | null; manuallyActivated: boolean; status: string | null}
    >('getSubscriptionStatus', {schoolId: state.schoolId})
      .then(result => {
        if (cancelled) return;
        setSubActive(result.isActive);
        setGraceRemainingHours(result.graceRemainingHours);
      })
      .catch(() => {
        if (cancelled) return;
        // On network failure, don't hard-block; fallback to active
        setSubActive(true);
      })
      .finally(() => {
        if (!cancelled) setSubLoading(false);
      });

    return () => { cancelled = true; };
  }, [state]);

  // Redirect to /subscription if inactive and not on exempt path
  useEffect(() => {
    if (subLoading || subActive) return;
    const isExempt = SUBSCRIPTION_EXEMPT_PATHS.some(
      p => pathname === p || pathname.startsWith(p + '/'),
    );
    if (!isExempt) {
      router.replace('/subscription');
    }
  }, [subLoading, subActive, pathname, router]);

  if (state.kind === 'loading' || (state.kind === 'allowed' && subLoading)) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading…</p>
      </main>
    );
  }
  if (state.kind !== 'allowed') {
    return null;
  }

  return (
    <div className="flex min-h-full flex-1">
      <CampusSidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        {graceRemainingHours != null && graceRemainingHours > 0 && (
          <SubscriptionBanner graceRemainingHours={graceRemainingHours} />
        )}
        <section className="flex flex-1 flex-col bg-bg p-12">{children}</section>
      </div>
    </div>
  );
}

function CampusSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex flex-col gap-1 p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
          Zerebro
        </p>
        <p className="text-xl font-bold text-text">Campus</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(item => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
                (active
                  ? 'bg-nav-active text-nav-active-text'
                  : 'text-text hover:bg-surface-alt')
              }
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
