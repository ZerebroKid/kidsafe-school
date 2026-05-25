/**
 * Tiny phone-number normaliser shared by both web login forms so the field
 * accepts "9876543210", "98765 43210" or "+91 98765 43210" uniformly. Bare
 * essentials only -- once we onboard non-India schools we should swap this for
 * `libphonenumber-js` and the actual per-country validators it ships.
 */

export interface PhoneParseResult {
  ok: boolean;
  e164?: string;
  error?: string;
}

export function normalizePhoneToE164(
  raw: string,
  defaultCountryCode = '+91',
): PhoneParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return {ok: false, error: 'Enter a mobile number'};

  // Anything but digits and a single leading '+' is rejected so we never
  // forward garbage like "abc" / "()1-2" to Firebase, which would surface as
  // an opaque auth/invalid-phone-number.
  const cleaned = trimmed.replace(/[\s()-]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) {
    return {ok: false, error: 'Use digits and an optional leading +'};
  }

  const withCountry = cleaned.startsWith('+')
    ? cleaned
    : cleaned.length === 10
      ? `${defaultCountryCode}${cleaned}`
      : null;
  if (!withCountry) {
    return {
      ok: false,
      error:
        cleaned.length < 10
          ? 'Number looks too short'
          : 'Add country code (e.g. +91 for India)',
    };
  }

  // Firebase auth accepts 8-15 digits after the +; keep the same band so the
  // local validator and the server never disagree on the same input.
  const digits = withCountry.slice(1);
  if (digits.length < 8 || digits.length > 15) {
    return {ok: false, error: 'Number must be 8-15 digits'};
  }
  return {ok: true, e164: withCountry};
}
