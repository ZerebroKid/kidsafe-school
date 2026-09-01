import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Line, Path} from 'react-native-svg';
import {useParentTheme} from '../../../state/themeStore';

interface TabIconProps {
  name: 'home' | 'controls' | 'reports' | 'settings';
  focused: boolean;
}

export function ParentTabIcon({name, focused}: TabIconProps) {
  const {theme, isDark} = useParentTheme();

  const color = focused
    ? isDark
      ? '#E4DEFF'
      : theme.primary
    : isDark
    ? '#8B84C8'
    : theme.textSubtle;

  function renderIcon() {
    switch (name) {
      case 'home':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={focused && isDark ? 'rgba(109, 63, 231, 0.3)' : 'none'}
            />
            <Path
              d="M9 22V12h6v10"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      case 'controls':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Circle
              cx="12"
              cy="12"
              r="3.5"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              fill={focused && isDark ? 'rgba(109, 63, 231, 0.3)' : 'none'}
            />
            <Path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      case 'reports':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21.21 15.89A10 10 0 1 1 8 2.83"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M22 12A10 10 0 0 0 12 2v10z"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={focused && isDark ? 'rgba(109, 63, 231, 0.3)' : 'none'}
            />
          </Svg>
        );
      case 'settings':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Line
              x1="4"
              y1="21"
              x2="4"
              y2="14"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="4"
              y1="10"
              x2="4"
              y2="3"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="12"
              y1="21"
              x2="12"
              y2="12"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="12"
              y1="8"
              x2="12"
              y2="3"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="20"
              y1="21"
              x2="20"
              y2="16"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="20"
              y1="12"
              x2="20"
              y2="3"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="1"
              y1="14"
              x2="7"
              y2="14"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="9"
              y1="8"
              x2="15"
              y2="8"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="17"
              y1="16"
              x2="23"
              y2="16"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
          </Svg>
        );
    }
  }

  return (
    <View
      style={[
        styles.container,
        focused && {
          backgroundColor: isDark
            ? 'rgba(109, 63, 231, 0.25)'
            : 'rgba(225, 29, 83, 0.12)',
          shadowColor: isDark ? theme.primary : '#E11D53',
          shadowOpacity: isDark ? 0.6 : 0.2,
          shadowRadius: 10,
          elevation: 3,
        },
      ]}>
      {renderIcon()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
