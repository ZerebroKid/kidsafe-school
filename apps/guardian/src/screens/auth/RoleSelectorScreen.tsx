import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Screen} from '../../components/Screen';
import {colors, radius, spacing} from '../../theme';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'RoleSelector'>;

/**
 * Three setup paths instead of the old two. The "Parent + shared phone" card is the
 * single-device-family flow — same `role: 'parent'` underneath but with
 * `deviceMode: 'shared'` threaded through to `ensureUserDoc` and onward to the engine /
 * navigator gating.
 */
export function RoleSelectorScreen({navigation}: Props) {
  return (
    <Screen
      title="How will you use KidSafe?"
      subtitle="Pick the setup that matches your family. You can change this later from Settings.">
      <RoleCard
        emoji="👨‍👩‍👧"
        title="Parent · two phones"
        description="I have my own phone and my child has their own phone"
        onPress={() => navigation.navigate('Signup', {role: 'parent', deviceMode: 'two_device'})}
      />
      <RoleCard
        emoji="📱"
        title="Parent · one shared phone"
        description="My child uses my phone for study time. Configure here, then hand it over."
        onPress={() => navigation.navigate('Signup', {role: 'parent', deviceMode: 'shared'})}
      />
      <RoleCard
        emoji="🙋"
        title="I'm a child"
        description="This phone will be monitored by my parent"
        onPress={() => navigation.navigate('Signup', {role: 'child'})}
      />
      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={styles.existing}>Already have an account? Log in</Text>
      </Pressable>
    </Screen>
  );
}

function RoleCard({
  emoji,
  title,
  description,
  onPress,
}: {
  emoji: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={{flex: 1}}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 18,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  existing: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: 15,
    marginTop: spacing.md,
  },
});
