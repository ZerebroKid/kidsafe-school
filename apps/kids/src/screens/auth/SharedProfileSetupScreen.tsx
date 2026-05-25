import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {colors, radius, spacing} from '../../theme';
import {createSharedChildProfile} from '@zerebro/shared-firebase/firestore';
import {ChildMode} from '../../modules/native';
import {useAuthStore} from '../../state/authStore';

/**
 * First-time setup for a "Parent · one shared phone" install.
 *
 * Asks for the child's display name (the only field the parent has to fill in here; the
 * profile id is deterministic — `${parentUid}_shared`). On submit:
 *
 *   1. Writes `children/{parentUid}_shared` with `mode:'shared', parentUid` so the
 *      `parentOwns(...)` Firestore rule lets this same parent read + write everything.
 *   2. Stamps `users/{parentUid}.sharedProfile` so the auth store knows the profile exists
 *      and `ParentNavigator` flips off this screen.
 *   3. Persists `DEVICE_MODE=shared` natively so `AppBlockerService` knows to apply the
 *      shared-phone short-circuit even before the JS engine boots after a reboot.
 *
 * Idempotent — re-running on an existing profile just updates the name.
 */
export function SharedProfileSetupScreen() {
  const parentUid = useAuthStore(s => s.firebaseUid);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!parentUid) {
      Alert.alert(
        'Not signed in',
        'Please sign in again — we lost track of your account.',
      );
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Add a name', 'Enter your child\u2019s first name so the dashboard can label things.');
      return;
    }
    try {
      setLoading(true);
      await createSharedChildProfile(parentUid, trimmed);
      // Flip the native flag so the accessibility service routes correctly on first event,
      // even before the parent finishes the permissions wizard that follows.
      await ChildMode.setSharedDevice(true);
      // No navigation.navigate() needed — ParentNavigator's prop-driven gate will see the
      // new sharedProfile on the next render and push us into the permissions wizard.
    } catch (e) {
      Alert.alert('Setup failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title="Set up your child\u2019s profile"
      subtitle="One profile per shared phone. You can rename it later from Settings.">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What is your child\u2019s name?</Text>
        <Text style={styles.cardBody}>
          We use this label in the dashboard and the Child Mode kiosk. Nothing about your
          child is shared off-device beyond what you can see in your own dashboard.
        </Text>
      </View>
      <TextInput
        label="Child\u2019s name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ayaan"
      />
      <Button title="Continue" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
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
});
