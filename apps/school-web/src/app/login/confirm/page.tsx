'use client';

import {useCallback, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {PhoneAuthProvider, signInWithCredential} from 'firebase/auth';
import {getAuthInstance, upsertWebUserDoc} from '@zerebro/shared-firebase';
import {destinationForAccess, resolveSchoolAccess} from '@/lib/access';

const SESSION_KEYS = {
  verificationId: 'zerebro.school.otp.verificationId',
  phone: 'zerebro.school.otp.phone',
} as const;

export default function ConfirmPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedId = sessionStorage.getItem(SESSION_KEYS.verificationId);
    const storedPhone = sessionStorage.getItem(SESSION_KEYS.phone);
    if (!storedId || !storedPhone) {
      router.replace('/login');
      return;
    }
    setVerificationId(storedId);
    setPhone(storedPhone);
  }, [router]);

  const submit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!verificationId || !phone) return;
    if (code.length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const userCred = await signInWithCredential(getAuthInstance(), credential);
      await upsertWebUserDoc(userCred.user.uid, {phone, defaultRole: 'principal'});
      sessionStorage.removeItem(SESSION_KEYS.verificationId);
      sessionStorage.removeItem(SESSION_KEYS.phone);
      router.replace(destinationForAccess(await resolveSchoolAccess(userCred.user.uid)));
    } catch (err) {
      const errCode = (err as {code?: string}).code ?? '';
      setError(
        errCode === 'auth/invalid-verification-code'
          ? 'That code was rejected. Request a new code and enter 123456 on localhost.'
          : 'Could not verify that code.',
      );
    } finally {
      setLoading(false);
    }
  }, [code, phone, router, verificationId]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Enter the code</h1>
      <p className="mt-2 text-sm text-text-muted">{phone}</p>
      <form className="mt-6 flex flex-col gap-3" onSubmit={submit}>
        <input
          className="rounded-xl border border-border bg-surface-alt px-3 py-2 tracking-widest"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={event => setCode(event.target.value)}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button className="rounded-xl bg-primary px-4 py-2 font-medium text-primary-text" disabled={loading} type="submit">
          {loading ? 'Checking…' : 'Continue'}
        </button>
        <button
          className="text-sm text-text-muted"
          type="button"
          onClick={() => {
            sessionStorage.removeItem(SESSION_KEYS.verificationId);
            sessionStorage.removeItem(SESSION_KEYS.phone);
            router.replace('/login');
          }}
        >
          Request a new code
        </button>
      </form>
    </main>
  );
}
