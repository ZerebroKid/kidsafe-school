import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';

import auth from '@react-native-firebase/auth';

import {AuthNavigator} from './AuthNavigator';
import {ParentNavigator} from './ParentNavigator';
import {TeacherNavigator} from './TeacherNavigator';
import {
  getUserDoc,
  normaliseUserDoc,
  setPrimaryRole,
  signOut,
} from '@zerebro/shared-firebase/auth';
import {paths} from '@zerebro/shared-firebase/firestore';
import {RoleSwitcher} from '../components/RoleSwitcher';
import {RoleOnboardingGate} from '../screens/auth/RoleOnboardingGate';
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
 *   - signed in, primaryRole=teacher       -> TeacherNavigator (Phase 4 stub for now)
 *   - signed in, roles includes 'child'    -> WrongAppScreen (defence-in-depth)
 *   - signed in, primaryRole=other         -> WrongAppScreen
 *
 * P3.3.2 wires the `<RoleSwitcher />` ABOVE the navigator stack (inside the
 * NavigationContainer's children) so a user with multi-role can flip between
 * parent + teacher modes without losing navigation context. The switcher
 * itself returns null when `roles.length < 2`, so single-role users see zero
 * UI overhead.
 *
 * The v1 shared-mode kiosk gate (`ChildModeNavigator`, `useChildModeActive`,
 * `isSharedKiosk`) was deleted in P1.6.1. ZConnect is now a pure two-device
 * parent dashboard.
 */
export function RootNavigator() {
  const {firebaseUid, firebasePhone, userDoc, emailVerified, bootstrapped} =
    useAuthStore();
  const setFirebaseUser = useAuthStore(s => s.setFirebaseUser);
  const setUserDoc = useAuthStore(s => s.setUserDoc);
  const setBootstrapped = useAuthStore(s => s.setBootstrapped);
  const [userDocLoading, setUserDocLoading] = useState(false);

  useEffect(() => {
    const unsubAuth = auth().onAuthStateChanged(user => {
      if (user) {
        setFirebaseUser({
          uid: user.uid,
          email: user.email,
          // P4.3 -- thread phoneNumber through so the email-verified gate
          // below can skip it for phone-OTP users (who have no email and
          // can't ever "verify" one).
          phone: user.phoneNumber,
          emailVerified: user.emailVerified,
        });
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

  // P3.3.3: single-role users should never see the RoleSwitcher, and their
  // primaryRole should match the only role they hold (the migration script
  // already does this server-side; this is the runtime safety net for
  // any doc that slipped through). When `roles.length === 1` and the
  // persisted primaryRole DOESN'T match, repair it. Side effect fires at
  // most once per snapshot; the onSnapshot listener re-renders us with the
  // updated primaryRole and the if-guard turns into a no-op afterwards.
  useEffect(() => {
    if (!firebaseUid || !userDoc) return;
    if (userDoc.roles.length !== 1) return;
    const only = userDoc.roles[0];
    if (!only || userDoc.primaryRole === only) return;
    setPrimaryRole(firebaseUid, only).catch(err =>
      console.warn('repair primaryRole failed', err),
    );
  }, [firebaseUid, userDoc]);

  if (!bootstrapped || (firebaseUid && userDocLoading && !userDoc)) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <View style={styles.rootContainer}>
        {/* Mounted ONLY when the user is signed in + has multi-role; the
         * component itself returns null otherwise, so this is a safe always-on
         * mount. Sits above whichever role navigator is active so flipping
         * roles re-renders just the navigator below. */}
        {firebaseUid && emailVerified && userDoc && userDoc.roles.length >= 2 ? (
          <RoleSwitcher />
        ) : null}
        <View style={{flex: 1}}>
          {!firebaseUid ? (
            <AuthNavigator />
          ) : // P4.3 -- email-verified gate ONLY applies to accounts that
          // signed in via email/password. Phone-OTP users have a verified
          // phone-number-claim on their token but `user.emailVerified` is
          // always false (they have no email), so checking the gate
          // unconditionally would deadlock them on VerifyEmailScreen.
          !emailVerified && !firebasePhone ? (
            <VerifyEmailScreen />
          ) : !userDoc ? (
            <AuthNavigator />
          ) : userDoc.roles.length === 0 ? (
            // P3.3.3: phone-OTP signups land here with roles: [] until a
            // server-side role grant runs (Phase 4 admin invite flow).
            // Block them with a polite "ask your admin" screen instead of
            // mis-routing to ParentNavigator on a doc that doesn't actually
            // hold the parent role.
            <RoleOnboardingGate />
          ) : userDoc.roles.includes('child') ? (
            // Defence-in-depth: even if a user somehow holds BOTH `child` and
            // `parent`, ZConnect must never render ZKid surfaces. The kid app
            // and the parent app are physically separate installs by design.
            <WrongAppForRole />
          ) : userDoc.primaryRole === 'parent' ? (
            <ParentNavigator />
          ) : userDoc.primaryRole === 'teacher' ? (
            <TeacherNavigator />
          ) : (
            // Single-role principal / admin who somehow signed in to ZConnect
            // (these live in the web apps). The repair effect above will set
            // primaryRole to match roles[0] if it's stale, but the right home
            // for them is still the web app.
            <WrongAppForRole />
          )}
        </View>
      </View>
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
  rootContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
