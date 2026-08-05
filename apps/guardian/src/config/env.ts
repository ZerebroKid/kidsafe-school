/**
 * Static app configuration. Values marked REPLACE_ME must be filled in before the app will work
 * on a real device — see SETUP.md for where to get them.
 */
export const ENV = {
  /**
   * OAuth Web client id from Firebase console (Project settings → General → Web SDK configuration).
   * Required for Google Sign-in via `@react-native-google-signin/google-signin`.
   */
  GOOGLE_WEB_CLIENT_ID: '132122944163-6ckfuh02lf62n0a118hnc7aedbou0v05.apps.googleusercontent.com',

  /**
   * Pairing code length and TTL in minutes. 6 digits = 1M combinations; with global rate limiting
   * and a ~10 min window this is fine for MVP scale.
   */
  PAIRING_CODE_LENGTH: 6,
  PAIRING_CODE_TTL_MINS: 10,

  /**
   * Location write throttling — only persist a new location to Firestore if it has changed
   * at least this many metres, or this many seconds have passed since the last write.
   */
  LOCATION_MIN_DISTANCE_M: 50,
  LOCATION_MIN_INTERVAL_MS: 60_000,
} as const;
