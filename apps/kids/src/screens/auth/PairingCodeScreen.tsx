import React, {useState} from 'react';
import {Alert, StyleSheet, Text} from 'react-native';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {colors, spacing} from '../../theme';
import {linkChildToParent} from '../../firebase/pairing';
import {getUserDoc} from '@zerebro/shared-firebase/auth';
import {useAuthStore} from '../../state/authStore';

/**
 * Shown to a freshly-signed-up child before the permissions onboarding. They key in the 6-digit
 * code their parent got during parent signup.
 */
export function PairingCodeScreen() {
  const uid = useAuthStore(s => s.firebaseUid);
  const setUserDoc = useAuthStore(s => s.setUserDoc);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLink() {
    if (!uid) return;
    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d+$/.test(trimmed)) {
      Alert.alert('Invalid code', 'Enter the 6-digit code shown on your parent\'s phone.');
      return;
    }
    try {
      setLoading(true);
      await linkChildToParent(uid, trimmed);
      const doc = await getUserDoc(uid);
      setUserDoc(doc);
    } catch (e) {
      Alert.alert('Could not link', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title="Enter your parent's code"
      subtitle="Your parent can find this 6-digit code in their KidSafe Settings screen.">
      <TextInput
        label="Pairing code"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        style={styles.bigCode}
      />
      <Button title="Link to my parent" onPress={onLink} loading={loading} />
      <Text style={styles.tip}>
        Tip: codes expire after 10 minutes. If it doesn't work, ask your parent to generate a new
        one and try again.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bigCode: {
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  tip: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
