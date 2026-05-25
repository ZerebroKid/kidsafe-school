import React, {useEffect, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {ChildMode, Pin} from '../../modules/native';
import {colors, radius, spacing} from '../../theme';
import {setChildModeActive, sharedProfileChildUid} from '@zerebro/shared-firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import type {ChildModeStackParamList} from '../../navigation/types';

type Nav = NativeStackNavigationProp<ChildModeStackParamList, 'ExitPin'>;

/**
 * Parent PIN entry to exit Child Mode.
 *
 * Two failure modes are surfaced:
 *   - Wrong PIN: shake-the-input + count-up of failed attempts. After the 5th failure the
 *     native `Pin` module starts a growing lockout (30s → 60s → ... → 10 min cap). We poll
 *     `Pin.lockoutRemainingMs()` and surface a countdown so the child can't just spam.
 *   - Forgotten PIN: a low-prominence "Forgot PIN?" link routes to the password-reset flow,
 *     which uses Firebase's `sendPasswordResetEmail` + a deliberate `Pin.clearPin()` after
 *     the parent successfully re-authenticates.
 *
 * On success we flip the kiosk OFF in both layers (native flag first so AppBlockerService
 * stops gating, then Firestore so a parent's other signed-in instance sees the change), then
 * navigate to the "Ended" splash which auto-pops back to the dashboard.
 */
export function ExitPinScreen() {
  const navigation = useNavigation<Nav>();
  const parentUid = useAuthStore(s => s.firebaseUid);
  const sharedChildUid = useAuthStore(s => s.userDoc?.sharedProfile?.childUid);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(0);
  const inputRef = useRef<RNTextInput>(null);

  // Poll the native lockout countdown so the UI ticks down without us having to keep state.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const remaining = await Pin.lockoutRemainingMs();
        if (!cancelled) {setLockoutMs(Math.max(0, remaining));}
      } catch {
        if (!cancelled) {setLockoutMs(0);}
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function onSubmit() {
    if (!parentUid) {return;}
    if (lockoutMs > 0) {return;}
    if (pin.length < 4) {
      setError('Enter at least 4 digits');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const ok = await Pin.verifyPin(pin);
      if (!ok) {
        setPin('');
        setError('Wrong PIN. Try again.');
        inputRef.current?.focus();
        return;
      }
      // PIN verified. Flip native FIRST so the next accessibility event sees Child Mode off
      // and stops blocking immediately. Firestore catches up async.
      const childUid = sharedChildUid ?? sharedProfileChildUid(parentUid);
      await ChildMode.setActive(false, childUid);
      try {
        await setChildModeActive(parentUid, false);
      } catch (e) {
        // Firestore mirror failure shouldn't block the user from exiting — they're already
        // out locally. The next foreground sync will retry.
        console.warn('Firestore childMode mirror failed', e);
      }
      navigation.replace('ChildModeEnded');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  const disabled = verifying || lockoutMs > 0 || pin.length < 4;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.title}>Enter your parent PIN</Text>
        <Text style={styles.subtitle}>
          This is the 4-6 digit PIN you set during KidSafe setup.
        </Text>

        <RNTextInput
          ref={inputRef}
          value={pin}
          onChangeText={text => {
            setPin(text.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          keyboardType="number-pad"
          secureTextEntry
          autoFocus
          maxLength={6}
          style={styles.pinInput}
          editable={lockoutMs === 0}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {lockoutMs > 0 ? (
          <Text style={styles.lockout}>
            Too many wrong attempts. Try again in {Math.ceil(lockoutMs / 1000)}s.
          </Text>
        ) : null}

        <Button
          title={verifying ? 'Verifying\u2026' : 'Exit Child Mode'}
          onPress={onSubmit}
          loading={verifying}
          disabled={disabled}
        />

        <Pressable onPress={() => navigation.navigate('ForgotPin')}>
          <Text style={styles.forgot}>Forgot PIN?</Text>
        </Pressable>
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
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  pinInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 32,
    letterSpacing: 12,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  lockout: {
    color: colors.warning,
    fontSize: 14,
  },
  forgot: {
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
});
