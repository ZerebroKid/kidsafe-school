import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';

import auth from '@react-native-firebase/auth';

import {AuthNavigator} from './AuthNavigator';
import {ParentNavigator} from './ParentNavigator';
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
 *   - no auth                              -> AuthNavigator (parent login / signup)
 *   - signed in, email not verified        -> VerifyEmailScreen
 *   - signed in, primaryRole=parent        -> ParentNavigator (dashboard)
 *   - signed in, primaryRole=teacher       -> stub screen (Phase 4 teacher mode lands here)
 *   - signed in, roles includes 'child'    -> WrongAppScreen (defence-in-depth)
 *   - signed in, primaryRole=other         -> WrongAppScreen
 *
 * P3.2.3: snapshot data goes through `normaliseUserDoc` so the rest of the app
 * sees `{roles[], primaryRole}` even for un-migrated v1 docs (where only `role`
 * exists). P3.3 will wire the RoleSwitcher above this navigator for users with
 * `roles.length >= 2`.
 *
 * The v1 shared-mode kiosk gate (`ChildModeNavigator`, `useChildModeActive`,
 * `isSharedKiosk`) was deleted in P1.6.1. ZConnect is now a pure two-device
 * parent dashboard.
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
          // Funnel raw Firestore data through normaliseUserDoc so the auth
          // store + every consumer of `userDoc` sees the v2 shape. Drops
          // the `as any` cast that lived here pre-P3.
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
      ) : userDoc.roles.includes('child') ? (
        // Defence-in-depth: even if a user somehow holds BOTH `child` and
        // `parent`, ZConnect must never render ZKid surfaces. The kid app
        // and the parent app are physically separate installs by design.
        <WrongAppForRole />
      ) : userDoc.primaryRole === 'parent' ? (
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
