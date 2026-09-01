import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';

export interface ClassMetrics {
  total: number;
  attempted: number;
  notAttempted: number;
  passed: number;
  failed: number;
  avg: number | null;
  buckets?: number[];
}

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function CosmicOutcomeDonut({metrics}: {metrics: ClassMetrics}) {
  const segments: Segment[] = [
    {key: 'passed', label: 'Passed', value: metrics.passed, color: cosmicColors.cyan},
    {key: 'failed', label: 'Keep going', value: metrics.failed, color: cosmicColors.pink},
    {
      key: 'notAttempted',
      label: 'Not attempted',
      value: metrics.notAttempted,
      color: 'rgba(255, 255, 255, 0.25)',
    },
  ];

  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const denom = metrics.total > 0 ? metrics.total : 1;

  let acc = 0;

  return (
    <View style={styles.donutCard}>
      <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background Track */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={stroke}
            fill="none"
          />
          {segments.map(seg => {
            if (seg.value <= 0) return null;
            const frac = seg.value / denom;
            const dash = frac * circumference;
            const dashArray = `${dash} ${circumference - dash}`;
            const dashOffset = -acc * circumference;
            acc += frac;
            return (
              <Circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={r}
                stroke={seg.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <Text style={styles.donutPassedVal}>
            {metrics.passed}/{metrics.total}
          </Text>
          <Text style={styles.donutPassedLabel}>PASSED</Text>
        </View>
      </View>

      {/* Legend Rows */}
      <View style={styles.legend}>
        {segments.map(seg => (
          <View key={seg.key} style={styles.legendRow}>
            <View style={[styles.legendDot, {backgroundColor: seg.color}]} />
            <Text style={styles.legendLabel}>{seg.label}</Text>
            <Text style={styles.legendValue}>{seg.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutCard: {
    padding: 18,
    borderRadius: cosmicRadius.xl,
    backgroundColor: cosmicColors.cardBgSubtle,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPassedVal: {
    color: cosmicColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  donutPassedLabel: {
    color: cosmicColors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 1,
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  legendValue: {
    color: cosmicColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
