/**
 * ZKSubjectIcon — 52×52 subject icon chip with SVG icon.
 *
 * Each subject has a semantic color and an SVG icon that represents it.
 * Used in SubjectListScreen and SubjectDetailScreen.
 */

import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {brand, radius, semantic} from '../../theme';

export type SubjectKey =
  | 'mathematics'
  | 'science'
  | 'english'
  | 'hindi'
  | 'social_science'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'geography'
  | 'economics'
  | 'computer'
  | 'default';

interface SubjectColor {
  bg: string;
  icon: string;
}

export const SUBJECT_COLORS: Record<SubjectKey, SubjectColor> = {
  mathematics: {bg: brand.violet100, icon: '#6D3BFF'},
  science: {bg: semantic.green100, icon: semantic.green600},
  english: {bg: semantic.blue100, icon: semantic.blue600},
  hindi: {bg: '#FDE4F0', icon: '#E8368F'},
  social_science: {bg: semantic.teal100, icon: semantic.teal600},
  physics: {bg: semantic.blue100, icon: semantic.blue600},
  chemistry: {bg: semantic.green100, icon: semantic.green600},
  biology: {bg: '#DCF7EA', icon: semantic.green600},
  history: {bg: semantic.orange100, icon: semantic.orange600},
  geography: {bg: semantic.teal100, icon: semantic.teal600},
  economics: {bg: semantic.gold100, icon: semantic.gold500},
  computer: {bg: semantic.blue100, icon: semantic.blue600},
  default: {bg: '#EDE6FF', icon: '#6D3BFF'},
};

function resolveSubjectKey(subjectName: string): SubjectKey {
  const lower = subjectName.toLowerCase().trim();
  if (lower.includes('math')) return 'mathematics';
  if (lower.includes('science') && !lower.includes('social')) return 'science';
  if (lower.includes('english')) return 'english';
  if (lower.includes('hindi')) return 'hindi';
  if (lower.includes('social')) return 'social_science';
  if (lower.includes('physics')) return 'physics';
  if (lower.includes('chemistry')) return 'chemistry';
  if (lower.includes('biology')) return 'biology';
  if (lower.includes('history')) return 'history';
  if (lower.includes('geo')) return 'geography';
  if (lower.includes('econ')) return 'economics';
  if (lower.includes('computer') || lower.includes('it')) return 'computer';
  return 'default';
}

interface ZKSubjectIconProps {
  subjectName: string;
  size?: number;
  style?: ViewStyle;
}

export function ZKSubjectIcon({subjectName, size = 52, style}: ZKSubjectIconProps) {
  const key = resolveSubjectKey(subjectName);
  const {bg, icon} = SUBJECT_COLORS[key];
  const iconSize = Math.round(size * 0.54);

  return (
    <View
      style={[
        styles.chip,
        {width: size, height: size, borderRadius: radius.chip + 2, backgroundColor: bg},
        style,
      ]}>
      <SubjectSvgIcon name={key} color={icon} size={iconSize} />
    </View>
  );
}

function SubjectSvgIcon({
  name,
  color,
  size,
}: {
  name: SubjectKey;
  color: string;
  size: number;
}) {
  const s = {stroke: color, strokeWidth: 2, fill: 'none' as const};
  switch (name) {
    case 'mathematics':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 5h14M5 12h14M5 19h8" {...s} strokeLinecap="round" />
          <Path d="M17.5 16.5l2 5M19.5 16.5l-2 5" {...s} strokeLinecap="round" />
        </Svg>
      );
    case 'science':
    case 'chemistry':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M9 3h6" {...s} strokeLinecap="round" />
          <Path
            d="M10 3v6L5.4 18.6A2 2 0 007.2 21.5h9.6a2 2 0 001.8-2.9L14 9V3"
            {...s}
          />
        </Svg>
      );
    case 'english':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2z" {...s} />
          <Path d="M8 3v18" {...s} strokeLinecap="round" />
        </Svg>
      );
    case 'hindi':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 7h16M4 12h16M4 17h10" {...s} strokeLinecap="round" />
        </Svg>
      );
    case 'social_science':
    case 'history':
    case 'geography':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={8} {...s} />
          <Path d="M4 12h16" {...s} strokeLinecap="round" />
          <Path
            d="M12 4c2.6 3.2 2.6 12.8 0 16-2.6-3.2-2.6-12.8 0-16z"
            {...s}
          />
        </Svg>
      );
    case 'physics':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={3} {...s} />
          <Path d="M12 3v2M12 19v2M3 12h2M19 12h2" {...s} strokeLinecap="round" />
          <Path
            d="M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"
            {...s}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'biology':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 5a4 4 0 00-4 4 3 3 0 000 6 3.5 3.5 0 004 3.4z"
            {...s}
          />
          <Path
            d="M12 5a4 4 0 014 4 3 3 0 010 6 3.5 3.5 0 01-4 3.4z"
            {...s}
          />
        </Svg>
      );
    case 'economics':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={8} {...s} />
          <Path d="M9.5 8.5h4a2 2 0 010 4h-4M9.5 12.5h3.2M9.5 16l3.5-3.5" {...s} strokeLinecap="round" />
        </Svg>
      );
    case 'computer':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" {...s} />
          <Path d="M8 19h8M12 17v2" {...s} strokeLinecap="round" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 2l2.4 7H22l-6.2 4.5 2.4 7L12 17l-6.2 3.5 2.4-7L2 9h7.6z" {...s} />
        </Svg>
      );
  }
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
