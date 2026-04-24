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
