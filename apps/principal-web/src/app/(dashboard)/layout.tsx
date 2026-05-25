'use client';

import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {getAuthInstance} from '@zerebro/shared-firebase';

/*
 * Auth-guarded shell for everything Campus shows once a principal is signed
 * in. The (dashboard) parens make this a route group -- it shapes the URL
 * tree without adding a /dashboard segment to the path -- so /dashboard,
 * /teachers and /syllabus all share one layout file.
 *
 * Guard pattern: render a tiny splash until onAuthStateChanged fires once,
 * then either bounce unauthed visitors to /login or unveil the sidebar.
 * No SSR cookie session yet (Phase 3 layers App Hosting cookies in); a
 * page hard-refresh re-runs the guard against the in-memory user.
 */

const NAV = [
  {href: '/dashboard', label: 'Dashboard'},
  {href: '/teachers', label: 'Teachers'},
  {href: '/syllabus', label: 'Syllabus'},
] as const;

export default function CampusDashboardLayout({
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

  if (!signedIn) {
    // Effective no-op while the router.replace above takes effect -- avoids
    // a flicker of dashboard chrome to an unauthed visitor.
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
        {/* P2.3.3 mounts the LogoutButton here. */}
      </div>
    </aside>
  );
}
