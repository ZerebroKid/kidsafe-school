/**
 * @format
 * ZConnect entry point.
 *
 * Mounts the parent + teacher app, silences the v1 RNFirebase modular-API
 * deprecation banner, registers the FCM background handler so the parent
 * receives geofence / tamper alerts when the app is killed, and pushes
 * the OAuth client id into shared-firebase before any auth flow runs.
 *
 * ZConnect deliberately does NOT register any headless tasks -- the
 * `PackageSync` and `GeofenceTransition` tasks only fire from native
 * receivers that live on the child device (ZKid).
 */

globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';

import App from './src/App';
import {name as appName} from './app.json';
import {ENV} from './src/config/env';
import {initGoogleSignIn} from '@zerebro/shared-firebase/auth';

initGoogleSignIn(ENV.GOOGLE_WEB_CLIENT_ID);

try {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    if (__DEV__) {
      console.log('[ZConnect] FCM bg message', remoteMessage?.data);
    }
  });
} catch (e) {
  console.warn('[ZConnect] FCM background handler skipped (Firebase GoogleService-Info.plist not initialized):', e);
}

AppRegistry.registerComponent(appName, () => App);
