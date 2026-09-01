import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Defs, LinearGradient, RadialGradient, Rect, Stop} from 'react-native-svg';
import {useParentTheme} from '../../../state/themeStore';

interface ParentBackgroundProps {
  children?: React.ReactNode;
  applyTopInset?: boolean;
}

/**
 * Adaptive background for the Parent App supporting both Cosmic Night and Warm Day themes.
 */
export function ParentBackground({
  children,
  applyTopInset = true,
}: ParentBackgroundProps) {
  const insets = useSafeAreaInsets();
  const {theme, isDark} = useParentTheme();

  return (
    <View style={[styles.container, {backgroundColor: theme.bg}]}>
      <StatusBar
        barStyle={theme.statusBar}
        backgroundColor={theme.bg}
      />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {isDark ? (
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient
                id="parentPurpleGlow"
                cx="15%"
                cy="0%"
                r="65%"
                fx="15%"
                fy="0%">
                <Stop offset="0%" stopColor="#6D3FE7" stopOpacity="0.36" />
                <Stop offset="65%" stopColor="#6D3FE7" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient
                id="parentMagentaGlow"
                cx="90%"
                cy="80%"
                r="60%"
                fx="90%"
                fy="80%">
                <Stop offset="0%" stopColor="#E95CFF" stopOpacity="0.25" />
                <Stop offset="70%" stopColor="#E95CFF" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={theme.surface} />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#parentPurpleGlow)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#parentMagentaGlow)" />
          </Svg>
        ) : (
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="dayWarmGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFF7F9" stopOpacity="1" />
                <Stop offset="35%" stopColor="#FAF5F3" stopOpacity="1" />
                <Stop offset="100%" stopColor="#F2EDEA" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#dayWarmGradient)" />
          </Svg>
        )}

        {/* Stars for Cosmic mode only */}
        {isDark ? (
          <>
            <View style={[styles.star, {top: 120, right: 38, width: 5, height: 5, opacity: 0.75}]} />
            <View style={[styles.star, {top: 260, left: 36, width: 4, height: 4, backgroundColor: '#35D9FF', opacity: 0.8}]} />
            <View style={[styles.star, {bottom: 220, left: 90, width: 3, height: 3, opacity: 0.5}]} />
            <View style={[styles.star, {top: 400, right: 70, width: 3.5, height: 3.5, opacity: 0.6}]} />
          </>
        ) : null}
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
