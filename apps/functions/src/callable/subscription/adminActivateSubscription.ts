/**
 * SUB.4.5 -- Admin-only callable to force-activate a school's subscription.
 *
 * Used for demos, offline payments, or special arrangements. Sets
 * manuallyActivated = true with an expiry date. Pass `until: null` to
 * deactivate the override.
 *
 * Works even when no Razorpay subscription exists — creates a minimal
 * subscription doc with the override fields.
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue, Timestamp} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

import {db} from '../../lib/admin';
import {requireAuth, requireRole} from '../../lib/auth';
import type {AdminActivateInput, AdminActivateOutput} from '../../lib/sharedTypes';

export const adminActivateSubscription = onCall<
  AdminActivateInput,
  Promise<AdminActivateOutput>
>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'admin');

    const {schoolId, until} = request.data ?? {};
    if (!schoolId || typeof schoolId !== 'string') {
      throw new HttpsError('invalid-argument', 'schoolId is required.');
    }

    // Verify school exists
    const schoolRef = db().collection('schools').doc(schoolId);
    const schoolSnap = await schoolRef.get();
    if (!schoolSnap.exists) {
      throw new HttpsError('not-found', 'School not found.');
    }

    const subRef = schoolRef.collection('subscription').doc('current');
    const subSnap = await subRef.get();

    // Deactivate override
    if (until === null || until === undefined) {
      if (subSnap.exists) {
        await subRef.update({
          manuallyActivated: false,
          manuallyActivatedBy: null,
          manuallyActivatedUntil: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      logger.info('Admin override deactivated', {schoolId, deactivatedBy: caller.uid});
      return {activated: false, deactivated: true, activatedUntil: null};
    }

    // Parse and validate the expiry date
    let untilMs: number;
    if (typeof until === 'number') {
      untilMs = until;
    } else if (typeof until === 'string') {
      untilMs = new Date(until).getTime();
    } else {
      throw new HttpsError(
        'invalid-argument',
        'until must be an ISO date string, Unix ms number, or null.',
      );
    }

    if (isNaN(untilMs) || untilMs <= Date.now()) {
      throw new HttpsError(
        'invalid-argument',
        'until must be a future date.',
      );
    }

    const untilTimestamp = Timestamp.fromMillis(untilMs);

    const overrideFields = {
      manuallyActivated: true,
      manuallyActivatedBy: caller.uid,
      manuallyActivatedUntil: untilTimestamp,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (subSnap.exists) {
      await subRef.update(overrideFields);
    } else {
      // Create a minimal subscription doc with just override fields
      await subRef.set({
        razorpaySubscriptionId: '',
        razorpayCustomerId: null,
        razorpayPlanId: '',
        status: 'created',
        quantity: 0,
        amountPerStudent: 0,
        totalAmount: 0,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        nextChargeAt: null,
        lastChargeFailedAt: null,
        gracePeriodEnd: null,
        pendingQuantity: null,
        hasScheduledChanges: false,
        cancelledAt: null,
        createdAt: FieldValue.serverTimestamp(),
        ...overrideFields,
      });
    }

    logger.info('Admin override activated', {
      schoolId,
      activatedBy: caller.uid,
      activatedUntil: untilMs,
    });

    return {activated: true, deactivated: false, activatedUntil: untilMs};
  },
);
