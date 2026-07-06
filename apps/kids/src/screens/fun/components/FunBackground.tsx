/**
 * Full-screen gradient backdrop for the fun-mode (grade <= 6) screens.
 * Render as the FIRST child of a flex:1 View; it absolutely fills the parent.
 *
 *   - purple:      the everyday Zumi look (home dashboard, voice session)
 *   - celebration: purple melting into pink (end-of-session "Shabaash!")
 */

import React from 'react';
import {StyleSheet} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

export type FunBackgroundVariant = 'purple' | 'celebration';

const STOPS: Record<FunBackgroundVariant, [string, string, string]> = {
  purple: ['#7c3aed', '#8b5cf6', '#a855f7'],
  celebration: ['#7c3aed', '#a855f7', '#ec4899'],
};

export function FunBackground({
  variant = 'purple',
}: {
  variant?: FunBackgroundVariant;
}) {
  const [top, mid, bottom] = STOPS[variant];
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`funBg-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="0.55" stopColor={mid} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#funBg-${variant})`} />
    </Svg>
  );
}
