import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';

import {ensurePhoneUserDoc} from '@zerebro/shared-firebase/auth';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {colors, spacing} from '../../theme';
import {stashConfirmation, takeConfirmation} from './phoneConfirmationStore';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneConfirm'>;

/**
 * P4.3 -- enter the 6-digit code SMS'd by Firebase Phone Auth.
 *
 * On success Firebase fires `auth().onAuthStateChanged` with the now-
 * signed-in user; RootNavigator's auth subscription then takes over and
 * routes based on `users/{uid}.roles[]`:
 *   - roles=[]                      -> RoleOnboardingGate (intent picker)
 *   - roles includes 'teacher'      -> TeacherNavigator
 *   - roles includes 'parent'       -> ParentNavigator
 *
 * Re-send: when the user taps "Send a new code" we issue a fresh
 * `signInWithPhoneNumber(phone, true)` (forceResend=true) and stash the
 * new confirmation under its verificationId. The URL param verificationId
 * is rewritten by navigation so the next confirm pulls the new handle.
 */
export function PhoneConfirmScreen({route, navigation}: Props) {
  const {verificationId, phone} = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const confirmation = useMemo(
    () => takeConfirmation(verificationId),
    [verificationId],
  );

  // If the user back-navigated and we already consumed the confirmation,
  // bounce them to the start so they get a fresh OTP. We can't try to
  // confirm without a live handle.
  useEffect(() => {
    if (!confirmation) {
      Alert.alert(
        'Session expired',
        'Please request a new code.',
        [{text: 'OK', onPress: () => navigation.replace('PhoneLogin')}],
        {cancelable: false},
      );
    }
  }, [confirmation, navigation]);

  async function onConfirm() {
    if (!confirmation) return;
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from the SMS.');
      return;
    }
    try {
      setLoading(true);
      const cred = await confirmation.confirm(code.trim());
      // Brand-new phone-OTP signups don't have a `users/{uid}` doc yet.
      // Create it with `roles: []` + the verified phone so RootNavigator
      // routes them through RoleOnboardingGate (intent picker) instead of
      // looping back to AuthNavigator on a null userDoc.
      if (cred?.user?.uid) {
        const phoneFromToken = cred.user.phoneNumber ?? phone;
        await ensurePhoneUserDoc(cred.user.uid, phoneFromToken);
      }
      // RootNavigator's onAuthStateChanged subscription takes over from here.
    } catch (err) {
      Alert.alert('Confirmation failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    try {
      setResending(true);
      const fresh = await auth().signInWithPhoneNumber(phone, true);
      const freshId = fresh.verificationId ?? `local-${Date.now()}`;
      stashConfirmation(freshId, fresh);
      navigation.setParams({verificationId: freshId});
    } catch (err) {
      Alert.alert('Could not resend', (err as Error).message);
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen
      title="Enter the code"
      subtitle={`We texted a 6-digit code to ${phone}. Enter it below to continue.`}>
      <TextInput
        label="6-digit code"
        autoCapitalize="none"
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
        placeholder="123456"
      />

      <Button title="Confirm" onPress={onConfirm} loading={loading} />

      <View style={styles.row}>
        <Text style={{color: colors.textMuted}}>Didn't get it? </Text>
        <Pressable onPress={onResend} disabled={resending}>
          <Text style={[styles.link, resending && styles.linkDisabled]}>
            {resending ? 'Sending…' : 'Send a new code'}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={() => navigation.replace('PhoneLogin')}>
        <Text style={styles.linkMuted}>Change number</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
  },
  linkDisabled: {
    opacity: 0.5,
  },
  linkMuted: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
