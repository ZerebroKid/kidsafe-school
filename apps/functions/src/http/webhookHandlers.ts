/**
 * SUB.5.2 + 5.3 -- Webhook event handlers for Razorpay subscription events.
 *
 * Each handler updates the `schools/{schoolId}/subscription/current` doc in
 * Firestore and logs the event to `paymentEvents/{id}`.
 *
 * Grace period logic (SUB.5.3):
 *   - subscription.pending → set gracePeriodEnd = now + 2 days
 *   - subscription.charged → clear gracePeriodEnd and lastChargeFailedAt
 *   - subscription.halted → immediate block (overrides grace)
 */

import {FieldValue} from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

import {db} from '../lib/admin';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

type WebhookBody = Record<string, any>;

/**
 * Main dispatch: route a webhook event to the appropriate handler.
 */
export async function handleWebhookEvent(
  event: string,
  body: WebhookBody,
  razorpayEventId: string,
): Promise<void> {
  const handler = HANDLER_MAP[event];

  const subscriptionEntity = body.payload?.subscription?.entity;
  if (!subscriptionEntity) {
    logger.warn('No subscription entity in webhook payload', {event});
    await logEvent(event, body, razorpayEventId, null);
    return;
  }

  const schoolId = subscriptionEntity.notes?.schoolId as string | undefined;
  if (!schoolId) {
    logger.error('schoolId missing from subscription notes', {
      event,
      subscriptionId: subscriptionEntity.id,
    });
    await logEvent(event, body, razorpayEventId, null);
    return;
  }

  if (handler) {
    await handler(schoolId, body, subscriptionEntity);
  } else {
    logger.info('Unhandled webhook event type (logged only)', {event});
  }

  await logEvent(event, body, razorpayEventId, schoolId);
}

// ---------------------------------------------------------------------------
// Individual handlers
// ---------------------------------------------------------------------------

