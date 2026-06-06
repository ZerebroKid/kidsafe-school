/**
 * Subscription & payment types for the Razorpay integration (Phase 5).
 *
 * Consumed by:
 *   - apps/functions/* callables (createSubscription, getSubscriptionStatus, etc.)
 *   - apps/functions/src/http/razorpayWebhook.ts
 *   - apps/principal-web (subscription page, feature gate)
 *   - apps/admin-web (override controls)
 *
 * Firestore paths:
 *   - schools/{schoolId}/subscription  (single doc, server-only writes)
 *   - paymentEvents/{eventId}          (append-only webhook log)
 */

import type {FirestoreFieldValueLike} from './firestore';

// ---------------------------------------------------------------------------
// Subscription status — mirrors Razorpay subscription lifecycle
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired';

// ---------------------------------------------------------------------------
// Firestore: schools/{schoolId}/subscription
// ---------------------------------------------------------------------------

export interface SubscriptionDoc {
  razorpaySubscriptionId: string;
  razorpayCustomerId: string | null;
  razorpayPlanId: string;

  status: SubscriptionStatus;
  /** Number of students = Razorpay quantity (mirrors school.studentCount at creation/update). */
  quantity: number;
  /** Per-student amount in paise (9900 = ₹99). */
  amountPerStudent: number;
  /** Total monthly charge in paise (quantity × amountPerStudent). */
  totalAmount: number;

  currentPeriodStart: FirestoreFieldValueLike | null;
  currentPeriodEnd: FirestoreFieldValueLike | null;
  nextChargeAt: FirestoreFieldValueLike | null;
  /** Set when `subscription.pending` fires; used for 2-day grace calculation. */
  lastChargeFailedAt: FirestoreFieldValueLike | null;
  /** Server-computed: lastChargeFailedAt + 2 days. Null when not in grace. */
  gracePeriodEnd: FirestoreFieldValueLike | null;

  /** When a quantity change is scheduled for cycle_end. */
  pendingQuantity: number | null;
  hasScheduledChanges: boolean;

  /** Admin manual override fields. */
  manuallyActivated: boolean;
  manuallyActivatedBy: string | null;
  manuallyActivatedUntil: FirestoreFieldValueLike | null;

  createdAt: FirestoreFieldValueLike;
  updatedAt: FirestoreFieldValueLike;
  cancelledAt: FirestoreFieldValueLike | null;
}

// ---------------------------------------------------------------------------
// Firestore: paymentEvents/{eventId}
// ---------------------------------------------------------------------------

export interface PaymentEventDoc {
  schoolId: string;
  subscriptionId: string;
  razorpayEventId: string;
  eventType: string;
  razorpayPaymentId: string | null;
  amount: number | null;
  payload: Record<string, unknown>;
  processedAt: FirestoreFieldValueLike;
}

// ---------------------------------------------------------------------------
// Callable I/O types
// ---------------------------------------------------------------------------

/** createSubscription */
export interface CreateSubscriptionInput {
  schoolId: string;
}

export interface CreateSubscriptionOutput {
  subscriptionId: string;
  shortUrl: string;
  amount: number;
  quantity: number;
  alreadyActive?: boolean;
}

/** getSubscriptionStatus */
export interface GetSubscriptionStatusInput {
  schoolId: string;
}

export interface GetSubscriptionStatusOutput {
  exists: boolean;
  isActive: boolean;
  subscription: SubscriptionDoc | null;
  /** Hours remaining in grace period (null if not in grace). */
  graceRemainingHours: number | null;
  /** Student count from schools/{schoolId}.studentCount (entered during onboarding). */
  studentCount: number | null;
}

/** updateStudentCount */
export interface UpdateStudentCountInput {
  schoolId: string;
  newCount: number;
}

export interface UpdateStudentCountOutput {
  newCount: number;
  effectiveFrom: 'next_cycle' | 'immediate';
  newMonthlyAmount: number;
}

/** cancelSubscription */
export interface CancelSubscriptionInput {
  schoolId: string;
  reason?: string;
}

export interface CancelSubscriptionOutput {
  cancelled: boolean;
  alreadyCancelled?: boolean;
  cancelledAt: FirestoreFieldValueLike | null;
}

/** adminActivateSubscription / adminDeactivateSubscription */
export interface AdminActivateInput {
  schoolId: string;
  /** ISO 8601 date string or Unix ms. Pass null to deactivate. */
  until: string | number | null;
}

export interface AdminActivateOutput {
  activated: boolean;
  deactivated: boolean;
  activatedUntil: FirestoreFieldValueLike | null;
}
