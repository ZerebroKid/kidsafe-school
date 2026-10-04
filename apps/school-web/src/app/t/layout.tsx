'use client';

import {AppShell} from '@/components/AppShell';
import {PortalGate} from '@/lib/school';

export default function TeacherLayout({children}: {children: React.ReactNode}) {
  return (
    <PortalGate expect="teacher">
      <AppShell title="Teacher" portal="teacher">{children}</AppShell>
    </PortalGate>
  );
}
