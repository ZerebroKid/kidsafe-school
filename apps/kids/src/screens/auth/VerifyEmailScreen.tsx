import React, {useEffect, useState} from 'react';
import {Alert, StyleSheet, Text} from 'react-native';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {colors, spacing} from '../../theme';
import {reloadCurrentUser, signOut} from '../../firebase/auth';
import {useAuthStore} from '../../state/authStore';

export function VerifyEmailScreen() {
  const email = useAuthStore(s => s.firebaseEmail);
  const setFirebaseUser = useAuthStore(s => s.setFirebaseUser);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const id = setInterval(async () => {
      const u = await reloadCurrentUser();
      if (u?.emailVerified) {
        setFirebaseUser({uid: u.uid, email: u.email, emailVerified: true});
      }
    }, 5000);
    return () => clearInterval(id);
  }, [setFirebaseUser]);

  async function onCheck() {
    try {
      setChecking(true);
      const u = await reloadCurrentUser();
      if (u?.emailVerified) {
        setFirebaseUser({uid: u.uid, email: u.email, emailVerified: true});
      } else {
        Alert.alert('Not yet', 'We still see your email as unverified. Click the link in the email.');
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen title="Verify your email" subtitle={`We sent a verification link to ${email ?? 'your email'}. Click it to continue.`}>
      <Text style={styles.info}>Once you've clicked the link, tap the button below.</Text>
      <Button title="I've verified my email" onPress={onCheck} loading={checking} />
      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: {
    color: colors.textMuted,
    marginVertical: spacing.sm,
  },
});
