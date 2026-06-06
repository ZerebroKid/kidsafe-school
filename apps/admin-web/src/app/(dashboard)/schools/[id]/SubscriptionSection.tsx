'use client';

import {useEffect, useState} from 'react';
import {Timestamp, doc, onSnapshot} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';

interface SubscriptionData {
  status?: string;
  quantity?: number;
  totalAmount?: number;
  amountPerStudent?: number;
  nextChargeAt?: number | null;
  currentPeriodEnd?: number | null;
  manuallyActivated?: boolean;
  manuallyActivatedBy?: string | null;
  manuallyActivatedUntil?: Timestamp | number | null;
  gracePeriodEnd?: number | null;
  lastChargeFailedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
}

const STATUS_BADGE: Record<string, {bg: string; text: string; label: string}> = {
  active: {bg: 'bg-green-100', text: 'text-green-700', label: 'Active'},
  authenticated: {bg: 'bg-blue-100', text: 'text-blue-700', label: 'Authenticated'},
  created: {bg: 'bg-gray-100', text: 'text-gray-700', label: 'Created'},
  pending: {bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Payment Pending'},
  halted: {bg: 'bg-red-100', text: 'text-red-700', label: 'Halted'},
  cancelled: {bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled'},
  expired: {bg: 'bg-gray-100', text: 'text-gray-600', label: 'Expired'},
  completed: {bg: 'bg-gray-100', text: 'text-gray-600', label: 'Completed'},
};

export function SubscriptionSection({schoolId}: {schoolId: string}) {
  const [sub, setSub] = useState<SubscriptionData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [overrideDate, setOverrideDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onSnapshot(
      doc(getFirestoreInstance(), 'schools', schoolId, 'subscription', 'current'),
      snap => {
        setSub(snap.exists() ? (snap.data() as SubscriptionData) : null);
        setError(null);
      },
      err => {
        setError(err.message);
        setSub(null);
      },
    );
    return unsub;
  }, [schoolId]);

  const handleActivate = async () => {
    if (!overrideDate) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const until = new Date(overrideDate).getTime();
      if (until <= Date.now()) {
        setActionError('Expiry date must be in the future.');
        setActionLoading(false);
        return;
      }
      await callFn<
        {schoolId: string; until: number | null},
        {activated?: boolean; deactivated?: boolean}
      >('adminActivateSubscription', {schoolId, until});
      setOverrideDate('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Override failed';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await callFn<
        {schoolId: string; until: number | null},
        {activated?: boolean; deactivated?: boolean}
      >('adminActivateSubscription', {schoolId, until: null});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deactivation failed';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (sub === undefined) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-xs uppercase tracking-widest text-text-muted">Subscription</p>
        <p className="mt-2 text-sm text-text-muted">Loading...</p>
      </section>
    );
  }

  const badge = sub?.status ? STATUS_BADGE[sub.status] || STATUS_BADGE.expired : null;
  const overrideActive = sub?.manuallyActivated === true;
  const overrideUntil = sub?.manuallyActivatedUntil
    ? typeof sub.manuallyActivatedUntil === 'number'
      ? new Date(sub.manuallyActivatedUntil)
      : (sub.manuallyActivatedUntil as Timestamp).toDate()
    : null;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <p className="text-xs uppercase tracking-widest text-text-muted">Subscription</p>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      {sub === null ? (
        <p className="mt-3 text-sm text-text-muted">No subscription yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Status badge */}
          <div className="flex items-center gap-3">
            {badge && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            )}
            {overrideActive && (
              <span className="text-xs text-indigo-600 font-medium">
                Admin override active
                {overrideUntil && ` until ${overrideUntil.toLocaleDateString('en-IN')}`}
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-text-muted">Students</p>
              <p className="font-medium text-text">{sub.quantity ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Monthly</p>
              <p className="font-medium text-text">
                {sub.totalAmount ? `₹${(sub.totalAmount / 100).toLocaleString('en-IN')}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Next charge</p>
              <p className="font-medium text-text">
                {sub.nextChargeAt ? new Date(sub.nextChargeAt).toLocaleDateString('en-IN') : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin override controls (SUB.8.2) */}
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-xs font-medium text-text-muted uppercase tracking-widest">
          Admin Override
        </p>

        {actionError && (
          <p className="mb-2 text-xs text-red-600">{actionError}</p>
        )}

        {overrideActive ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-text">
              Override active{overrideUntil && ` until ${overrideUntil.toLocaleDateString('en-IN')}`}
            </p>
            <button
              onClick={handleDeactivate}
              disabled={actionLoading}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Deactivate'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="date"
              min={todayStr}
              value={overrideDate}
              onChange={e => setOverrideDate(e.target.value)}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm"
            />
            <button
              onClick={handleActivate}
              disabled={actionLoading || !overrideDate}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Activate Override'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
