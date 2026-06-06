/**
 * SUB.9.1 -- Returns payment events for a school.
 *
 * Firestore rules restrict `paymentEvents` to admin-only reads, so principals
 * access their payment history via this callable which enforces ownership and
 * returns only events belonging to their school.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

import {db} from '../../lib/admin';
import {requireAuth, requireRole} from '../../lib/auth';

interface PaymentHistoryInput {
  schoolId: string;
  limit?: number;
  startAfter?: string;
}

interface PaymentEvent {
  id: string;
  eventType: string;
  amount: number | null;
  razorpayPaymentId: string | null;
  processedAt: number | null;
  subscriptionId: string;
}

interface PaymentHistoryOutput {
  events: PaymentEvent[];
  hasMore: boolean;
}

export const getPaymentHistory = onCall<
  PaymentHistoryInput,
  Promise<PaymentHistoryOutput>
>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'principal');

    const {schoolId, limit: queryLimit = 20, startAfter} = request.data ?? {};
    if (!schoolId || typeof schoolId !== 'string') {
      throw new HttpsError('invalid-argument', 'schoolId is required.');
    }

    // Verify caller owns this school
    const schoolSnap = await db().collection('schools').doc(schoolId).get();
    if (!schoolSnap.exists) {
      throw new HttpsError('not-found', 'School not found.');
    }
    if (schoolSnap.data()!.principalUid !== caller.uid) {
      throw new HttpsError(
        'permission-denied',
        'You are not the principal of this school.',
      );
    }

    const cap = Math.min(Math.max(queryLimit, 1), 50);

    let snap;
    try {
      // Equality-only query — no composite index required. Per-school event
      // volume is small (monthly billing), so in-memory sort is fine.
      snap = await db()
        .collection('paymentEvents')
        .where('schoolId', '==', schoolId)
        .get();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('getPaymentHistory query failed', {schoolId, message});
      throw new HttpsError(
        'internal',
        'Payment history is temporarily unavailable.',
      );
    }

    const allEvents: PaymentEvent[] = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          eventType: data.eventType ?? '',
          amount: data.amount ?? null,
          razorpayPaymentId: data.razorpayPaymentId ?? null,
          processedAt: data.processedAt?.toMillis?.() ?? data.processedAt ?? null,
          subscriptionId: data.subscriptionId ?? '',
        };
      })
      .sort((a, b) => (b.processedAt ?? 0) - (a.processedAt ?? 0));

    let startIndex = 0;
    if (startAfter) {
      const cursorIndex = allEvents.findIndex(e => e.id === startAfter);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const events = allEvents.slice(startIndex, startIndex + cap);
    const hasMore = startIndex + cap < allEvents.length;

    return {events, hasMore};
  },
);
