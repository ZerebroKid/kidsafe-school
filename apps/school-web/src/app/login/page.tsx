'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult} from 'firebase/auth';
import {getAuthInstance, normalizePhoneToE164} from '@zerebro/shared-firebase';

const SESSION_KEYS = {
  verificationId: 'zerebro.school.otp.verificationId',
  phone: 'zerebro.school.otp.phone',
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      try { verifier.current?.clear(); } catch { /* ignore */ }
    };
  }, []);

  const submit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = normalizePhoneToE164(phone);
    if (!parsed.ok || !parsed.e164) {
      setError(parsed.error ?? 'Enter a valid mobile number.');
      return;
    }
    if (!box.current) return;
    setLoading(true);
    try { verifier.current?.clear(); } catch { /* ignore */ }
    const auth = getAuthInstance();
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      auth.settings.appVerificationDisabledForTesting = true;
    }
    const recaptcha = new RecaptchaVerifier(auth, box.current, {size: 'invisible'});
    verifier.current = recaptcha;
    try {
      const result: ConfirmationResult = await signInWithPhoneNumber(auth, parsed.e164, recaptcha);
      sessionStorage.setItem(SESSION_KEYS.verificationId, result.verificationId);
      sessionStorage.setItem(SESSION_KEYS.phone, parsed.e164);
      router.push('/login/confirm');
    } catch (err) {
      const code = (err as {code?: string}).code ?? '';
      setError(code === 'auth/invalid-phone-number' ? 'That mobile number is not valid.' : 'Could not send the code. Try again.');
      try { recaptcha.clear(); } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  }, [phone, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">School sign in</h1>
      <p className="mt-2 text-sm text-text-muted">Use the school mobile number. A new principal gets their own school.</p>
      <form className="mt-6 flex flex-col gap-3" onSubmit={submit}>
        <label className="text-sm font-medium">
          Mobile number
          <input
            className="mt-1 w-full rounded-xl border border-border bg-surface-alt px-3 py-2"
            inputMode="tel"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder="9876543210"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button className="rounded-xl bg-primary px-4 py-2 font-medium text-primary-text" disabled={loading} type="submit">
          {loading ? 'Sending…' : 'Send code'}
        </button>
      </form>
      <div ref={box} />
    </main>
  );
}
