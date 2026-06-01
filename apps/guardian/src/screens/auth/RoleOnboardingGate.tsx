import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Circle, Path} from 'react-native-svg';

import {signOut} from '@zerebro/shared-firebase/auth';

import {JoinSchoolScreen} from '../parent/JoinSchoolScreen';
import {TeacherJoinScreen} from '../teacher/JoinScreen';
import {colors, radius, spacing} from '../../theme';

/**
 * P4.3 / P4.4 -- parent vs teacher INTENT picker.
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

function ParentIcon({color = colors.text}: {color?: string}) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3" stroke={color} strokeWidth={1.8} />
      <Circle cx="16" cy="8" r="2.5" stroke={color} strokeWidth={1.8} />
      <Path
        d="M4 20c0-3 2.5-5 5-5s5 2 5 5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M13 19.5c0-2 1.5-3.5 3-3.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TeacherIcon({color = colors.text}: {color?: string}) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 16.5v-11z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M6.5 3v16" stroke={color} strokeWidth={1.8} />
      <Path
        d="M8 7h8M8 11h6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IntentPicker({
  onPick,
}: {
  onPick: (intent: 'parent' | 'teacher') => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Zerebro</Text>
          <Text style={styles.subtitle}>
            Choose how you'll use ZConnect. You only set this up once.
          </Text>
        </View>

        <View style={styles.choices}>
          <Pressable
            accessibilityRole="button"
            style={({pressed}) => [styles.choice, pressed && styles.choicePressed]}
            onPress={() => onPick('parent')}>
            <View style={styles.iconWrap}>
              <ParentIcon />
            </View>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>I'm a parent</Text>
              <Text style={styles.choiceBody}>
                Join your child's school and manage their device.
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({pressed}) => [styles.choice, pressed && styles.choicePressed]}
            onPress={() => onPick('teacher')}>
            <View style={styles.iconWrap}>
              <TeacherIcon />
            </View>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>I'm a teacher</Text>
              <Text style={styles.choiceBody}>
                Enter the code from your principal and pick your classes.
              </Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({pressed}) => [styles.signOut, pressed && styles.choicePressed]}
          onPress={() => {
            signOut().catch(err => console.warn('signOut failed', err));
          }}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  choices: {
    gap: spacing.md,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  choicePressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    flex: 1,
    gap: spacing.xs,
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  choiceBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  signOut: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  signOutText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
