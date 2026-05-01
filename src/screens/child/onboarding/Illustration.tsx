import React from 'react';
import {View, StyleSheet} from 'react-native';
import Svg, {Circle, Path, Rect, G} from 'react-native-svg';

import {colors} from '../../../theme';

export type IllustrationName =
  | 'welcome'
  | 'notifications'
  | 'location'
  | 'contacts'
  | 'usage'
  | 'overlay'
  | 'accessibility'
  | 'autostart'
  | 'battery'
  | 'shield'
  | 'celebrate';

interface Props {
  name: IllustrationName;
  size?: number;
}

/**
 * Lightweight react-native-svg placeholders so the wizard works without bundled mascot art.
 * Each illustration is built from primitive shapes — no external assets, theme-aware colors.
 * Swap to PNG/Lottie later by importing assets and changing the `Illustration` consumers.
 */
export function Illustration({name, size = 180}: Props) {
  return (
    <View style={[styles.wrap, {width: size, height: size}]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {render(name)}
      </Svg>
    </View>
  );
}

function render(name: IllustrationName) {
  switch (name) {
    case 'welcome':
      return (
        <G>
          <Circle cx={100} cy={100} r={80} fill={colors.primary} opacity={0.15} />
          <Rect x={68} y={50} width={64} height={110} rx={14} fill={colors.primary} />
          <Rect x={76} y={62} width={48} height={70} rx={4} fill={colors.bg} />
          <Circle cx={100} cy={148} r={5} fill={colors.bg} />
        </G>
      );
    case 'notifications':
      return (
        <G>
          <Path
            d="M100 40 C70 40 60 70 60 100 L52 130 L148 130 L140 100 C140 70 130 40 100 40 Z"
            fill={colors.primary}
          />
          <Circle cx={100} cy={148} r={10} fill={colors.primary} />
          <Circle cx={140} cy={50} r={14} fill={colors.danger} />
          <Path
            d="M134 50 H146 M140 44 V56"
            stroke={colors.text}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </G>
      );
    case 'location':
      return (
        <G>
          <Path
            d="M100 30 C70 30 50 50 50 80 C50 120 100 170 100 170 C100 170 150 120 150 80 C150 50 130 30 100 30 Z"
            fill={colors.primary}
          />
          <Circle cx={100} cy={80} r={20} fill={colors.bg} />
        </G>
      );
    case 'contacts':
      return (
        <G>
          <Circle cx={100} cy={70} r={28} fill={colors.primary} />
          <Path
            d="M50 160 C50 130 70 110 100 110 C130 110 150 130 150 160 Z"
            fill={colors.primary}
          />
        </G>
      );
    case 'usage':
      return (
        <G>
          <Circle cx={100} cy={100} r={70} fill={colors.surface} />
          <Circle
            cx={100}
            cy={100}
            r={70}
            fill="none"
            stroke={colors.primary}
            strokeWidth={12}
            strokeDasharray="220 220"
            strokeDashoffset={55}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
          />
          <Path
            d="M100 60 V100 L130 115"
            stroke={colors.text}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    case 'overlay':
      return (
        <G>
          <Rect x={40} y={50} width={100} height={120} rx={10} fill={colors.surface} />
          <Rect x={70} y={30} width={100} height={120} rx={10} fill={colors.primary} opacity={0.85} />
          <Circle cx={120} cy={80} r={6} fill={colors.text} />
          <Circle cx={120} cy={110} r={6} fill={colors.text} />
          <Circle cx={120} cy={140} r={6} fill={colors.text} />
        </G>
      );
    case 'accessibility':
      return (
        <G>
          <Circle cx={100} cy={100} r={75} fill={colors.primary} opacity={0.15} />
          <Circle cx={100} cy={60} r={14} fill={colors.primary} />
          <Path
            d="M60 90 H140"
            stroke={colors.primary}
            strokeWidth={8}
            strokeLinecap="round"
          />
          <Path
            d="M85 90 V130 L75 170 M115 90 V130 L125 170"
            stroke={colors.primary}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    case 'autostart':
      return (
        <G>
          <Circle cx={100} cy={100} r={70} fill={colors.surface} />
          <Path
            d="M85 70 L130 100 L85 130 Z"
            fill={colors.primary}
          />
        </G>
      );
    case 'battery':
      return (
        <G>
          <Rect x={40} y={70} width={110} height={60} rx={10} fill="none" stroke={colors.primary} strokeWidth={6} />
          <Rect x={150} y={88} width={12} height={24} rx={3} fill={colors.primary} />
          <Rect x={48} y={78} width={70} height={44} rx={4} fill={colors.success} />
          <Path
            d="M88 80 L78 102 H92 L82 122"
            stroke={colors.bg}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      );
    case 'shield':
      return (
        <G>
          <Path
            d="M100 30 L160 55 V105 C160 140 130 165 100 175 C70 165 40 140 40 105 V55 Z"
            fill={colors.primary}
          />
          <Path
            d="M75 100 L92 117 L130 80"
            stroke={colors.bg}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      );
    case 'celebrate':
      return (
        <G>
          <Circle cx={100} cy={100} r={70} fill={colors.success} opacity={0.18} />
          <Circle cx={100} cy={100} r={50} fill={colors.success} />
          <Path
            d="M75 100 L92 117 L130 80"
            stroke={colors.text}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      );
  }
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
