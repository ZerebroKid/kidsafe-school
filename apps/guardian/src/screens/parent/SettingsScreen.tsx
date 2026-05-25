import React, {useCallback, useEffect, useState} from 'react';
import {Alert, Share, StyleSheet, Text, View} from 'react-native';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {colors, radius, spacing} from '../../theme';
import {useAuthStore} from '../../state/authStore';
import {getUserDoc, signOut} from '@zerebro/shared-firebase/auth';
import {generatePairingCode} from '../../firebase/pairing';
import {ChildMode} from '../../modules/native';
import {deleteSharedChildProfile} from '@zerebro/shared-firebase/firestore';
import {ENV} from '../../config/env';

/**
 * Parent settings.
 *
 * Two presentations depending on `userDoc.deviceMode`:
 *   - `two_device` (default): the original pairing-code + share UI.
 *   - `shared`: a "Device mode" tile that summarises the shared-phone setup and lets the
 *     parent switch BACK to two-device. The switch tears down the shared profile and clears
 *     the native shared flag so the install behaves like a fresh two-device parent.
 *
 * Sign-out is identical in both modes.
 */
export function SettingsScreen() {
  const uid = useAuthStore(s => s.firebaseUid);
  const userDoc = useAuthStore(s => s.userDoc);
  const setUserDoc = useAuthStore(s => s.setUserDoc);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(async () => {
    if (!uid) {return;}
    setUserDoc(await getUserDoc(uid));
  }, [uid, setUserDoc]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isShared = userDoc?.deviceMode === 'shared';
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
        message: `Set up KidSafe on your phone and enter this code: ${code} (expires in ${ENV.PAIRING_CODE_TTL_MINS} minutes).`,
      });
    } catch (e) {
      // user cancelled
    }
  }

  function confirmSwitchToTwoDevice() {
    Alert.alert(
      'Switch to two-phone mode?',
      "We'll delete the shared profile (apps, schedule, usage history) so this phone becomes a regular parent dashboard. Your child's data on a separate phone is untouched.",
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Switch', style: 'destructive', onPress: switchToTwoDevice},
      ],
    );
  }

  async function switchToTwoDevice() {
    if (!uid) {return;}
    try {
      setSwitching(true);
      // Tear down Firestore first (the source of truth for the profile data). If this fails
      // mid-way the next switch attempt resumes from where it left off — Firestore deletes
      // are idempotent.
      await deleteSharedChildProfile(uid);
      // Clear the native shared flag last — this is what `AppBlockerService` checks to
      // decide whether to short-circuit. After this, the install behaves like any
      // two-device parent. We also clear any stuck Child Mode flag for safety.
      await ChildMode.setSharedDevice(false);
      await refresh();
    } catch (e) {
      Alert.alert('Switch failed', (e as Error).message);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Screen
      title="Settings"
      subtitle={
        isShared
          ? "You're set up for one-phone family mode. Use the controls below to switch back to two phones."
          : 'Share the pairing code with your child to link their phone.'
      }>
      {isShared ? (
        <View style={styles.modeCard}>
          <Text style={styles.modeLabel}>Device mode</Text>
          <Text style={styles.modeValue}>One shared phone</Text>
          <Text style={styles.modeBody}>
            Profile: <Text style={styles.modeProfile}>{userDoc?.sharedProfile?.childName ?? 'n/a'}</Text>
          </Text>
          <Button
            title={switching ? 'Switching\u2026' : 'Switch to two-phone mode'}
            variant="secondary"
            onPress={confirmSwitchToTwoDevice}
            loading={switching}
          />
        </View>
      ) : (
        <>
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
        </>
      )}

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
  modeCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  modeLabel: {
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  modeValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  modeBody: {
    color: colors.textMuted,
    fontSize: 14,
  },
  modeProfile: {
    color: colors.text,
    fontWeight: '600',
  },
});
