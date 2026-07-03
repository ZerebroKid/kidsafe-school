import React from 'react';
import {StyleSheet} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {gradients} from '../theme';

/**
 * Soft blue-to-mint wash behind full screens. SVG because RN has no CSS gradients and we
 * deliberately avoid adding react-native-linear-gradient (native dep → Gradle rebuild).
 * Absolutely positioned so it also paints under SafeAreaView insets.
 */
export function GradientBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="screenBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gradients.screen.from} />
          <Stop offset="0.45" stopColor={gradients.screen.mid} />
          <Stop offset="1" stopColor={gradients.screen.to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#screenBg)" />
    </Svg>
  );
}
