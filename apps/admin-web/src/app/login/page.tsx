'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  getAuthInstance,
  normalizePhoneToE164,
} from '@zerebro/shared-firebase';

/*
 * Phone-OTP login for the internal Zerebro Admin console. Intentionally a
 * carbon copy of apps/principal-web/src/app/login/page.tsx -- the two webs
 * sit on the same Firebase project (and read the same users/{uid} doc),
 * the only thing that differs is the brand label, so duplicating keeps
 * each app navigable on its own.
 */

const SESSION_KEYS = {
  verificationId: 'zerebro.admin.otp.verificationId',
  phone: 'zerebro.admin.otp.phone',
} as const;

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Clean up any lingering verifier on unmount.
  useEffect(() => {
    return () => {
      try { recaptchaRef.current?.clear(); } catch { /* best-effort */ }
      recaptchaRef.current = null;
    };
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      const parsed = normalizePhoneToE164(phone);
      if (!parsed.ok || !parsed.e164) {
        setError(parsed.error ?? 'Invalid phone number');
        return;
      }
      if (!recaptchaContainerRef.current) {
        setError('reCAPTCHA container missing. Reload the page.');
        return;
      }
      setLoading(true);
      // Create a fresh verifier each submit to avoid "element removed" errors
      // caused by React strict-mode double-mount or prior verifier expiry.
      try { recaptchaRef.current?.clear(); } catch { /* best-effort */ }
      const verifier = new RecaptchaVerifier(
        getAuthInstance(),
        recaptchaContainerRef.current,
        {size: 'invisible'},
      );
      recaptchaRef.current = verifier;
      try {
        const result: ConfirmationResult = await signInWithPhoneNumber(
          getAuthInstance(),
          parsed.e164,
          verifier,
        );
        sessionStorage.setItem(SESSION_KEYS.verificationId, result.verificationId);
        sessionStorage.setItem(SESSION_KEYS.phone, parsed.e164);
        router.push('/login/confirm');
      } catch (err) {
        const code = (err as {code?: string} | null)?.code ?? '';
        setError(humaniseAuthError(code, err));
        try { verifier.clear(); } catch { /* best-effort */ }
        recaptchaRef.current = null;
      } finally {
        setLoading(false);
      }
    },
    [phone, router],
  );

  return (
    <main className="flex min-h-screen flex-1">
      {/* Left hero panel — hidden on mobile */}
      <div className="relative hidden w-1/2 overflow-hidden bg-neutral-100 lg:block">
        {/* <img
          alt="Campus"
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3OTAzMTh8MHwxfHNlYXJjaHwxfHxjYW1wdXMlMjBzdHVkZW50c3xlbnwxfHx8fDE3NTQ5MjM3Nzd8MA&ixlib=rb-4.1.0&q=80&w=1200"
        /> */}
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
              Operate every school, principal, and syllabus.
            </h2>
            <p className="text-base leading-relaxed text-white/80">
              Sign in to manage schools, approve principals, curate curriculum,
              and audit the platform.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <svg className="size-4 shrink-0 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span className="text-sm text-white/80">
                Secure one-time SMS verification
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
            Internal operations console
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Phone-based sign-in. Access is gated by the
            <code className="mx-1 rounded bg-surface-alt px-1 py-0.5 text-xs text-text-muted">
              users/{'{uid}'}.roles
            </code>
            array; ask the on-call admin to add yours.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-phone" className="text-sm font-medium text-text">
                Mobile number
              </label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 fill-none stroke-text-muted stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <input
                  id="admin-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-bg pl-9 pr-3 text-text outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                  disabled={loading}
                  required
                />
              </div>
              {/* <p className="flex items-center gap-1 text-xs text-text-muted">
                <svg className="size-3 shrink-0 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Standard SMS rates may apply.
              </p> */}
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
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 font-medium text-neutral-50 disabled:opacity-60"
            >
              <svg className="size-4 shrink-0 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {loading ? 'Sending code…' : 'Send code'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-text-muted">
            By continuing, you agree to the{' '}
            <span className="underline underline-offset-2">Terms</span> and{' '}
            <span className="underline underline-offset-2">Privacy Policy</span>.
          </p>

          <div
            ref={recaptchaContainerRef}
            id="admin-recaptcha-container"
            className="mt-4"
          />
        </div>
      </div>
    </main>
  );
}

function humaniseAuthError(code: string, err: unknown): string {
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number does not look valid to Firebase.';
    case 'auth/too-many-requests':
      return 'Too many attempts from this device. Wait a few minutes.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded for this project today.';
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is disabled. Enable it in Firebase Console -> Authentication -> Sign-in method.';
    case 'auth/billing-not-enabled':
      return 'Firebase project needs billing enabled to send SMS.';
    case 'auth/captcha-check-failed':
      return 'reCAPTCHA failed. Reload the page and try again.';
    default:
      return (
        (err as {message?: string} | null)?.message ??
        'Could not send the code. Please try again.'
      );
  }
}
