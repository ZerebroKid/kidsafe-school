import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, radius, spacing} from '../../theme';

/**
 * Transient "Child Mode ended" splash shown for ~1.5s after the parent successfully exits
 * the kiosk. The `RootNavigator` is already polling `useChildModeActive()` and will swap
 * this whole navigator out for `ParentNavigator` as soon as the native flag is read as
 * false (typically within a poll cycle, <2s). The splash exists so the transition isn't
 * jarring \u2014 we tell the parent what just happened rather than dumping them straight
 * into the dashboard with no context.
 */
export function ChildModeEndedScreen() {
  // The actual navigation away from this screen is driven by `useChildModeActive()` in
  // `RootNavigator` flipping the gate \u2014 we don't need to do anything here. But we DO
  // log a console line so if a regression ever sticks the user on this screen we can spot
  // it in the logs immediately.
  useEffect(() => {
    console.log('[KidSafe] Child Mode ended \u2014 waiting for root nav to swap to dashboard');
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.title}>Child Mode ended</Text>
          <Text style={styles.subtitle}>
            Welcome back. You\u2019re on the parent dashboard again.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    alignSelf: 'stretch',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
