import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {colors, spacing} from '../../theme';
import {sendPasswordReset, signInWithEmail, signInWithGoogle} from '../../firebase/auth';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({navigation}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    try {
      setLoading(true);
      await signInWithEmail(email.trim(), password);
      // App.tsx onAuthStateChanged takes over from here
    } catch (e) {
      Alert.alert('Login failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Google sign-in failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email in the field first.');
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      Alert.alert('Check your inbox', 'We sent you a reset link.');
    } catch (e) {
      Alert.alert('Reset failed', (e as Error).message);
    }
  }

  return (
    <Screen title="Welcome back" subtitle="Log in to continue managing your family's devices.">
      <TextInput
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <TextInput
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
      />

      <Button title="Log in" onPress={onLogin} loading={loading} />
      <Button title="Continue with Google" variant="secondary" onPress={onGoogle} loading={loading} />

      <Pressable onPress={onForgot}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={{color: colors.textMuted}}>New here? </Text>
        <Pressable onPress={() => navigation.navigate('RoleSelector')}>
          <Text style={styles.linkStrong}>Create an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  linkStrong: {
    color: colors.primary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});
