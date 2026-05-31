'use client';

import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {getAuthInstance} from '@zerebro/shared-firebase';
import {LogoutButton} from '@/components/LogoutButton';

/*
 * Auth-guarded shell for the internal Zerebro Admin console. Mirrors
 * apps/principal-web's (dashboard) layout structure -- intentional copy
 * per the P2.3.x duplication policy so the two surfaces stay easy to
 * evolve independently as role-specific UX lands in Phase 3.
 *
 * The nav list is wider than Campus: Schools, Syllabus sources, Rewards,
 * Users, Audit. Phase 3 hides items based on the signed-in user's
 * roles[] array; for now every route is visible.
 */

const ICON =
  'inline-block size-4 shrink-0 fill-none stroke-current stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]';

const NAV: readonly {href: string; label: string; icon: React.ReactNode}[] = [
  {
    href: '/schools',
    label: 'Schools',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
      </svg>
    ),
  },
  {
    href: '/principals',
    label: 'Principals',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
  },
  {
    href: '/grade-requests',
    label: 'Grade requests',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/syllabus-sources',
    label: 'Syllabus sources',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <path d="m16 6 4 14" />
        <path d="M12 6v14" />
        <path d="M8 8v12" />
        <path d="M4 4v16" />
      </svg>
    ),
  },
  {
    href: '/curriculum',
    label: 'Curriculum',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: '/rewards',
    label: 'Rewards',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
  {
    href: '/users',
    label: 'Users',
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
    href: '/audit',
    label: 'Audit',
    icon: (
      <svg className={ICON} viewBox="0 0 24 24">
        <path d="M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4" />
        <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
      </svg>
    ),
  },
];

export default function AdminDashboardLayout({
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
    <div className="flex min-h-full flex-1">
      <AdminSidebar />
      <section className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-bg p-12">
        {children}
      </section>
    </div>
  );
}

function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex flex-col gap-1 p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
          Zerebro
        </p>
        <p className="text-xl font-bold text-text">Admin</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(item => {
          const active =
            pathname === item.href ||
            (item.href !== '/schools' && pathname.startsWith(item.href));
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
