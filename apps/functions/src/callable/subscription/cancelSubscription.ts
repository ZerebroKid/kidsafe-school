/**
 * SUB.4.4 -- Cancels a school's Razorpay subscription.
 *
 * Calls Razorpay's cancel API and updates the Firestore subscription doc.
 * Cancellation is immediate — features are blocked right away.
 * Idempotent: calling on an already-cancelled subscription returns success.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

import {db} from '../../lib/admin';
import {requireAuth, requireRole} from '../../lib/auth';
import {
  getRazorpayInstance,
  razorpayKeyId,
  razorpayKeySecret,
} from '../../lib/razorpay';
import type {
  CancelSubscriptionInput,
  CancelSubscriptionOutput,
} from '../../lib/sharedTypes';

export const cancelSubscription = onCall<
  CancelSubscriptionInput,
  Promise<CancelSubscriptionOutput>
>(
  {
    region: 'asia-south1',
    secrets: [razorpayKeyId, razorpayKeySecret],
  },
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'principal');

    const {schoolId} = request.data ?? {};
    if (!schoolId || typeof schoolId !== 'string') {
      throw new HttpsError('invalid-argument', 'schoolId is required.');
    }

    // Verify caller owns this school
    const schoolRef = db().collection('schools').doc(schoolId);
    const schoolSnap = await schoolRef.get();
    if (!schoolSnap.exists) {
      throw new HttpsError('not-found', 'School not found.');
    }
    if (schoolSnap.data()!.principalUid !== caller.uid) {
      throw new HttpsError(
        'permission-denied',
        'You are not the principal of this school.',
      );
    }

    const subRef = schoolRef.collection('subscription').doc('current');
    const subSnap = await subRef.get();

    if (!subSnap.exists) {
      throw new HttpsError('not-found', 'No subscription found for this school.');
    }

    const subData = subSnap.data()!;

    // Idempotent: already cancelled
    if (subData.status === 'cancelled') {
      return {
        cancelled: false,
        alreadyCancelled: true,
        cancelledAt: subData.cancelledAt ?? null,
      };
    }

    // Cancel in Razorpay
    const razorpay = getRazorpayInstance();
    try {
      await (razorpay as any).subscriptions.cancel(
        subData.razorpaySubscriptionId,
      );
    } catch (err: unknown) {
      // If Razorpay says it's already cancelled, still update our DB
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('already cancelled') && !msg.includes('already been cancelled')) {
        throw new HttpsError(
          'internal',
          `Failed to cancel Razorpay subscription: ${msg}`,
        );
      }
    }

    // Update Firestore
    await subRef.update({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Subscription cancelled', {
      schoolId,
      subscriptionId: subData.razorpaySubscriptionId,
    });

    return {
      cancelled: true,
      cancelledAt: Date.now(),
    };
  },
);
