/**
 * ZKProgressBar — Horizontal progress bar.
 *
 * Used in:
 *  - Subject list cards (per-subject progress)
 *  - Subject detail header (syllabus coverage)
 *  - Chapter cards (chapter completion)
 */

import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View, ViewStyle} from 'react-native';
import {radius} from '../../theme';

interface ZKProgressBarProps {
  /** Progress 0–1 */
  progress: number;
  /** Height in dp (default: 8) */
  height?: number;
  /** Fill color */
  color?: string;
  /** Track color */
  trackColor?: string;
  /** Animate on mount */
  animated?: boolean;
  style?: ViewStyle;
}

export function ZKProgressBar({
  progress,
  height = 8,
  color = '#6D3BFF',
  trackColor = '#EDE6FF',
  animated: shouldAnimate = true,
  style,
}: ZKProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shouldAnimate) {
      Animated.timing(widthAnim, {
        toValue: clampedProgress,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(clampedProgress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedProgress, shouldAnimate]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const barRadius = height / 2;

  return (
    <View
      style={[
        styles.track,
        {height, borderRadius: barRadius, backgroundColor: trackColor},
        style,
      ]}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: animatedWidth,
            height,
            borderRadius: barRadius,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
