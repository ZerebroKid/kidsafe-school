'use client';

import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {logout} from '@/lib/school';

const principalLinks = [
  {href: '/p/dashboard', label: 'Dashboard'},
  {href: '/p/records', label: 'Students'},
  {href: '/p/teachers', label: 'Teachers'},
  {href: '/p/attendance/students', label: 'Attendance'},
  {href: '/p/leave', label: 'Leave'},
  {href: '/p/fees', label: 'Fees'},
];

const teacherLinks = [
  {href: '/t/home', label: 'My classes'},
  {href: '/t/leave', label: 'Leave'},
];

const accountantLinks = [{href: '/a/fees', label: 'Fees'}];

export function AppShell({
  title,
  portal,
  children,
}: {
  title: string;
  portal: 'principal' | 'teacher' | 'accountant';
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = portal === 'principal' ? principalLinks : portal === 'teacher' ? teacherLinks : accountantLinks;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <p className="font-semibold">{title}</p>
          <nav className="flex flex-1 flex-wrap gap-2 text-sm">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1 ${pathname.startsWith(link.href) ? 'bg-nav-active text-nav-active-text' : 'text-text-muted'}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <button
            className="text-sm text-text-muted"
            type="button"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
