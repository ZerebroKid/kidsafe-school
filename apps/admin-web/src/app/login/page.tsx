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

  useEffect(() => {
    if (!recaptchaContainerRef.current) return;
    const verifier = new RecaptchaVerifier(
      getAuthInstance(),
      recaptchaContainerRef.current,
      {size: 'invisible'},
    );
    recaptchaRef.current = verifier;
    return () => {
      verifier.clear();
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
      const verifier = recaptchaRef.current;
      if (!verifier) {
        setError('reCAPTCHA is still loading. Try again in a moment.');
        return;
      }
      setLoading(true);
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
        try {
          recaptchaRef.current?.clear();
        } catch {
          // ignore -- reCAPTCHA reset is best-effort, the form is recoverable
        }
        recaptchaRef.current = null;
        if (recaptchaContainerRef.current) {
          const verifierRetry = new RecaptchaVerifier(
            getAuthInstance(),
            recaptchaContainerRef.current,
            {size: 'invisible'},
          );
          recaptchaRef.current = verifierRetry;
        }
      } finally {
        setLoading(false);
      }
    },
    [phone, router],
  );

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-lg">
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Zerebro Admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-text">
          Internal operations console
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Phone-based sign-in. Access is gated by the
          <code className="mx-1 rounded bg-bg px-1 py-0.5 text-xs text-text-muted">
            users/{'{uid}'}.roles
          </code>
          array; ask the on-call admin to add yours.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Mobile number</span>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              disabled={loading}
              required
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
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-text disabled:opacity-60"
          >
            {loading ? 'Sending code…' : 'Send code'}
          </button>
        </form>
        <div
          ref={recaptchaContainerRef}
          id="admin-recaptcha-container"
          className="mt-4"
        />
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
