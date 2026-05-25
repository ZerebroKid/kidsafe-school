import React, {useCallback, useEffect, useState} from 'react';
import {Alert, Share, StyleSheet, Text, View} from 'react-native';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {colors, radius, spacing} from '../../theme';
import {useAuthStore} from '../../state/authStore';
import {getUserDoc, signOut} from '@zerebro/shared-firebase/auth';
import {generatePairingCode} from '../../firebase/pairing';
import {ENV} from '../../config/env';

/**
 * Parent settings — two-device pairing + sign-out.
 *
 * The v1 shared-mode "Device mode" tile and switchToTwoDevice flow were
 * deleted in P1.6.1: ZConnect is now exclusively a two-device parent app
 * with zero native modules.
 */
export function SettingsScreen() {
  const uid = useAuthStore(s => s.firebaseUid);
  const userDoc = useAuthStore(s => s.userDoc);
  const setUserDoc = useAuthStore(s => s.setUserDoc);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!uid) {return;}
    setUserDoc(await getUserDoc(uid));
  }, [uid, setUserDoc]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const code = userDoc?.pairingCode;
  const expiresIn = userDoc?.pairingCodeExpiresAt
    ? Math.max(0, Math.ceil((userDoc.pairingCodeExpiresAt - Date.now()) / 60_000))
    : null;

  async function regenerate() {
    if (!uid) {return;}
    try {
      setLoading(true);
      await generatePairingCode(uid);
      await refresh();
    } catch (e) {
      Alert.alert('Could not generate code', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function shareCode() {
    if (!code) {return;}
    try {
      await Share.share({
        message: `Set up ZKid on your kid's phone and enter this code: ${code} (expires in ${ENV.PAIRING_CODE_TTL_MINS} minutes).`,
      });
    } catch (e) {
      // user cancelled
    }
  }

  return (
    <Screen
      title="Settings"
      subtitle="Share the pairing code with your child to link their phone.">
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Pairing code</Text>
        <Text style={styles.codeValue}>{code ?? '\u2014 \u2014 \u2014 \u2014 \u2014 \u2014'}</Text>
        {code && expiresIn !== null && (
          <Text style={styles.codeExpires}>Expires in {expiresIn} min</Text>
        )}
      </View>

      <View style={{flexDirection: 'row', gap: spacing.sm}}>
        <View style={{flex: 1}}>
          <Button title={code ? 'Regenerate' : 'Generate'} onPress={regenerate} loading={loading} />
        </View>
        {code && (
          <View style={{flex: 1}}>
            <Button title="Share" variant="secondary" onPress={shareCode} />
          </View>
        )}
      </View>

      <View style={{marginTop: spacing.xl}}>
        <Button title="Sign out" variant="danger" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  codeLabel: {
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  codeValue: {
    color: colors.primary,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: 8,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  codeExpires: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontSize: 13,
  },
});
