import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';

import auth from '@react-native-firebase/auth';

import {AuthNavigator} from './AuthNavigator';
import {ChildModeNavigator} from './ChildModeNavigator';
import {ParentNavigator} from './ParentNavigator';
import {getUserDoc, signOut} from '@zerebro/shared-firebase/auth';
import {paths} from '@zerebro/shared-firebase/firestore';
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

/**
 * ZConnect root navigator.
 *
 * Branches:
 *   - no auth                       -> AuthNavigator (parent login / signup)
 *   - signed in, email not verified -> VerifyEmailScreen
 *   - signed in, shared-mode kiosk  -> ChildModeNavigator (legacy, deleted in P1.6)
 *   - signed in, role=parent        -> ParentNavigator (dashboard)
 *   - signed in, role=child         -> WrongAppScreen (ask to use ZKid)
 */
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

  useEffect(() => {
    if (!firebaseUid) {
      return;
    }
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

  // Shared-phone kiosk gate. Deleted in P1.6 but kept here through P1.4 so v1's
  // shared-mode parents keep working during the migration window.
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
        <AuthNavigator />
      ) : isSharedKiosk ? (
        <ChildModeNavigator />
      ) : userDoc.role === 'parent' ? (
        <ParentNavigator />
      ) : (
        <WrongAppForRole />
      )}
    </NavigationContainer>
  );
}

function WrongAppForRole() {
  return (
    <View style={styles.wrongAppContainer}>
      <Text style={styles.wrongAppTitle}>This phone is ZConnect</Text>
      <Text style={styles.wrongAppBody}>
        ZConnect is the parent + teacher app. If you're a kid, install ZKid on
        your own phone so your parent can keep you safe.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.wrongAppButton}
        onPress={() => {
          signOut().catch(err => console.warn('signOut failed', err));
        }}>
        <Text style={styles.wrongAppButtonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrongAppContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrongAppTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  wrongAppBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  wrongAppButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  wrongAppButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
