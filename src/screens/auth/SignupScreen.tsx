import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {colors, spacing} from '../../theme';
import {signUpWithEmail} from '../../firebase/auth';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({route, navigation}: Props) {
  const {role} = route.params;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (name.trim().length < 2) {
      Alert.alert('Enter your name', 'Name is required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Use at least 6 characters.');
      return;
    }
    try {
      setLoading(true);
      await signUpWithEmail({name: name.trim(), email: email.trim(), password, role});
      // App.tsx routes them to the verify screen or next step
    } catch (e) {
      Alert.alert('Signup failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title={role === 'parent' ? 'Create a parent account' : 'Create a child account'}
      subtitle={
        role === 'parent'
          ? 'This account will see the children you link to it.'
          : "You'll need your parent's 6-digit code in the next step."
      }>
      <TextInput
        label="Your name"
        value={name}
        onChangeText={setName}
        placeholder={role === 'child' ? 'e.g. Ali' : 'e.g. Mom'}
      />
      <TextInput
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Min. 6 characters"
      />

      <Button title="Sign up" onPress={onSubmit} loading={loading} />

      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
