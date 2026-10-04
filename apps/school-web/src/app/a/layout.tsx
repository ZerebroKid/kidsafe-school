'use client';

import {AppShell} from '@/components/AppShell';
import {PortalGate} from '@/lib/school';

export default function AccountantLayout({children}: {children: React.ReactNode}) {
  return (
    <PortalGate expect="accountant">
      <AppShell title="Accountant" portal="accountant">{children}</AppShell>
    </PortalGate>
  );
}
