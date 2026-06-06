/**
 * SUB.5.1 -- Razorpay webhook HTTP endpoint.
 *
 * Razorpay POSTs subscription lifecycle events to this URL. This function:
 *   1. Verifies the X-Razorpay-Signature header (HMAC SHA-256)
 *   2. Deduplicates by event ID (idempotency)
 *   3. Dispatches to event-specific handlers
 *   4. Logs to paymentEvents collection
 *
 * Uses `onRequest` (not `onCall`) because Razorpay sends raw HTTP POSTs.
 */

import {onRequest} from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

import {razorpayWebhookSecret, verifyWebhookSignature} from '../lib/razorpay';
import {db} from '../lib/admin';
import {handleWebhookEvent} from './webhookHandlers';

export const razorpayWebhook = onRequest(
  {
    region: 'asia-south1',
    secrets: [razorpayWebhookSecret],
    cors: false,
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).json({error: 'Method not allowed'});
      return;
    }

    // Read raw body for signature verification
    const rawBody = (req as any).rawBody
      ? (req as any).rawBody.toString('utf8')
      : JSON.stringify(req.body);

    // Verify signature
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!signature) {
      logger.warn('Webhook received without X-Razorpay-Signature header');
      res.status(400).json({error: 'Missing signature'});
      return;
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.error('Webhook signature verification failed', {
        ip: req.ip,
        headers: Object.keys(req.headers),
      });
      res.status(400).json({error: 'Invalid signature'});
      return;
    }

    // Parse body
    let body: Record<string, any>;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      logger.error('Webhook body is not valid JSON');
      res.status(400).json({error: 'Invalid JSON'});
      return;
    }

    const event = body.event as string | undefined;
    if (!event) {
      logger.warn('Webhook payload missing event field');
      res.status(400).json({error: 'Missing event field'});
      return;
    }

    // Generate a unique event ID for idempotency
    const subscriptionEntity = body.payload?.subscription?.entity;
    const paymentEntity = body.payload?.payment?.entity;
    const entityId = subscriptionEntity?.id || paymentEntity?.id || '';
    const razorpayEventId = `${event}_${entityId}_${body.created_at || Date.now()}`;

    // Idempotency check using a deterministic document ID derived from
    // the event ID. This prevents both duplicate queries and race
    // conditions when the same webhook arrives twice within milliseconds.
    const eventDocId = razorpayEventId.replace(/[/\\]/g, '_');
    const eventDocRef = db().collection('paymentEvents').doc(eventDocId);

    let alreadyProcessed = false;
    try {
      await db().runTransaction(async t => {
        const existing = await t.get(eventDocRef);
        if (existing.exists) {
          alreadyProcessed = true;
          return;
        }
        // Reserve the slot immediately (mark as processing)
        t.set(eventDocRef, {
          razorpayEventId,
          eventType: event,
          status: 'processing',
          processedAt: new Date(),
        });
      });
    } catch (err: unknown) {
      // Transaction contention means another instance is processing — safe to skip
      logger.info('Transaction contention on webhook dedup, skipping', {razorpayEventId});
      res.status(200).json({status: 'already_processing'});
      return;
    }

    if (alreadyProcessed) {
      logger.info('Duplicate webhook event, skipping', {razorpayEventId, event});
      res.status(200).json({status: 'already_processed'});
      return;
    }

    // Dispatch to handler
    try {
      await handleWebhookEvent(event, body, razorpayEventId);
      logger.info('Webhook event processed', {event, razorpayEventId});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Webhook handler failed', {event, razorpayEventId, error: msg});
    }

    res.status(200).json({status: 'ok'});
  },
);
