import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {AppLogo} from '../../components/AppLogo';
import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {colors, radius, spacing} from '../../theme';
import {sendPasswordReset, signInWithEmail, signInWithGoogle} from '@zerebro/shared-firebase/auth';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({navigation}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await signInWithEmail(email.trim(), password);
      // App.tsx onAuthStateChanged takes over from here
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (e) {
      const message = (e as Error).message;
      if (message !== 'Google sign-in was cancelled.') {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    if (!email.trim()) {
      setError('Type your email in the field first, then tap Forgot password.');
      return;
    }
    try {
      setError(null);
      await sendPasswordReset(email.trim());
      Alert.alert('Check your inbox', 'We sent you a reset link.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen title="Welcome back" subtitle="Log in to continue managing your family's devices.">
      <AppLogo size={48} showLabel style={styles.logo} />
      {error ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      <TextInput
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={value => {
          setEmail(value);
          if (error) {
            setError(null);
          }
        }}
        placeholder="you@example.com"
      />
      <TextInput
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={value => {
          setPassword(value);
          if (error) {
            setError(null);
          }
        }}
        placeholder="••••••••"
      />

      <Button title="Log in" onPress={onLogin} loading={loading} />
      <Button title="Continue with Google" variant="secondary" onPress={onGoogle} loading={loading} />

      <Pressable onPress={onForgot}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={{color: colors.textMuted}}>New here? </Text>
        <Pressable onPress={() => navigation.navigate('Signup', {role: 'child'})}>
          <Text style={styles.linkStrong}>Create an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    marginBottom: spacing.sm,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: colors.text,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  linkStrong: {
    color: colors.text,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});
