'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {callFn} from '@zerebro/shared-firebase';

import {useOwnSchool} from '@/lib/ownSchool';

interface PaymentEvent {
  id: string;
  eventType: string;
  amount: number | null;
  razorpayPaymentId: string | null;
  processedAt: number | null;
  subscriptionId: string;
}

const EVENT_LABELS: Record<string, {label: string; color: string}> = {
  'subscription.charged': {label: 'Payment Success', color: 'text-green-700 bg-green-100'},
  'subscription.activated': {label: 'Activated', color: 'text-green-700 bg-green-100'},
  'subscription.pending': {label: 'Payment Failed', color: 'text-red-700 bg-red-100'},
  'subscription.halted': {label: 'Halted', color: 'text-red-700 bg-red-100'},
  'subscription.cancelled': {label: 'Cancelled', color: 'text-gray-700 bg-gray-100'},
  'subscription.authenticated': {label: 'Authenticated', color: 'text-blue-700 bg-blue-100'},
  'subscription.resumed': {label: 'Resumed', color: 'text-green-700 bg-green-100'},
  'subscription.paused': {label: 'Paused', color: 'text-yellow-700 bg-yellow-100'},
};

function humanisePaymentHistoryError(err: unknown): string {
  const code = (err as {code?: string} | null)?.code ?? '';
  switch (code) {
    case 'functions/permission-denied':
      return "You don't have access to this school's payment history.";
    case 'functions/not-found':
      return 'School not found.';
    case 'functions/failed-precondition':
      return (
        (err as {message?: string} | null)?.message ??
        'Payment history is being set up. Please try again in a few minutes.'
      );
    case 'functions/internal':
      return 'Unable to load payment history. Please try again later.';
    default:
      return 'Failed to load payment history.';
  }
}

export default function PaymentHistoryPage() {
  const {schoolId, loading: schoolLoading} = useOwnSchool();
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchEvents = useCallback(async (startAfter?: string) => {
    if (!schoolId) return;
    try {
      const result = await callFn<
        {schoolId: string; limit?: number; startAfter?: string},
        {events: PaymentEvent[]; hasMore: boolean}
      >('getPaymentHistory', {schoolId, limit: 20, startAfter});

      setError(null);
      if (startAfter) {
        setEvents(prev => [...prev, ...result.events]);
      } else {
        setEvents(result.events);
      }
      setHasMore(result.hasMore);
    } catch (err: unknown) {
      setError(humanisePaymentHistoryError(err));
    }
  }, [schoolId]);

  useEffect(() => {
    if (schoolLoading || !schoolId) return;
    setLoading(true);
    fetchEvents().finally(() => setLoading(false));
  }, [schoolLoading, schoolId, fetchEvents]);

  const handleLoadMore = async () => {
    const lastEvent = events[events.length - 1];
    if (!lastEvent) return;
    setLoadingMore(true);
    await fetchEvents(lastEvent.id);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading payment history...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pt-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Payment History</h1>
        <Link href="/subscription" className="text-sm text-indigo-600 hover:underline">
          ← Back to Subscription
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {events.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">No payment history yet.</p>
          <p className="mt-1 text-xs text-text-muted">
            Events will appear here after your first payment.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-alt text-xs uppercase tracking-widest text-text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {events.map(event => {
                  const meta = EVENT_LABELS[event.eventType] || {
                    label: event.eventType.replace('subscription.', ''),
                    color: 'text-gray-700 bg-gray-100',
                  };
                  return (
                    <tr key={event.id}>
                      <td className="px-4 py-3 text-text">
                        {event.processedAt
                          ? new Date(event.processedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-text">
                        {event.amount
                          ? `₹${(event.amount / 100).toLocaleString('en-IN')}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {event.razorpayPaymentId || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface-alt disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
