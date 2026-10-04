'use client';

import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {onAuthStateChanged} from 'firebase/auth';
import {getAuthInstance} from '@zerebro/shared-firebase';
import {destinationForAccess, resolveSchoolAccess} from '@/lib/access';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    return onAuthStateChanged(getAuthInstance(), async user => {
      if (!user) {
        router.replace('/login');
        return;
      }
      router.replace(destinationForAccess(await resolveSchoolAccess(user.uid)));
    });
  }, [router]);
  return <p className="p-8 text-text-muted">Opening your school…</p>;
}
