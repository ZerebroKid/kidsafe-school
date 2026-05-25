import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from './navigation/RootNavigator';
import {useAuthStore} from './state/authStore';
import {startParentListeners, stopParentListeners} from './services/parentListeners';
import {registerForPush, onTokenRefresh} from './firebase/messaging';
import {colors} from './theme';

/**
 * ZConnect app root.
 *
 * ZConnect is the parent + teacher mobile app. It runs PARENT-side flows only:
 *  - registerForPush so we can wake the parent for geofence / tamper alerts
 *  - startParentListeners so the dashboard surfaces live child events
 *
 * ZConnect never starts childSyncEngine and never links the child-device
 * native modules -- those live exclusively in ZKid. The shared-mode kiosk
 * (single-phone family) was the only edge that broke this rule in v1;
 * Phase 1.6 deletes that path entirely.
 */
export default function App() {
  const uid = useAuthStore(s => s.firebaseUid);
  const role = useAuthStore(s => s.userDoc?.role);

  useEffect(() => {
    if (!uid || role !== 'parent') {
      return;
    }
    registerForPush(uid);
    const unsub = onTokenRefresh(uid);
    startParentListeners(uid);
    return () => {
      unsub();
      stopParentListeners();
    };
  }, [uid, role]);

  return (
    <GestureHandlerRootView style={{flex: 1, backgroundColor: colors.bg}}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
