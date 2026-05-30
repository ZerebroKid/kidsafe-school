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

const NAV = [
  {href: '/schools', label: 'Schools'},
  {href: '/principals', label: 'Principals'},
  {href: '/grade-requests', label: 'Grade requests'},
  {href: '/syllabus-sources', label: 'Syllabus sources'},
  {href: '/curriculum', label: 'Curriculum'},
  {href: '/rewards', label: 'Rewards'},
  {href: '/users', label: 'Users'},
  {href: '/audit', label: 'Audit'},
] as const;

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
      <section className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-bg p-8">
        {children}
      </section>
    </div>
  );
}

function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex flex-col gap-1 p-6">
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Zerebro
        </p>
        <p className="text-lg font-semibold text-text">Admin</p>
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
      <div id="admin-sidebar-footer" className="border-t border-border p-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
