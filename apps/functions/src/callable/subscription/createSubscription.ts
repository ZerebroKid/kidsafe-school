/**
 * SUB.4.1 -- Creates a Razorpay subscription for a school.
 *
 * Called by the principal from the /subscription page. Reads the school's
 * studentCount, creates a Razorpay subscription with quantity = studentCount,
 * stores the initial SubscriptionDoc in Firestore, and returns the
 * subscription_id + short_url for the frontend to open Razorpay Checkout.
 *
 * Idempotent: if a subscription in `created` or `authenticated` state already
 * exists, returns it without creating a duplicate. If `cancelled`/`expired`/
 * `halted`, creates a fresh one.
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
  RAZORPAY_PLAN_ID,
  AMOUNT_PER_STUDENT_PAISE,
} from '../../lib/razorpay';
import type {
  CreateSubscriptionInput,
  CreateSubscriptionOutput,
  SubscriptionStatus,
} from '../../lib/sharedTypes';

export const createSubscription = onCall<
  CreateSubscriptionInput,
  Promise<CreateSubscriptionOutput>
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
    const schoolData = schoolSnap.data()!;
    if (schoolData.principalUid !== caller.uid) {
      throw new HttpsError(
        'permission-denied',
        'You are not the principal of this school.',
      );
    }

    const studentCount = schoolData.studentCount as number | undefined;
    if (!studentCount || studentCount < 1) {
      throw new HttpsError(
        'failed-precondition',
        'Student count not set. Please update your school details first.',
      );
    }

    const planId = RAZORPAY_PLAN_ID.value();
    if (!planId) {
      throw new HttpsError(
        'internal',
        'Razorpay plan not configured. Contact support.',
      );
    }

    // Use a transaction to prevent two concurrent tabs from creating
    // duplicate Razorpay subscriptions.
    const subRef = schoolRef.collection('subscription').doc('current');

    const result = await db().runTransaction(async t => {
      const subSnap = await t.get(subRef);

      if (subSnap.exists) {
        const existing = subSnap.data()!;
        const status = existing.status as SubscriptionStatus;

        if (status === 'active') {
          return {
            subscriptionId: existing.razorpaySubscriptionId as string,
            shortUrl: '' as string,
            amount: existing.totalAmount as number,
            quantity: existing.quantity as number,
            alreadyActive: true,
            _created: false as const,
          };
        }

        // Retry-safe: return existing sub if it hasn't been paid yet
        if (status === 'created' || status === 'authenticated') {
          return {
            subscriptionId: existing.razorpaySubscriptionId as string,
            shortUrl: (existing.shortUrl ?? '') as string,
            amount: existing.totalAmount as number,
            quantity: existing.quantity as number,
            _created: false as const,
          };
        }

        // cancelled/expired/halted/completed -> create fresh (below)
      }

      // Create Razorpay subscription outside transaction (network call),
      // but mark the doc as 'creating' inside the transaction to prevent
      // a concurrent call from racing past the existence check.
      t.set(subRef, {
        status: 'creating',
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});

      return {_created: true as const, studentCount};
    });

    // If transaction returned an existing subscription, return it directly
    if (!result._created) {
      return {
        subscriptionId: result.subscriptionId!,
        shortUrl: result.shortUrl!,
        amount: result.amount!,
        quantity: result.quantity!,
        ...(result.alreadyActive ? {alreadyActive: true} : {}),
      };
    }

    // Create the Razorpay subscription (network call, outside transaction)
    const razorpay = getRazorpayInstance();
    let rzpSub: Record<string, unknown>;
    try {
      rzpSub = await (razorpay as any).subscriptions.create({
        plan_id: planId,
        quantity: studentCount,
        total_count: 1200,
        customer_notify: false,
        notes: {
          schoolId,
          principalUid: caller.uid,
        },
      });
    } catch (err: unknown) {
      await subRef.delete();
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Razorpay subscription creation failed', {schoolId, error: msg});
      throw new HttpsError(
        'internal',
        `Failed to create Razorpay subscription: ${msg}`,
      );
    }

    logger.info('Razorpay subscription created', {
      schoolId,
      subscriptionId: rzpSub.id,
      quantity: studentCount,
    });

    const totalAmount = studentCount * AMOUNT_PER_STUDENT_PAISE;

    // Write the full subscription doc
    await subRef.set({
      razorpaySubscriptionId: rzpSub.id,
      razorpayCustomerId: null,
      razorpayPlanId: planId,
      status: 'created',
      quantity: studentCount,
      amountPerStudent: AMOUNT_PER_STUDENT_PAISE,
      totalAmount,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      nextChargeAt: rzpSub.charge_at ?? null,
      lastChargeFailedAt: null,
      gracePeriodEnd: null,
      pendingQuantity: null,
      hasScheduledChanges: false,
      manuallyActivated: false,
      manuallyActivatedBy: null,
      manuallyActivatedUntil: null,
      shortUrl: rzpSub.short_url ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      cancelledAt: null,
    });

    return {
      subscriptionId: rzpSub.id as string,
      shortUrl: (rzpSub.short_url as string) ?? '',
      amount: totalAmount,
      quantity: studentCount,
    };
  },
);
