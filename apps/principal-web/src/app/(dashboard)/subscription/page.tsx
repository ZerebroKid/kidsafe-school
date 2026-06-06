'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {callFn} from '@zerebro/shared-firebase';
import type {GetSubscriptionStatusOutput} from '@zerebro/shared-types';

import {useOwnSchool} from '@/lib/ownSchool';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {open: () => void};
  }
}

type SubStatus = {
  isActive: boolean;
  status: string | null;
  graceRemainingHours: number | null;
  manuallyActivated: boolean;
  quantity?: number;
  totalAmount?: number;
  nextChargeAt?: number | null;
  currentPeriodEnd?: number | null;
};

function toMillis(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const ms = (value as {toMillis: () => number}).toMillis();
    return typeof ms === 'number' ? ms : null;
  }
  return null;
}

function toSubView(result: GetSubscriptionStatusOutput): SubStatus {
  const sub = result.subscription;
  return {
    isActive: result.isActive,
    status: sub?.status ?? null,
    graceRemainingHours: result.graceRemainingHours,
    manuallyActivated: sub?.manuallyActivated ?? false,
    quantity: sub?.quantity,
    totalAmount: sub?.totalAmount,
    nextChargeAt: toMillis(sub?.nextChargeAt),
    currentPeriodEnd: toMillis(sub?.currentPeriodEnd),
  };
}

type PageState =
  | {kind: 'loading'}
  | {kind: 'no-school'}
  | {kind: 'no-subscription'; studentCount: number}
  | {kind: 'active'; sub: SubStatus; studentCount: number}
  | {kind: 'grace'; sub: SubStatus; studentCount: number}
  | {kind: 'blocked'; sub: SubStatus; studentCount: number}
  | {kind: 'verifying'}
  | {kind: 'error'; message: string};

