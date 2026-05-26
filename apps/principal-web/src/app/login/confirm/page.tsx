'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useState} from 'react';
import {PhoneAuthProvider, signInWithCredential} from 'firebase/auth';
import {getAuthInstance, upsertWebUserDoc} from '@zerebro/shared-firebase';

/*
 * OTP confirm screen for Zerebro Campus. The send screen (page.tsx in this
 * folder's parent) stashed the verificationId + phone in sessionStorage; we
 * reconstruct a PhoneAuthCredential here because ConfirmationResult itself
 * is non-serialisable and would not survive a route change.
 *
 * On a successful sign-in we upsert `users/{uid}` via the shared
 * `upsertWebUserDoc` helper which writes the v2 shape:
 *   {phone, roles: [], primaryRole: 'principal', createdAt}
 *
 * Empty `roles[]` is intentional: a fresh phone-OTP signup is just an
 * unverified phone number until an admin grants the principal role
 * (P4.3 invite flow). The dashboard layout's guard reads `hasRole(...)`
 * to decide whether to show the principal UI or an "awaiting approval"
 * placeholder.
 */

const SESSION_KEYS = {
  verificationId: 'zerebro.campus.otp.verificationId',
  phone: 'zerebro.campus.otp.phone',
} as const;

export default function CampusOtpConfirmPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const v = sessionStorage.getItem(SESSION_KEYS.verificationId);
    const p = sessionStorage.getItem(SESSION_KEYS.phone);
    if (!v || !p) {
      router.replace('/login');
      return;
    }
    setVerificationId(v);
    setPhone(p);
  }, [router]);

  const handleVerify = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      if (!verificationId || !phone) return;
      if (code.length < 6) {
        setError('Enter the 6-digit code from the SMS.');
        return;
      }
      setLoading(true);
      try {
        const credential = PhoneAuthProvider.credential(verificationId, code);
        const userCred = await signInWithCredential(getAuthInstance(), credential);
        await upsertWebUserDoc(userCred.user.uid, {
          phone,
          defaultRole: 'principal',
        });
        sessionStorage.removeItem(SESSION_KEYS.verificationId);
        sessionStorage.removeItem(SESSION_KEYS.phone);
        router.replace('/dashboard');
      } catch (err) {
        const errCode = (err as {code?: string} | null)?.code ?? '';
        setError(humaniseConfirmError(errCode, err));
      } finally {
        setLoading(false);
      }
    },
    [code, phone, router, verificationId],
  );

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-lg">
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Zerebro Campus
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-text">
          Enter the code
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          We sent a 6-digit code to{' '}
          <span className="font-mono text-text">{phone ?? '…'}</span>.{' '}
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="text-primary hover:underline"
          >
            Use a different number
          </button>
        </p>
        <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Verification code</span>
            <input
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="rounded-lg border border-border bg-bg px-3 py-2 font-mono text-lg tracking-widest text-text outline-none focus:border-primary"
              disabled={loading}
              required
              autoFocus
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-text disabled:opacity-60"
          >
            {loading ? 'Verifying…' : 'Verify and continue'}
          </button>
        </form>
      </div>
    </main>
  );
}

function humaniseConfirmError(code: string, err: unknown): string {
  switch (code) {
    case 'auth/invalid-verification-code':
      return 'That code does not match. Check the SMS and try again.';
    case 'auth/code-expired':
      return 'The code expired. Go back and request a new one.';
    case 'auth/session-expired':
      return 'The session expired. Go back and request a new code.';
    case 'permission-denied':
      return 'Sign-in succeeded but the server rejected the profile write. Contact support.';
    default:
      return (
        (err as {message?: string} | null)?.message ??
        'Could not verify the code. Please try again.'
      );
  }
}
