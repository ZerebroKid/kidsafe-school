'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useState} from 'react';
import {PhoneAuthProvider, signInWithCredential} from 'firebase/auth';
import {getAuthInstance, upsertWebUserDoc} from '@zerebro/shared-firebase';

/*
 * OTP confirm screen for Zerebro Admin. Same flow as the Campus counterpart:
 * rebuild a PhoneAuthCredential from sessionStorage, sign in, upsert the
 * users/{uid} doc in the v2 shape via `upsertWebUserDoc` (defaultRole='admin').
 * Both apps point at the same Firestore project; the per-app sessionStorage
 * namespace lets a user be signed in to both at the same time without one
 * clobbering the other's verificationId.
 *
 * Empty `roles[]` until an existing admin grants the role -- the dashboard
 * layout's guard uses `hasRole('admin', userDoc)` to decide visibility.
 */

const SESSION_KEYS = {
  verificationId: 'zerebro.admin.otp.verificationId',
  phone: 'zerebro.admin.otp.phone',
} as const;

export default function AdminOtpConfirmPage() {
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
          defaultRole: 'admin',
        });
        sessionStorage.removeItem(SESSION_KEYS.verificationId);
        sessionStorage.removeItem(SESSION_KEYS.phone);
        // Admin has no /dashboard route -- its sidebar starts at /schools
        // (see (dashboard)/layout.tsx NAV). Campus does have /dashboard;
        // the two confirm pages intentionally diverge here.
        router.replace('/schools');
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
    <main className="flex min-h-screen flex-1">
      {/* Left hero panel — mirrors login */}
      <div className="relative hidden w-1/2 overflow-hidden bg-neutral-100 lg:block">
        <img
          alt="Campus"
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3OTAzMTh8MHwxfHNlYXJjaHwxfHxjYW1wdXMlMjBzdHVkZW50c3xlbnwxfHx8fDE3NTQ5MjM3Nzd8MA&ixlib=rb-4.1.0&q=80&w=1200"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 text-white">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium tracking-[3.2px] text-white/70">
              ZEREBRO
            </span>
            <span className="text-2xl font-semibold">Admin</span>
          </div>
          <div className="flex max-w-md flex-col gap-4">
            <h2 className="text-3xl font-semibold leading-tight">
              Almost there — verify your identity.
            </h2>
            <p className="text-base leading-relaxed text-white/80">
              Enter the one-time code we just sent to your phone to complete
              sign-in.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <svg className="size-4 shrink-0 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span className="text-sm text-white/80">
                Code expires in 10 minutes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-border p-8">
          {/* Brand mark */}
          <div className="flex items-center gap-2 pb-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-neutral-900 text-neutral-50">
              <svg className="size-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
              </svg>
            </span>
            <span className="text-xs font-semibold tracking-[3.2px] text-text-muted">
              ZEREBRO ADMIN
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-semibold text-text">
            Enter the code
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            We sent a 6-digit code to{' '}
            <span className="font-mono font-medium text-text">{phone ?? '…'}</span>.{' '}
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="underline underline-offset-2 hover:text-text"
            >
              Use a different number
            </button>
          </p>

          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-otp" className="text-sm font-medium text-text">
                Verification code
              </label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 fill-none stroke-text-muted stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="admin-otp"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  className="h-11 w-full rounded-lg border border-border bg-bg pl-9 pr-3 font-mono text-lg tracking-widest text-text outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>
              <p className="flex items-center gap-1 text-xs text-text-muted">
                <svg className="size-3 shrink-0 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Didn&rsquo;t receive the SMS? Check your spam folder or go back to resend.
              </p>
            </div>

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
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 font-medium text-neutral-50 disabled:opacity-60"
            >
              <svg className="size-4 shrink-0 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              {loading ? 'Verifying…' : 'Verify and continue'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-text-muted">
            By continuing, you agree to the{' '}
            <span className="underline underline-offset-2">Terms</span> and{' '}
            <span className="underline underline-offset-2">Privacy Policy</span>.
          </p>
        </div>
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
