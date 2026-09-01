/**
 * SplashScreen612 — ZerebroKid Class 6–12 splash screen.
 *
 * Design: Phase 2 · Screen 01 · SPLASH
 * Full-screen violet gradient, centered logo, wordmark, loading dots animation.
 *
 * This screen is shown while the app initialises (auth + Firestore bootstrap).
 * It auto-navigates when ready (handled by RootNavigator/ChildNavigator gate).
 */

import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {brand, fonts, neutral} from '../../../theme';

export function SplashScreen612() {
  // Three shimmer dots with staggered animation
  const dot1 = useRef(new Animated.Value(0.4)).current;
  const dot2 = useRef(new Animated.Value(0.4)).current;
  const dot3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const shimmer = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            delay,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.4,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = shimmer(dot1, 0);
    const a2 = shimmer(dot2, 150);
    const a3 = shimmer(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.root}>
      {/* Gradient background */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="splashBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={brand.violet500} />
            <Stop offset="1" stopColor={brand.violet700} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#splashBg)" />
      </Svg>

      {/* Decorative circles */}
      <View style={styles.circleTopLeft} />
      <View style={styles.circleBottomRight} />

      {/* Center content */}
      <View style={styles.centerContent}>
        {/* Logo slot */}
        <View style={styles.logoSlot}>
          <Text style={styles.logoZ}>Z</Text>
          <Text style={styles.logoSlotLabel}>LOGO SLOT</Text>
        </View>

        {/* Wordmark */}
        <View style={styles.wordmarkGroup}>
          <Text style={styles.wordmark}>ZerebroKid</Text>
          <Text style={styles.tagline}>Padhai ka naya operating system</Text>
        </View>
      </View>

      {/* Loading dots */}
      <View style={styles.loaderArea}>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, {opacity: dot1}]} />
          <Animated.View style={[styles.dot, {opacity: dot2}]} />
          <Animated.View style={[styles.dot, {opacity: dot3}]} />
        </View>
        <Text style={styles.loaderText}>Getting today's topic ready</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  circleTopLeft: {
    position: 'absolute',
    left: -60,
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    pointerEvents: 'none',
  },
  circleBottomRight: {
    position: 'absolute',
    right: -80,
    bottom: 120,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    pointerEvents: 'none',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
  },
  logoSlot: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logoZ: {
    fontFamily: fonts.headingExtraBold,
    fontWeight: '800',
    fontSize: 52,
    lineHeight: 56,
    color: neutral.surface,
    letterSpacing: -1,
  },
  logoSlotLabel: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.55)',
  },
  wordmarkGroup: {
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: fonts.headingExtraBold,
    fontWeight: '800',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.7,
    color: neutral.surface,
  },
  tagline: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.82)',
  },
  loaderArea: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 64,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: neutral.surface,
  },
  loaderText: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '500',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
});
