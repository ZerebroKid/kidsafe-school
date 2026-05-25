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
  const deviceMode = useAuthStore(s => s.userDoc?.deviceMode);
  const sharedChildUid = useAuthStore(s => s.userDoc?.sharedProfile?.childUid);

  useEffect(() => {
    if (!uid || !role) {return;}
    registerForPush(uid);
    const unsub = onTokenRefresh(uid);

    // Three startup paths, all backed by the same engine code:
    //
    // 1. role=child            -> two-device child install. Pushes own device's state to
    //                             Firestore for the (remote) parent to read.
    // 2. role=parent + shared  -> single-phone family. The PARENT account writes the child
    //                             profile directly; the engine runs for `sharedProfile.childUid`
    //                             but in `'shared'` mode so it knows to only enforce blocking
    //                             + push usage/foreground data when Child Mode is active.
    // 3. role=parent + two_dev -> traditional parent dashboard. No child engine on this device.
    const isSharedParent =
      role === 'parent' && deviceMode === 'shared' && !!sharedChildUid;

    if (role === 'child') {
      startChildSyncEngine(uid);
    } else if (isSharedParent) {
      // Parent acts as both writer (child engine for their own phone) and reader
      // (parentListeners watch tamper events on the same profile so the dashboard surfaces
      // them just like on a two-device install).
      startChildSyncEngine(sharedChildUid, {mode: 'shared'});
      startParentListeners(uid);
    } else {
      startParentListeners(uid);
    }
    return () => {
      unsub();
      if (role === 'child' || isSharedParent) {stopChildSyncEngine();}
      if (role !== 'child') {stopParentListeners();}
    };
  }, [uid, role, deviceMode, sharedChildUid]);

  return (
    <GestureHandlerRootView style={{flex: 1, backgroundColor: colors.bg}}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
