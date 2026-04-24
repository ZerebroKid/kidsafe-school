import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';

import auth from '@react-native-firebase/auth';

import {AuthNavigator} from './AuthNavigator';
import {ChildNavigator} from './ChildNavigator';
import {ParentNavigator} from './ParentNavigator';
import {getUserDoc} from '../firebase/auth';
import {paths} from '../firebase/firestore';
import {useAuthStore} from '../state/authStore';
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
    if (!firebaseUid) return;
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
