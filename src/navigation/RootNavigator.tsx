import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';

import auth from '@react-native-firebase/auth';

import {AuthNavigator} from './AuthNavigator';
import {ChildModeNavigator} from './ChildModeNavigator';
import {ChildNavigator} from './ChildNavigator';
import {ParentNavigator} from './ParentNavigator';
import {getUserDoc} from '../firebase/auth';
import {paths} from '../firebase/firestore';
import {useAuthStore} from '../state/authStore';
import {useChildModeActive} from '../hooks/useChildModeActive';
import {colors} from '../theme';
import {VerifyEmailScreen} from '../screens/auth/VerifyEmailScreen';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

export function RootNavigator() {
  const {firebaseUid, userDoc, emailVerified, bootstrapped} = useAuthStore();
  const setFirebaseUser = useAuthStore(s => s.setFirebaseUser);
  const setUserDoc = useAuthStore(s => s.setUserDoc);
  const setBootstrapped = useAuthStore(s => s.setBootstrapped);
  const [userDocLoading, setUserDocLoading] = useState(false);
  const childModeActive = useChildModeActive();

  useEffect(() => {
    const unsubAuth = auth().onAuthStateChanged(user => {
      if (user) {
        setFirebaseUser({uid: user.uid, email: user.email, emailVerified: user.emailVerified});
      } else {
        setFirebaseUser(null);
        setUserDoc(null);
      }
      setBootstrapped(true);
    });
    return unsubAuth;
  }, [setFirebaseUser, setUserDoc, setBootstrapped]);

  // Live subscription to the logged-in user's Firestore doc so role changes propagate instantly.
  useEffect(() => {
    if (!firebaseUid) {return;}
    setUserDocLoading(true);
    const sub = paths.user(firebaseUid).onSnapshot(
      async snap => {
        if (snap.exists) {
          setUserDoc(snap.data() as any);
        } else {
          const doc = await getUserDoc(firebaseUid);
          setUserDoc(doc);
        }
        setUserDocLoading(false);
      },
      err => {
        console.warn('user doc sub error', err);
        setUserDocLoading(false);
      },
    );
    return sub;
  }, [firebaseUid, setUserDoc]);

  if (!bootstrapped || (firebaseUid && userDocLoading && !userDoc)) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Shared-phone kiosk gate. Sits BEFORE the role check so a shared-mode parent who started
  // Child Mode lands in the locked kiosk on the very next render — even after a reboot. We
  // also gate on `emailVerified` so a signed-out parent can't be trapped inside the kiosk
  // with no way out (the kiosk's ForgotPin screen relies on a verified email anyway).
  //
  // `childModeActive === null` means we're still reading the native flag — treat as false
  // so the dashboard renders, and we'll flip into the kiosk on the next tick if needed.
  const isSharedKiosk =
    !!firebaseUid &&
    emailVerified &&
    userDoc?.deviceMode === 'shared' &&
    childModeActive === true;

  return (
    <NavigationContainer theme={navTheme}>
      {!firebaseUid ? (
        <AuthNavigator />
      ) : !emailVerified ? (
        <VerifyEmailScreen />
      ) : !userDoc ? (
        // Signed in but no user doc → only possible via first-time Google signup. Kick them back
        // to role selection so they can pick parent / child and we'll create the doc there.
        <AuthNavigator />
      ) : isSharedKiosk ? (
        // Shared phone, Child Mode is ON — render the locked kiosk regardless of role.
        // (Role is always 'parent' on shared installs; we don't assume it though, to keep
        // the gate defense-in-depth.)
        <ChildModeNavigator />
      ) : userDoc.role === 'parent' ? (
        <ParentNavigator />
      ) : (
        <ChildNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
