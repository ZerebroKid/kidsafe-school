import messaging from '@react-native-firebase/messaging';
import {PermissionsAndroid, Platform} from 'react-native';

import {paths} from '@zerebro/shared-firebase/firestore';

/**
 * Requests notification permission (Android 13+) and saves the device's FCM token to Firestore.
 * Called after login on both parent and child apps so we can wake each other up with data pushes.
 */
export async function registerForPush(uid: string): Promise<string | null> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      'android.permission.POST_NOTIFICATIONS' as unknown as never,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      return null;
    }
  }
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!enabled) {
    return null;
  }
  const token = await messaging().getToken();
  try {
    await paths.user(uid).update({fcmToken: token});
  } catch (e) {
    console.warn('Could not save fcmToken', e);
  }
  return token;
}

export function onTokenRefresh(uid: string) {
  return messaging().onTokenRefresh(async token => {
    try {
      await paths.user(uid).update({fcmToken: token});
    } catch (e) {
      console.warn('onTokenRefresh update failed', e);
    }
  });
}

export function onForegroundMessage(cb: (msg: unknown) => void) {
  return messaging().onMessage(cb as Parameters<ReturnType<typeof messaging>['onMessage']>[0]);
}