export default function SubscriptionPage() {
  const router = useRouter();
  const {schoolId, loading: schoolLoading} = useOwnSchool();
  const [state, setState] = useState<PageState>({kind: 'loading'});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Update student count state ---
  const [newCount, setNewCount] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelInput, setCancelInput] = useState('');

  const fetchStatus = useCallback(async () => {
    if (!schoolId) return null;
    try {
      const result = await callFn<
        {schoolId: string},
        GetSubscriptionStatusOutput
      >('getSubscriptionStatus', {schoolId});
      return result;
    } catch {
      return null;
    }
  }, [schoolId]);

  const loadPage = useCallback(async () => {
    if (!schoolId) {
      setState({kind: 'no-school'});
      return;
    }

    const result = await fetchStatus();
    if (!result) {
      setState({kind: 'error', message: 'Unable to load subscription status. Please try again.'});
      return;
    }

    const studentCount =
      result.studentCount ?? result.subscription?.quantity ?? 0;
    const status = result.subscription?.status ?? null;
    const sub = toSubView(result);

    if (
      !result.exists ||
      !status ||
      status === 'cancelled' ||
      status === 'expired' ||
      status === 'completed'
    ) {
      setState({kind: 'no-subscription', studentCount});
      return;
    }

    if (
      result.isActive &&
      (status === 'active' ||
        status === 'authenticated' ||
        result.subscription?.manuallyActivated)
    ) {
      setState({kind: 'active', sub, studentCount});
      return;
    }

    if (
      result.isActive &&
      result.graceRemainingHours != null &&
      result.graceRemainingHours > 0
    ) {
      setState({kind: 'grace', sub, studentCount});
      return;
    }

    if (status === 'halted') {
      setState({kind: 'blocked', sub, studentCount});
      return;
    }

    if (status === 'authenticated' && !result.isActive) {
      setState({kind: 'verifying'});
      return;
    }

    // created/creating (awaiting first payment)
    setState({kind: 'no-subscription', studentCount});
  }, [schoolId, fetchStatus]);

  useEffect(() => {
    if (schoolLoading) return;
    loadPage();
  }, [schoolLoading, loadPage]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // --- Checkout flow ---
  const handleSubscribe = async () => {
    if (!schoolId) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const result = await callFn<
        {schoolId: string},
        {subscriptionId: string; shortUrl: string; amount: number; quantity: number}
      >('createSubscription', {schoolId});

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId || typeof window.Razorpay === 'undefined') {
        // Fallback: open short URL
        window.open(result.shortUrl, '_blank');
        setActionLoading(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: keyId,
        subscription_id: result.subscriptionId,
        name: 'Zerebro Campus',
        description: `School Subscription — ${result.quantity} students`,
        handler: () => {
          startVerificationPolling();
        },
        modal: {
          ondismiss: () => {
            setActionLoading(false);
          },
        },
        theme: {color: '#4F46E5'},
      });
      rzp.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create subscription';
      setActionError(msg);
      setActionLoading(false);
    }
  };

  // --- Post-payment polling (SUB.7.3) ---
  const startVerificationPolling = () => {
    setState({kind: 'verifying'});
    let attempts = 0;
    const maxAttempts = 10;

    pollRef.current = setInterval(async () => {
      attempts++;
      const result = await fetchStatus();
      if (result?.isActive) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        router.replace('/dashboard');
        return;
      }
      if (attempts >= maxAttempts) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setState({
          kind: 'error',
          message: 'Payment received! It may take a moment to activate. Please refresh the page.',
        });
      }
    }, 3000);
  };

  // --- Update student count (SUB.7.2) ---
  const handleUpdateCount = async () => {
    if (!schoolId || !newCount) return;
    const count = Math.floor(Number(newCount));
    if (count < 1 || count > 50000) {
      setActionError('Student count must be between 1 and 50,000');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await callFn<
        {schoolId: string; newCount: number},
        {newCount: number; effectiveFrom: string; newMonthlyAmount: number}
      >('updateStudentCount', {schoolId, newCount: count});
      setNewCount('');
      await loadPage();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update student count';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // --- Cancel subscription (SUB.7.2) ---
  const handleCancel = async () => {
    if (!schoolId || cancelInput !== 'CANCEL') return;
    setActionLoading(true);
    setActionError(null);
    try {
      await callFn<{schoolId: string}, {cancelled: boolean}>('cancelSubscription', {schoolId});
      setShowCancel(false);
      setCancelInput('');
      await loadPage();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel subscription';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // --- Render ---
  if (state.kind === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading subscription...</p>
      </div>
    );
  }

  if (state.kind === 'verifying') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-text-muted">Verifying your payment...</p>
        <p className="text-xs text-text-muted">This may take a few seconds.</p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-lg pt-12 text-center">
        <p className="mb-4 text-sm text-text-muted">{state.message}</p>
        <button
          onClick={() => { setState({kind: 'loading'}); loadPage(); }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.kind === 'no-school') {
    return (
      <div className="mx-auto max-w-lg pt-12 text-center">
        <p className="text-sm text-text-muted">No school found. Please complete onboarding first.</p>
      </div>
    );
  }

  // No subscription / cancelled / expired → pricing card + subscribe
  if (state.kind === 'no-subscription' || state.kind === 'blocked') {
    const studentCount = state.studentCount || 0;
    const total = studentCount * 99;
    const isResubscribe = state.kind === 'blocked';

    return (
      <div className="mx-auto max-w-xl pt-8">
        <h1 className="mb-6 text-2xl font-bold text-text">
          {isResubscribe ? 'Renew Subscription' : 'Subscribe to Zerebro Campus'}
        </h1>

        {actionError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
        )}

        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 text-center">
            <p className="text-4xl font-bold text-text">
              ₹{total.toLocaleString('en-IN')}
              <span className="text-lg font-normal text-text-muted">/month</span>
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {studentCount} students × ₹99/student
            </p>
          </div>

          <ul className="mb-6 space-y-2 text-sm text-text-muted">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Full access to all dashboard features
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Automated monthly billing via UPI/Card
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Update student count anytime
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Cancel anytime
            </li>
          </ul>

          <button
            onClick={handleSubscribe}
            disabled={actionLoading || studentCount < 1}
            className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : isResubscribe ? 'Re-subscribe Now' : 'Subscribe Now'}
          </button>

          {studentCount < 1 && (
            <p className="mt-2 text-center text-xs text-red-500">
              Please set your student count in onboarding before subscribing.
            </p>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link href="/subscription/history" className="text-xs text-indigo-600 hover:underline">
            View Payment History
          </Link>
        </div>
      </div>
    );
  }

  // Grace period
  if (state.kind === 'grace') {
    const total = state.studentCount * 99;
    return (
      <div className="mx-auto max-w-xl pt-8">
        <h1 className="mb-6 text-2xl font-bold text-text">Subscription</h1>

        {actionError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
        )}

        <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-6">
          <p className="mb-2 text-sm font-medium text-yellow-800">Payment Failed</p>
          <p className="mb-4 text-sm text-yellow-700">
            Your last payment failed. You have{' '}
            <strong>{Math.ceil(state.sub.graceRemainingHours ?? 0)} hours</strong> left
            before your access is blocked.
          </p>
          <p className="mb-4 text-lg font-bold text-text">
            ₹{total.toLocaleString('en-IN')}/month
          </p>
          <button
            onClick={handleSubscribe}
            disabled={actionLoading}
            className="w-full rounded-lg bg-yellow-600 py-3 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Pay Now'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link href="/subscription/history" className="text-xs text-indigo-600 hover:underline">
            View Payment History
          </Link>
        </div>
      </div>
    );
  }

  // Active subscription → status + manage
  const {sub, studentCount} = state;
  const total = studentCount * 99;
  const nextCharge = sub.nextChargeAt ? new Date(sub.nextChargeAt).toLocaleDateString('en-IN') : '—';

  return (
    <div className="mx-auto max-w-xl pt-8">
      <h1 className="mb-6 text-2xl font-bold text-text">Subscription</h1>

      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Status card */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Active
          </span>
          {sub.manuallyActivated && (
            <span className="text-xs text-text-muted">Admin override</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-muted">Monthly amount</p>
            <p className="font-semibold text-text">₹{total.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-text-muted">Students</p>
            <p className="font-semibold text-text">{studentCount}</p>
          </div>
          <div>
            <p className="text-text-muted">Next charge</p>
            <p className="font-semibold text-text">{nextCharge}</p>
          </div>
          <div>
            <p className="text-text-muted">Rate</p>
            <p className="font-semibold text-text">₹99/student</p>
          </div>
        </div>
      </div>

      {/* Manage section (SUB.7.2) */}
      {!sub.manuallyActivated && (
        <div className="mt-6 space-y-6">
          {/* Update student count */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-text">Update Student Count</h3>
            <p className="mb-3 text-xs text-text-muted">
              Changes take effect at the start of your next billing cycle.
            </p>
            <div className="flex gap-3">
              <input
                type="number"
                min={1}
                max={50000}
                value={newCount}
                onChange={e => setNewCount(e.target.value)}
                placeholder={String(studentCount)}
                className="w-32 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
              />
              {newCount && Number(newCount) >= 1 && (
                <span className="flex items-center text-xs text-text-muted">
                  = ₹{(Math.floor(Number(newCount)) * 99).toLocaleString('en-IN')}/month
                </span>
              )}
              <button
                onClick={handleUpdateCount}
                disabled={actionLoading || !newCount || Number(newCount) < 1}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          {/* Cancel subscription */}
          <div className="rounded-xl border border-red-200 bg-surface p-5">
            <h3 className="mb-2 text-sm font-semibold text-red-700">Cancel Subscription</h3>
            <p className="mb-3 text-xs text-text-muted">
              Cancelling will immediately block access to all features.
            </p>
            {!showCancel ? (
              <button
                onClick={() => setShowCancel(true)}
                className="rounded-lg border border-red-300 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Cancel Subscription
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-red-600">
                  Type <strong>CANCEL</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={cancelInput}
                  onChange={e => setCancelInput(e.target.value)}
                  placeholder="Type CANCEL"
                  className="w-48 rounded-lg border border-red-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading || cancelInput !== 'CANCEL'}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Cancel
                  </button>
                  <button
                    onClick={() => { setShowCancel(false); setCancelInput(''); }}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-text-muted hover:bg-surface-alt"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/subscription/history" className="text-xs text-indigo-600 hover:underline">
          View Payment History →
        </Link>
      </div>
    </div>
  );
}
