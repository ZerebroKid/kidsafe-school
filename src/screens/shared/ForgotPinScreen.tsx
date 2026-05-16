import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {ChildMode, Pin} from '../../modules/native';
import {colors, radius, spacing} from '../../theme';
import {sendPasswordReset} from '../../firebase/auth';
import {setChildModeActive, sharedProfileChildUid} from '../../firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import type {ChildModeStackParamList} from '../../navigation/types';

type Nav = NativeStackNavigationProp<ChildModeStackParamList, 'ForgotPin'>;

/**
 * Recovery path when the parent forgets their own PIN.
 *
 * Two-step recovery, deliberately spaced out so a child grabbing the phone can't speed-run it:
 *
 *   1. Send a Firebase password-reset email to the parent's account email. We display the
 *      email so the parent confirms it's the right inbox, then they have to leave the kiosk,
 *      open their email on another device (or via SMS-to-email if it's their only phone),
 *      click the reset link, and pick a new password.
 *   2. Back in the kiosk, after successfully signing in with the new password (which Firebase
 *      requires a manual reload of), they tap "I've reset my password" — which clears the
 *      on-device PIN, flips Child Mode off, and routes them back to the dashboard. From
 *      there they can immediately set a new PIN via the normal onboarding pinSetupStep.
 *
 * This is deliberately a multi-step physical-action flow. We don't auto-clear the PIN as
 * soon as the email is sent because then a child with access to the parent's email could
 * use that same email server to escape the kiosk.
 */
export function ForgotPinScreen() {
  const navigation = useNavigation<Nav>();
  const email = useAuthStore(s => s.userDoc?.email);
  const parentUid = useAuthStore(s => s.firebaseUid);
  const sharedChildUid = useAuthStore(s => s.userDoc?.sharedProfile?.childUid);

  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function sendEmail() {
    if (!email) {
      Alert.alert('No email on file', 'Sign back in with the original parent account to recover.');
      return;
    }
    try {
      setSending(true);
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      Alert.alert('Could not send reset email', (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function clearPinAndExit() {
    if (!parentUid) {return;}
    try {
      setClearing(true);
      // Clear the on-device PIN so the next onboarding pin-setup step prompts for a new one.
      await Pin.clearPin();
      // Flip Child Mode off in both layers.
      const childUid = sharedChildUid ?? sharedProfileChildUid(parentUid);
      await ChildMode.setActive(false, childUid);
      try {
        await setChildModeActive(parentUid, false);
      } catch (e) {
        console.warn('Firestore childMode mirror failed', e);
      }
      navigation.replace('ChildModeEnded');
    } catch (e) {
      Alert.alert('Recovery failed', (e as Error).message);
    } finally {
      setClearing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.title}>Reset your PIN</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Step 1 \u00b7 Reset your password</Text>
          <Text style={styles.cardBody}>
            We\u2019ll email a reset link to{' '}
            <Text style={styles.email}>{email ?? 'your account email'}</Text>. Open it on any
            device (another phone, a laptop, even a friend\u2019s) and choose a new password.
          </Text>
          <Button
            title={sent ? 'Email sent \u2713' : sending ? 'Sending\u2026' : 'Send reset email'}
            onPress={sendEmail}
            loading={sending}
            disabled={sent}
            variant={sent ? 'secondary' : 'primary'}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Step 2 \u00b7 Clear the on-device PIN</Text>
          <Text style={styles.cardBody}>
            After you\u2019ve changed your password and signed back in on another device, tap
            the button below. KidSafe will clear the local PIN, exit Child Mode, and ask you
            to set a fresh PIN on the next launch.
          </Text>
          <Button
            title={clearing ? 'Clearing\u2026' : "I've reset my password \u00b7 exit Child Mode"}
            onPress={clearPinAndExit}
            loading={clearing}
            disabled={!sent || clearing}
            variant="danger"
          />
        </View>

        <Text style={styles.note}>
          The on-device PIN is only cleared when you tap the Step 2 button. Sending the email
          alone does nothing to Child Mode \u2014 this keeps a curious child from exiting on
          their own.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  email: {
    color: colors.text,
    fontWeight: '600',
  },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
});
