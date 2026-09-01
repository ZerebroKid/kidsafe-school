import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Line, Path} from 'react-native-svg';
import {cosmicColors} from '../theme';

interface TabIconProps {
  name: 'home' | 'classes' | 'reports' | 'more';
  focused: boolean;
}

export function TeacherTabIcon({name, focused}: TabIconProps) {
  const color = focused ? cosmicColors.purpleSoft : cosmicColors.textSubtle;

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
              fill={focused ? 'rgba(139, 92, 246, 0.28)' : 'none'}
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
      case 'classes':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={focused ? 'rgba(139, 92, 246, 0.28)' : 'none'}
            />
            <Line
              x1="9"
              y1="7"
              x2="15"
              y2="7"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
            />
            <Line
              x1="9"
              y1="11"
              x2="15"
              y2="11"
              stroke={color}
              strokeWidth={focused ? 2.3 : 2}
              strokeLinecap="round"
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
              fill={focused ? 'rgba(139, 92, 246, 0.28)' : 'none'}
            />
          </Svg>
        );
      case 'more':
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
    <View style={[styles.container, focused && styles.focusedContainer]}>
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
  focusedContainer: {
    backgroundColor: 'rgba(139, 92, 246, 0.28)',
    shadowColor: cosmicColors.purple,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
});
