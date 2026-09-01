import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from './navigation/RootNavigator';
import {useAuthStore} from './state/authStore';
import {startChildSyncEngine, stopChildSyncEngine} from './services/childSyncEngine';
import {registerForPush, onTokenRefresh} from './firebase/messaging';
import {ChildProfileProvider} from './context/ChildProfileContext';
import {ThemeProvider} from './context/ThemeContext';
import {colors} from './theme';

/**
 * ZKid app root.
 *
 * ZKid runs on the child's phone only -- it never hosts the parent dashboard.
 * If a parent account accidentally signs in here, RootNavigator surfaces a
 * "use ZConnect instead" message; we never spin up parentListeners or hit
 * any parent-only Firestore paths from this app.
 *
 * Phase 1.6 will further prune the shared-mode (single-phone) code paths
 * out of the auth flow and Firestore schema.
 */
export default function App() {
  const uid = useAuthStore(s => s.firebaseUid);
  // P3.2.3: read primaryRole instead of v1 `role`. The auth store sets the
  // normalised UserDoc (via getUserDoc / normaliseUserDoc) so primaryRole is
  // always populated even for un-migrated docs.
  const primaryRole = useAuthStore(s => s.userDoc?.primaryRole);

  useEffect(() => {
    if (!uid || primaryRole !== 'child') {
      return;
    }
    registerForPush(uid);
    const unsub = onTokenRefresh(uid);
    startChildSyncEngine(uid);
    return () => {
      unsub();
      stopChildSyncEngine();
    };
  }, [uid, primaryRole]);

  return (
    <GestureHandlerRootView style={{flex: 1, backgroundColor: colors.bg}}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
          <ChildProfileProvider>
            <RootNavigator />
          </ChildProfileProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
