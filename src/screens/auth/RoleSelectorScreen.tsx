import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Screen} from '../../components/Screen';
import {colors, radius, spacing} from '../../theme';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'RoleSelector'>;

export function RoleSelectorScreen({navigation}: Props) {
  return (
    <Screen
      title="Who is this device for?"
      subtitle="Pick Parent if you will monitor your child's device from this phone. Pick Child if this IS your child's phone.">
      <RoleCard
        emoji="👨‍👩‍👧"
        title="I'm a parent"
        description="Keep an eye on my child from this device"
        onPress={() => navigation.navigate('Signup', {role: 'parent'})}
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
