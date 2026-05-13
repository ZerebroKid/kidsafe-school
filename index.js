// Silence RNFirebase deprecation warnings until we migrate to the modular API.
// Per https://rnfirebase.io/migrating-to-v22 this is the documented escape hatch
// while staying on v21.x. MUST be set before any @react-native-firebase/* import
// so the deprecation tracker sees it during module init.
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';

import App from './src/App';
import {name as appName} from './app.json';
import {
  handleGeofenceTransitionTask,
  handlePackageSyncTask,
} from './src/services/childSyncEngine';

// -- FCM background handler ---------------------------------------------------
// Runs even if the app is killed. Child uses this to react to parent commands pushed via FCM
// data messages (the parent app writes Firestore; a Cloud Function / server sends the push).
messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (__DEV__) {
    console.log('[KidSafe] FCM bg message', remoteMessage?.data);
  }
});

// -- Headless JS tasks --------------------------------------------------------
// Native receivers (PackageReceiver, GeofenceTransitionReceiver) start these services so JS
// can write Firestore without requiring the UI to be active.
AppRegistry.registerHeadlessTask('PackageSync', () => async data => {
  try {
    await handlePackageSyncTask(data);
  } catch (e) {
    console.warn('PackageSync task failed', e);
  }
});

AppRegistry.registerHeadlessTask('GeofenceTransition', () => async data => {
  try {
    await handleGeofenceTransitionTask(data);
  } catch (e) {
    console.warn('GeofenceTransition task failed', e);
  }
});

AppRegistry.registerComponent(appName, () => App);
