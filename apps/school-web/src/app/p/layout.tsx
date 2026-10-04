'use client';

import {AppShell} from '@/components/AppShell';
import {PortalGate} from '@/lib/school';

export default function PrincipalLayout({children}: {children: React.ReactNode}) {
  return (
    <PortalGate expect="principal">
      <AppShell title="Principal" portal="principal">{children}</AppShell>
    </PortalGate>
  );
}
