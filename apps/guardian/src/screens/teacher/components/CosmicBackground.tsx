import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';
import {cosmicColors} from '../theme';

interface CosmicBackgroundProps {
  children?: React.ReactNode;
  applyTopInset?: boolean;
}

/**
 * Cosmic ambient background containing dark radial glowing orbs (purple top-left, pink bottom-right)
 * and subtle celestial stars. Seamlessly handles top safe area and status bar styling.
 */
export function CosmicBackground({
  children,
  applyTopInset = true,
}: CosmicBackgroundProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={cosmicColors.surface}
      />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            {/* Top-left Purple glow */}
            <RadialGradient
              id="purpleGlow"
              cx="10%"
              cy="0%"
              r="60%"
              fx="10%"
              fy="0%">
              <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.38" />
              <Stop offset="65%" stopColor="#8B5CF6" stopOpacity="0" />
            </RadialGradient>
            {/* Bottom-right Pink glow */}
            <RadialGradient
              id="pinkGlow"
              cx="95%"
              cy="85%"
              r="55%"
              fx="95%"
              fy="85%">
              <Stop offset="0%" stopColor="#EC4899" stopOpacity="0.28" />
              <Stop offset="70%" stopColor="#EC4899" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={cosmicColors.surface} />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#purpleGlow)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pinkGlow)" />
        </Svg>
        {/* Subtle celestial star dots */}
        <View style={[styles.star, {top: 140, right: 36, width: 6, height: 6, opacity: 0.7}]} />
        <View style={[styles.star, {top: 280, left: 32, width: 4, height: 4, backgroundColor: '#06B6D4', opacity: 0.8}]} />
        <View style={[styles.star, {bottom: 240, left: 100, width: 3, height: 3, opacity: 0.5}]} />
        <View style={[styles.star, {top: 420, right: 60, width: 3.5, height: 3.5, opacity: 0.6}]} />
      </View>
      <View
        style={[
          styles.contentWrap,
          applyTopInset && {paddingTop: insets.top},
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cosmicColors.bg,
  },
  contentWrap: {
    flex: 1,
  },
  star: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
  },
});
