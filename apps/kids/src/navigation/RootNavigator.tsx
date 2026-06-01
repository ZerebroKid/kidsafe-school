import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';

import auth from '@react-native-firebase/auth';

import {AuthNavigator} from './AuthNavigator';
import {ChildNavigator} from './ChildNavigator';
import {
  getUserDoc,
  normaliseUserDoc,
  signOut,
} from '@zerebro/shared-firebase/auth';
import {paths} from '@zerebro/shared-firebase/firestore';
import {useAuthStore} from '../state/authStore';
import {colors} from '../theme';
import {VerifyEmailScreen} from '../screens/auth/VerifyEmailScreen';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

/**
 * ZKid root navigator.
 *
 * Branches:
 *   - no auth                              -> AuthNavigator (login / signup as child)
 *   - signed in, email not verified        -> VerifyEmailScreen
 *   - signed in, primaryRole=child         -> ChildNavigator (onboarding / status)
 *   - signed in, primaryRole=other         -> WrongAppScreen (ask to use ZConnect)
 *
 * P3.2.3: the snapshot listener feeds raw Firestore data through `normaliseUserDoc`
 * so the rest of the app sees the v2 shape (roles[] + primaryRole) even for
 * un-migrated v1 docs in the wild.
 *
 * Phase 1.6 removes the shared-mode kiosk flow that v1 hosted here, and
 * Phase 4 wires the student-side (`ZKid Study Mission`) tabs.
 */
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

  useEffect(() => {
    if (!firebaseUid) {
      return;
    }
    setUserDocLoading(true);
    const sub = paths.user(firebaseUid).onSnapshot(
      async snap => {
        if (snap.exists) {
          // Funnel raw Firestore data through normaliseUserDoc so a v1 doc
          // (legacy `role:'child'`) is observed as `{roles:['child'], primaryRole:'child'}`
          // by the rest of ZKid. Drops the `as any` cast that lived here pre-P3.
          setUserDoc(normaliseUserDoc(snap.data() ?? {}));
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
        <AuthNavigator />
      ) : userDoc.primaryRole === 'child' ? (
        <ChildNavigator />
      ) : (
        <WrongAppForRole />
      )}
    </NavigationContainer>
  );
}

function WrongAppForRole() {
  return (
    <View style={styles.wrongAppContainer}>
      <Text style={styles.wrongAppTitle}>This phone is ZKid</Text>
      <Text style={styles.wrongAppBody}>
        Parents use the ZConnect app to monitor their kids. Please sign out and install
        ZConnect on your own phone.
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
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
});
