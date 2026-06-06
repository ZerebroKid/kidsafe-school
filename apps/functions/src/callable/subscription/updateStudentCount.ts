/**
 * SUB.4.3 -- Updates the student count for a school.
 *
 * Updates the school doc's studentCount field. If an active Razorpay
 * subscription exists, also calls Razorpay's update API with
 * schedule_change_at: "cycle_end" so the new quantity takes effect
 * on the next billing cycle (no proration mid-cycle).
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
  AMOUNT_PER_STUDENT_PAISE,
} from '../../lib/razorpay';
import type {
  UpdateStudentCountInput,
  UpdateStudentCountOutput,
} from '../../lib/sharedTypes';

export const updateStudentCount = onCall<
  UpdateStudentCountInput,
  Promise<UpdateStudentCountOutput>
>(
  {
    region: 'asia-south1',
    secrets: [razorpayKeyId, razorpayKeySecret],
  },
  async request => {
    const caller = requireAuth(request);
    await requireRole(caller.uid, 'principal');

    const {schoolId, newCount} = request.data ?? {};
    if (!schoolId || typeof schoolId !== 'string') {
      throw new HttpsError('invalid-argument', 'schoolId is required.');
    }
    if (
      typeof newCount !== 'number' ||
      !Number.isInteger(newCount) ||
      newCount < 1 ||
      newCount > 50000
    ) {
      throw new HttpsError(
        'invalid-argument',
        'newCount must be an integer between 1 and 50,000.',
      );
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

    // Update school doc
    await schoolRef.update({studentCount: newCount});

    // If there's an active subscription, update Razorpay quantity
    const subRef = schoolRef.collection('subscription').doc('current');
    const subSnap = await subRef.get();

    if (subSnap.exists) {
      const subData = subSnap.data()!;
      if (subData.status === 'active') {
        const razorpay = getRazorpayInstance();
        try {
          await (razorpay as any).subscriptions.update(
            subData.razorpaySubscriptionId,
            {
              quantity: newCount,
              schedule_change_at: 'cycle_end',
            },
          );
          await subRef.update({
            pendingQuantity: newCount,
            hasScheduledChanges: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
        } catch (err: unknown) {
          // Rollback school doc on Razorpay failure
          await schoolRef.update({
            studentCount: subData.quantity,
          });
          const msg = err instanceof Error ? err.message : 'Unknown error';
          throw new HttpsError(
            'internal',
            `Failed to update Razorpay subscription: ${msg}`,
          );
        }
      }
    }

    logger.info('Student count updated', {
      schoolId,
      newCount,
      newMonthlyAmount: newCount * AMOUNT_PER_STUDENT_PAISE,
    });

    return {
      newCount,
      effectiveFrom: 'next_cycle',
      newMonthlyAmount: newCount * AMOUNT_PER_STUDENT_PAISE,
    };
  },
);
