import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text} from 'react-native';

import {callFn} from '@zerebro/shared-firebase';
import {signOut} from '@zerebro/shared-firebase/auth';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {colors, spacing} from '../../theme';

/**
 * P4.4 -- parent-side onboarding for the school invite code.
 *
 * Mounted by RoleOnboardingGate when the user picks "I'm a parent" from the
 * intent picker AND `users/{uid}.roles[]` does NOT yet include 'parent'.
 * Replaces the previous P4.3 `ParentComingSoon` placeholder.
 *
 * Flow:
 *   1. Parent enters the 8-char school inviteCode that their principal
 *      shared manually (WhatsApp / SMS / in person).
 *   2. Parent enters their display name.
 *   3. Submit calls the `joinSchoolAsParent` callable. On success the
 *      server array-unions 'parent' into `users/{uid}.roles`. The
 *      RootNavigator's user-doc onSnapshot fires on the same tick,
 *      unmounts this gate, and drops the user into ParentNavigator --
 *      no app restart, no manual refresh.
 *
 * UNLIKE the teacher flow there is NO pending state. Either the code is
 * valid (and the role is granted instantly) or it isn't (and the user
 * sees an inline error and can retry). The "Approval gate" was explicitly
 * removed from this flow because the only thing parent role grants is
 * "manage my own child", which is already gated by pairing.
 *
 * `onBack` lets the parent return to the intent picker if they tapped the
 * wrong tile.
 */
export function JoinSchoolScreen({onBack}: {onBack: () => void}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (trimmedCode.length === 0) {
      Alert.alert('Missing code', 'Enter the school code your principal shared.');
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert('Missing name', 'Enter your full name.');
      return;
    }
    try {
      setLoading(true);
      await callFn<
        {inviteCode: string; displayName: string},
        {schoolId: string; alreadyJoined: boolean}
      >('joinSchoolAsParent', {
        inviteCode: trimmedCode,
        displayName: trimmedName,
      });
      // No UI swap here -- RootNavigator's user-doc listener picks up the
      // new role on the same tick and re-mounts us into ParentNavigator.
    } catch (err) {
      Alert.alert(
        'Could not join',
        (err as {message?: string} | null)?.message ??
          'Check the code and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title="Join your child's school"
      subtitle="Enter the school code your principal shared with you. You'll only do this once.">
      <TextInput
        label="School code"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={t => setCode(t.toUpperCase())}
        placeholder="ABCD1234"
        maxLength={12}
        style={styles.codeInput}
      />
      <TextInput
        label="Your full name"
        autoCapitalize="words"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Priya Sharma"
      />

      <Button title="Join school" onPress={onSubmit} loading={loading} />

      <Pressable onPress={onBack}>
        <Text style={styles.linkMuted}>Back to options</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          signOut().catch(err => console.warn('signOut failed', err));
        }}>
        <Text style={styles.linkMuted}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
  },
  linkMuted: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
