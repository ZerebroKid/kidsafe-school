import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {signOut} from '@zerebro/shared-firebase/auth';

import {JoinSchoolScreen} from '../parent/JoinSchoolScreen';
import {TeacherJoinScreen} from '../teacher/JoinScreen';
import {colors, radius, spacing} from '../../theme';

/**
 * P4.3 / P4.4 -- parent vs teacher INTENT picker.
 *
 * Mounted by RootNavigator when the signed-in user's `users/{uid}` doc has
 * `roles: []`. Both branches now wire to first-signup callables that grant
 * the role server-side and let RootNavigator's user-doc onSnapshot swap to
 * the right home navigator on the same render tick:
 *   1. Teacher (P4.3): enter principal-shared 6-char teacherCode via
 *      TeacherJoinScreen -> `requestTeacherJoin` -> wait for principal
 *      approval -> roles += 'teacher' -> TeacherNavigator.
 *   2. Parent (P4.4): enter principal-shared 8-char schoolCode via
 *      JoinSchoolScreen -> `joinSchoolAsParent` -> roles += 'parent'
 *      INSTANTLY (no approval gate) -> ParentNavigator.
 *
 * Intent is LOCAL state (not persisted). If the user back-navigates or
 * kills the app mid-flow, they'll see the picker again on next sign-in,
 * which is fine -- once roles[] is non-empty RootNavigator bypasses this
 * gate entirely.
 *
 * The "Sign out" escape hatch is always rendered so a user who got here
 * by accident (e.g. wrong phone number) can recover without uninstalling.
 */
export function RoleOnboardingGate() {
  const [intent, setIntent] = useState<'parent' | 'teacher' | null>(null);

  if (intent === 'teacher') {
    return <TeacherJoinScreen onBack={() => setIntent(null)} />;
  }
  if (intent === 'parent') {
    return <JoinSchoolScreen onBack={() => setIntent(null)} />;
  }
  return <IntentPicker onPick={setIntent} />;
}

function IntentPicker({
  onPick,
}: {
  onPick: (intent: 'parent' | 'teacher') => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Zerebro</Text>
      <Text style={styles.body}>
        Tell us how you'll use ZConnect so we can set up the right home
        screen for you.
      </Text>

      <View style={styles.choices}>
        <Pressable
          accessibilityRole="button"
          style={({pressed}) => [styles.choice, pressed && styles.choicePressed]}
          onPress={() => onPick('parent')}>
          <Text style={styles.choiceTitle}>I'm a parent</Text>
          <Text style={styles.choiceBody}>
            Manage your child's phone, screen time, and location.
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({pressed}) => [styles.choice, pressed && styles.choicePressed]}
          onPress={() => onPick('teacher')}>
          <Text style={styles.choiceTitle}>I'm a teacher</Text>
          <Text style={styles.choiceBody}>
            Enter the 6-digit code your principal shared with you.
          </Text>
        </Pressable>
      </View>

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
  choices: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  choice: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.xs,
  },
  choicePressed: {
    opacity: 0.7,
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  choiceBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  signOut: {
    marginTop: spacing.md,
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
