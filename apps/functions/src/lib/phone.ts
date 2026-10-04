import {HttpsError} from 'firebase-functions/v2/https';

/** India-first E.164. Accepts 10 digits, 91XXXXXXXXXX, or an existing +E.164. */
export function normalizePhoneToE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (raw.trim().startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  throw new HttpsError('invalid-argument', 'Enter a valid mobile number.');
}
