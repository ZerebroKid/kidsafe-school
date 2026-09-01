/**
 * ZKProgressRing — Circular SVG progress ring.
 *
 * Uses `stroke-dasharray` / `stroke-dashoffset` technique from the design.
 * Optionally animates the fill value on mount.
 *
 * Used in:
 *  - HomeScreen612 mission card (3/7 sections)
 *  - SubjectListScreen subject overview (43%)
 *  - SubjectDetailScreen header (43%)
 */

import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, Text, View, ViewStyle} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {brand, colors, fonts, neutral} from '../../theme';

interface ZKProgressRingProps {
  /** Progress value 0–1 */
  progress: number;
  /** Ring diameter in dp */
  size?: number;
  /** Ring stroke width */
  strokeWidth?: number;
  /** Center label text (e.g. "3/7" or "43%") */
  label?: string;
  /** Ring fill color */
  color?: string;
  /** Ring track (background) color */
  trackColor?: string;
  style?: ViewStyle;
  /** Animate fill on mount */
  animated?: boolean;
}

// AnimatedCircle workaround for react-native-svg
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ZKProgressRing({
  progress,
  size = 76,
  strokeWidth = 8,
  label,
  color = brand.violet600,
  trackColor = brand.violet100,
  style,
  animated: shouldAnimate = true,
}: ZKProgressRingProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // SVG viewBox is always 80×80 to match the design's stroke-dasharray numbers
  const viewBoxR = 36;
  const viewBoxCircumference = 2 * Math.PI * viewBoxR;
  const offset = viewBoxCircumference * (1 - clampedProgress);

  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shouldAnimate) {
      Animated.timing(animValue, {
        toValue: clampedProgress,
        duration: 900,
        useNativeDriver: false,
      }).start();
    } else {
      animValue.setValue(clampedProgress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedProgress, shouldAnimate]);

  const animatedOffset = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [viewBoxCircumference, 0],
  });

  return (
    <View style={[{width: size, height: size}, styles.root, style]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={40}
          cy={40}
          r={viewBoxR}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Fill — animated */}
        <AnimatedCircle
          cx={40}
          cy={40}
          r={viewBoxR}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={viewBoxCircumference}
          strokeDashoffset={animatedOffset}
          rotation="-90"
          origin="40, 40"
        />
      </Svg>
      {label != null && (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  label: {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontWeight: '700',
    fontSize: 14,
    color: neutral.ink900,
    textAlign: 'center',
  },
});
