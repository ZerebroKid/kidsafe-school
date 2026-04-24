import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from './navigation/RootNavigator';
import {useAuthStore} from './state/authStore';
import {startChildSyncEngine, stopChildSyncEngine} from './services/childSyncEngine';
import {startParentListeners, stopParentListeners} from './services/parentListeners';
import {registerForPush, onTokenRefresh} from './firebase/messaging';
import {colors} from './theme';

export default function App() {
  const uid = useAuthStore(s => s.firebaseUid);
  const role = useAuthStore(s => s.userDoc?.role);

  useEffect(() => {
    if (!uid || !role) return;
    registerForPush(uid);
    const unsub = onTokenRefresh(uid);
    if (role === 'child') {
      startChildSyncEngine(uid);
    } else {
      startParentListeners(uid);
    }
    return () => {
      unsub();
      if (role === 'child') stopChildSyncEngine();
      else stopParentListeners();
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
