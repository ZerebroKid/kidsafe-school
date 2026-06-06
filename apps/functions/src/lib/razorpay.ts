/**
 * Razorpay SDK instance + helpers for the subscription callables and webhook.
 *
 * Secrets are managed via Firebase Functions `defineSecret` so they're injected
 * at runtime without ever living in source. The plan ID is a plain string param
 * (not sensitive, can live in .env or firebase config).
 */

import {defineSecret, defineString} from 'firebase-functions/params';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Params & Secrets
// ---------------------------------------------------------------------------

export const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID');
export const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');
export const razorpayWebhookSecret = defineSecret('RAZORPAY_WEBHOOK_SECRET');

export const RAZORPAY_PLAN_ID = defineString('RAZORPAY_PLAN_ID', {
  description: 'The Razorpay plan_id for the ₹99/student/month subscription.',
  default: '',
});

/** Per-student amount in paise. ₹99 = 9900 paise. */
export const AMOUNT_PER_STUDENT_PAISE = 9900;

// ---------------------------------------------------------------------------
// Lazy Razorpay instance
// ---------------------------------------------------------------------------

let instance: InstanceType<typeof import('razorpay')> | null = null;

/**
 * Returns a lazily-initialized Razorpay SDK instance. Must be called inside a
 * function handler (not at module top level) so that secrets are resolved.
 */
export function getRazorpayInstance() {
  if (instance) return instance;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require('razorpay');
  instance = new Razorpay({
    key_id: razorpayKeyId.value(),
    key_secret: razorpayKeySecret.value(),
  });
  return instance!;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Razorpay webhook signature using HMAC SHA-256.
 * Uses `timingSafeEqual` to prevent timing attacks.
 *
 * @param rawBody - The raw request body as a string (do NOT parse before verifying)
 * @param signature - The `X-Razorpay-Signature` header value
 * @returns true if the signature is valid
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', razorpayWebhookSecret.value())
    .update(rawBody)
    .digest('hex');

  if (expected.length !== signature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex'),
  );
}
