'use client';

import {createContext, useContext, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {onAuthStateChanged, signOut} from 'firebase/auth';
import {getAuthInstance} from '@zerebro/shared-firebase';
import {destinationForAccess, resolveSchoolAccess, type SchoolAccess} from './access';

type Portal = 'principal' | 'teacher' | 'accountant';

const SchoolContext = createContext<{schoolId: string; uid: string} | null>(null);

export function useSchool() {
  const value = useContext(SchoolContext);
  if (!value) throw new Error('School context missing');
  return value;
}

export function PortalGate({
  expect,
  children,
}: {
  expect: Portal;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [access, setAccess] = useState<SchoolAccess | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(getAuthInstance(), async user => {
      if (!user) {
        router.replace('/login');
        return;
      }
      setUid(user.uid);
      const next = await resolveSchoolAccess(user.uid);
      setAccess(next);
      if (next.kind !== expect) router.replace(destinationForAccess(next));
    });
  }, [expect, router]);

  if (!access || !uid || access.kind !== expect) {
    return <p className="p-8 text-text-muted">Opening your school…</p>;
  }

  return (
    <SchoolContext.Provider value={{schoolId: access.schoolId, uid}}>
      {children}
    </SchoolContext.Provider>
  );
}

export async function logout() {
  await signOut(getAuthInstance());
}
