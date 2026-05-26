import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {signOut} from '@zerebro/shared-firebase/auth';

import {colors, radius, spacing} from '../theme';

const Stack = createNativeStackNavigator();

/**
 * Teacher mode stub.
 *
 * Mounted by `RootNavigator` when `userDoc.primaryRole === 'teacher'`.
 * Phase 4 (Group P4.5 - "Assign topic") replaces this single screen with
 * the real teacher home + assignment flow.
 *
 * The screen exists today so the Phase 3 RoleSwitcher has somewhere to
 * navigate to -- without it, a user who flipped their primaryRole to
 * 'teacher' would land on a blank navigator and the bug would only show
 * up at Phase 4 demo time.
 */
export function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="TeacherHome" component={TeacherHomeStub} />
    </Stack.Navigator>
  );
}

function TeacherHomeStub() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}>
      <Text style={styles.title}>Teacher mode</Text>
      <Text style={styles.body}>
        You're signed in as a teacher. The assignment + class report screens
        ship in Phase 4 (Group P4.5). Flip back to Parent at the top of the
        screen to use the v1 KidSafe parent dashboard in the meantime.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.signOut}
        onPress={() => {
          signOut().catch(err => console.warn('signOut failed', err));
        }}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  signOut: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
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
