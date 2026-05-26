import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {signOut} from '@zerebro/shared-firebase/auth';

import {colors, radius, spacing} from '../../theme';

/**
 * Shown to a signed-in user whose `users/{uid}` doc has `roles: []`.
 *
 * Today (Phase 3) this means a phone-OTP signup that completed
 * authentication but the back-end hasn't granted the user a role yet.
 * Examples that will hit this screen in Phase 4:
 *   - Principal who signed up via Zerebro Campus but their school doc
 *     hasn't been provisioned by an admin.
 *   - Teacher who applied via `requestTeacherJoin` and is still pending.
 *   - Brand-new admin who hasn't been added to the staff roster.
 *
 * Pre-Phase 4 we just block them here with a polite message + sign-out.
 * Phase 4 will replace this with a real "Awaiting principal approval" /
 * "Enter teacher code" flow per role.
 */
export function RoleOnboardingGate() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Almost there</Text>
      <Text style={styles.body}>
        Your account is signed in but doesn't have a role yet. Ask your
        school admin to grant you the right role (parent, teacher, or
        principal), then sign out and back in.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.signOut}
        onPress={() => {
          signOut().catch(err => console.warn('signOut failed', err));
        }}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
  signOut: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
