/**
 * SUB.4.2 -- Returns the current subscription status for a school.
 *
 * Called by the principal-web on page load to determine whether features
 * should be unlocked or gated. Computes `isActive` based on:
 *   - Razorpay status === 'active'
 *   - Status is 'authenticated' with billing period started (paid; may
 *     occur when webhooks arrive out of order)
 *   - Status is 'pending' but within 2-day grace window
 *   - Admin manual override is set and hasn't expired
 */

import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../../lib/admin';
import {requireAuth, requireRole} from '../../lib/auth';
import type {
  GetSubscriptionStatusInput,
  GetSubscriptionStatusOutput,
  SubscriptionDoc,
} from '../../lib/sharedTypes';

export const getSubscriptionStatus = onCall<
  GetSubscriptionStatusInput,
  Promise<GetSubscriptionStatusOutput>
>(
  {region: 'asia-south1'},
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
    const schoolStudentCount =
      typeof schoolData.studentCount === 'number' ? schoolData.studentCount : null;
    if (schoolData.principalUid !== caller.uid) {
      throw new HttpsError(
        'permission-denied',
        'You are not the principal of this school.',
      );
    }

    const subRef = schoolRef.collection('subscription').doc('current');
    const subSnap = await subRef.get();

    if (!subSnap.exists) {
      return {
        exists: false,
        isActive: false,
        subscription: null,
        graceRemainingHours: null,
        studentCount: schoolStudentCount,
      };
    }

    let doc = subSnap.data() as SubscriptionDoc;
    const now = Date.now();

    let isActive = false;
    let graceRemainingHours: number | null = null;

    const periodStartMs =
      doc.currentPeriodStart == null
        ? null
        : typeof doc.currentPeriodStart === 'number'
          ? doc.currentPeriodStart
          : (doc.currentPeriodStart as {toMillis?: () => number})?.toMillis?.() ??
            null;

    // Check admin override first
    if (doc.manuallyActivated && doc.manuallyActivatedUntil) {
      const until =
        typeof doc.manuallyActivatedUntil === 'number'
          ? doc.manuallyActivatedUntil
          : (doc.manuallyActivatedUntil as any)?.toMillis?.() ?? 0;
      if (until > now) {
        isActive = true;
      }
    }

    // Check Razorpay status
    if (!isActive) {
      if (doc.status === 'active') {
        isActive = true;
      } else if (
        doc.status === 'authenticated' &&
        periodStartMs != null &&
        periodStartMs > 0
      ) {
        // Paid but stuck on authenticated (out-of-order webhook delivery).
        isActive = true;
        await subRef.update({
          status: 'active',
          updatedAt: FieldValue.serverTimestamp(),
        });
        doc = {...doc, status: 'active'};
      } else if (doc.status === 'pending' && doc.gracePeriodEnd) {
        const graceEnd =
          typeof doc.gracePeriodEnd === 'number'
            ? doc.gracePeriodEnd
            : (doc.gracePeriodEnd as any)?.toMillis?.() ?? 0;
        if (graceEnd > now) {
          isActive = true;
          graceRemainingHours = Math.ceil((graceEnd - now) / (1000 * 60 * 60));
        }
      }
    }

    return {
      exists: true,
      isActive,
      subscription: doc,
      graceRemainingHours,
      studentCount: schoolStudentCount,
    };
  },
);