async function handleAuthenticated(
  schoolId: string,
  _body: WebhookBody,
  entity: Record<string, any>,
): Promise<void> {
  const subRef = db().collection('schools').doc(schoolId)
    .collection('subscription').doc('current');

  const existing = (await subRef.get()).data();
  const current = existing?.status as string | undefined;

  // Razorpay may deliver authenticated after activated/charged. Never
  // downgrade a subscription that is already active or in grace.
  if (current === 'active' || current === 'pending') {
    if (!existing?.razorpayCustomerId && entity.customer_id) {
      await subRef.update({
        razorpayCustomerId: entity.customer_id,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return;
  }

  await subRef.update({
    status: 'authenticated',
    razorpayCustomerId: entity.customer_id ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleActivated(
  schoolId: string,
  _body: WebhookBody,
  entity: Record<string, any>,
): Promise<void> {
  const subRef = db().collection('schools').doc(schoolId)
    .collection('subscription').doc('current');

  await subRef.update({
    status: 'active',
    currentPeriodStart: entity.current_start ? entity.current_start * 1000 : null,
    currentPeriodEnd: entity.current_end ? entity.current_end * 1000 : null,
    nextChargeAt: entity.charge_at ? entity.charge_at * 1000 : null,
    razorpayCustomerId: entity.customer_id ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleCharged(
  schoolId: string,
  body: WebhookBody,
  entity: Record<string, any>,
): Promise<void> {
  const subRef = db().collection('schools').doc(schoolId)
    .collection('subscription').doc('current');

  const paymentEntity = body.payload?.payment?.entity;

  await subRef.update({
    status: 'active',
    currentPeriodStart: entity.current_start ? entity.current_start * 1000 : null,
    currentPeriodEnd: entity.current_end ? entity.current_end * 1000 : null,
    nextChargeAt: entity.charge_at ? entity.charge_at * 1000 : null,
    // Clear grace period on successful charge
    lastChargeFailedAt: null,
    gracePeriodEnd: null,
    // Update quantity if it changed (scheduled change took effect)
    ...(entity.quantity ? {quantity: entity.quantity, totalAmount: entity.quantity * 9900} : {}),
    pendingQuantity: null,
    hasScheduledChanges: false,
    razorpayCustomerId: entity.customer_id ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('Subscription charged', {
    schoolId,
    amount: paymentEntity?.amount,
    paymentId: paymentEntity?.id,
  });
}

async function handlePending(
  schoolId: string,
  _body: WebhookBody,
  _entity: Record<string, any>,
): Promise<void> {
  const subRef = db().collection('schools').doc(schoolId)
    .collection('subscription').doc('current');

  const subSnap = await subRef.get();
  const existing = subSnap.data();

  // Only set grace timer on first pending event (don't extend on retries)
  const alreadyInGrace = existing?.lastChargeFailedAt != null;

  await subRef.update({
    status: 'pending',
    ...(alreadyInGrace ? {} : {
      lastChargeFailedAt: FieldValue.serverTimestamp(),
      gracePeriodEnd: Date.now() + TWO_DAYS_MS,
    }),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.warn('Subscription payment pending (failed)', {schoolId});
}

async function handleHalted(
  schoolId: string,
  _body: WebhookBody,
  _entity: Record<string, any>,
): Promise<void> {
  const subRef = db().collection('schools').doc(schoolId)
    .collection('subscription').doc('current');

  const subSnap = await subRef.get();
  const existing = subSnap.data();

  // Don't overwrite a cancel with halted
  if (existing?.status === 'cancelled') {
    return;
  }

  await subRef.update({
    status: 'halted',
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.warn('Subscription halted (all retries exhausted)', {schoolId});
}

async function handleCancelled(
  schoolId: string,
  _body: WebhookBody,
  _entity: Record<string, any>,
): Promise<void> {
  const subRef = db().collection('schools').doc(schoolId)
    .collection('subscription').doc('current');

  await subRef.update({
    status: 'cancelled',
    cancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handlePaused(
  schoolId: string,
  _body: WebhookBody,
  _entity: Record<string, any>,
): Promise<void> {
  const subRef = db().collection('schools').doc(schoolId)
    .collection('subscription').doc('current');

  await subRef.update({
    status: 'halted',
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleResumed(
  schoolId: string,
  _body: WebhookBody,
  entity: Record<string, any>,
): Promise<void> {
  const subRef = db().collection('schools').doc(schoolId)
    .collection('subscription').doc('current');

  await subRef.update({
    status: 'active',
    lastChargeFailedAt: null,
    gracePeriodEnd: null,
    currentPeriodStart: entity.current_start ? entity.current_start * 1000 : null,
    currentPeriodEnd: entity.current_end ? entity.current_end * 1000 : null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Handler map
// ---------------------------------------------------------------------------

const HANDLER_MAP: Record<
  string,
  (schoolId: string, body: WebhookBody, entity: Record<string, any>) => Promise<void>
> = {
  'subscription.authenticated': handleAuthenticated,
  'subscription.activated': handleActivated,
  'subscription.charged': handleCharged,
  'subscription.pending': handlePending,
  'subscription.halted': handleHalted,
  'subscription.cancelled': handleCancelled,
  'subscription.paused': handlePaused,
  'subscription.resumed': handleResumed,
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function logEvent(
  event: string,
  body: WebhookBody,
  razorpayEventId: string,
  schoolId: string | null,
): Promise<void> {
  const subscriptionEntity = body.payload?.subscription?.entity;
  const paymentEntity = body.payload?.payment?.entity;

  // The webhook function pre-creates this doc (deterministic ID) during the
  // idempotency transaction. We update it with full payload here.
  const eventDocId = razorpayEventId.replace(/[/\\]/g, '_');
  await db().collection('paymentEvents').doc(eventDocId).set(
    {
      schoolId: schoolId ?? '',
      subscriptionId: subscriptionEntity?.id ?? '',
      razorpayEventId,
      eventType: event,
      razorpayPaymentId: paymentEntity?.id ?? null,
      amount: paymentEntity?.amount ?? null,
      payload: body,
      processedAt: FieldValue.serverTimestamp(),
      status: 'processed',
    },
    {merge: true},
  );
}
