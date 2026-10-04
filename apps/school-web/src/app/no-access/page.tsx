'use client';

import {useRouter} from 'next/navigation';
import {logout} from '@/lib/school';

export default function NoAccessPage() {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">No school access</h1>
      <p className="mt-2 text-sm text-text-muted">This phone could not open a school. Sign in again.</p>
      <button
        className="mt-6 rounded-xl bg-primary px-4 py-2 font-medium text-primary-text"
        type="button"
        onClick={async () => {
          await logout();
          router.replace('/login');
        }}
      >
        Sign out
      </button>
    </main>
  );
}
