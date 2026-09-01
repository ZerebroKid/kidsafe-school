import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {cosmicColors} from '../theme';

interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  valueText: string;
  labelText?: string;
}

export function ProgressRing({
  progress,
  size = 96,
  strokeWidth = 9,
  color = cosmicColors.purple,
  trackColor = 'rgba(255, 255, 255, 0.12)',
  valueText,
  labelText,
}: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const dashoffset = circumference - (clampedProgress / 100) * circumference;

  const innerSize = size - strokeWidth * 2 - 4;

  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track circle */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress stroke */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      {/* Center content */}
      <View
        style={[
          styles.center,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
        pointerEvents="none">
        <Text style={styles.valueText} numberOfLines={1}>
          {valueText}
        </Text>
        {labelText ? (
          <Text style={styles.labelText} numberOfLines={1}>
            {labelText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    backgroundColor: cosmicColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: cosmicColors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  labelText: {
    color: cosmicColors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 1,
  },
});
