import React, {useState} from 'react';
import {Alert} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {stashConfirmation} from './phoneConfirmationStore';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

/**
 * P4.3 -- ZConnect's first-screen-on-cold-boot.
 *
 * Phase 4 unifies parent + teacher onboarding under phone-OTP because the
 * teacher join flow (P4.3) writes `users/{uid}.phone` from the verified
 * Firebase Auth token, and a verified phone is the only way to map the
 * principal's manually-shared teacherCode -> a known user account at
 * Approval time.
 *
 * The email/password path that shipped in P1 stays reachable behind a
 * "Continue with email" link at the bottom so existing parent accounts
 * (and our test rigs) don't get locked out mid-cutover. It should be
 * removed once 100% of accounts have been migrated to phone-OTP -- track
 * that under a Phase 5 cleanup ticket.
 *
 * We do NOT auto-format the phone here -- a free-form +91XXXXXXXXXX input
 * is good enough for India launch. A localised picker can land in P5+.
 */
export function PhoneLoginScreen({navigation}: Props) {
  const [phone, setPhone] = useState('+91');
  const [loading, setLoading] = useState(false);

  async function onSendCode() {
    const trimmed = phone.trim();
    if (!/^\+\d{8,15}$/.test(trimmed)) {
      Alert.alert(
        'Invalid number',
        'Enter your full phone number including the country code, e.g. +919812345678.',
      );
      return;
    }
    try {
      setLoading(true);
      const confirmation = await auth().signInWithPhoneNumber(trimmed);
      const verificationId = confirmation.verificationId;
      if (!verificationId) {
        // Some emulator paths leave verificationId null; we still get a valid
        // `confirm()` handle so we synthesise a deterministic id and stash the
        // confirmation under it for the next screen to retrieve.
        const fallbackId = `local-${Date.now()}`;
        stashConfirmation(fallbackId, confirmation);
        navigation.navigate('PhoneConfirm', {
          verificationId: fallbackId,
          phone: trimmed,
        });
        return;
      }
      stashConfirmation(verificationId, confirmation);
      navigation.navigate('PhoneConfirm', {verificationId, phone: trimmed});
    } catch (err) {
      Alert.alert('Could not send code', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title="Sign in with phone"
      subtitle="We'll text you a 6-digit code. Use the same phone your school knows you by.">
      <TextInput
        label="Phone number"
        autoCapitalize="none"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        placeholder="+919812345678"
      />

      <Button title="Send code" onPress={onSendCode} loading={loading} />
    </Screen>
  );
}
