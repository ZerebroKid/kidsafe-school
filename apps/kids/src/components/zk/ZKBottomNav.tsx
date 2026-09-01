/**
 * ZKBottomNav — 5-tab bottom navigation bar for Class 6–12 mode.
 *
 * Design: Home · Study · Quiz · Rewards · Profile
 * Active tab shows top-indicator bar + active icon + label.
 * Inactive: muted icon + label.
 *
 * This is a custom `tabBar` component passed to the Bottom Tab Navigator.
 * Theme-aware: dark themes use #120C24 bg + theme accent; classic uses white + violet.
 */

import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import {brand, fonts, neutral, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';

type TabName = 'HomeTab612' | 'StudyTab' | 'QuizTab' | 'RewardsTab' | 'ProfileTab';

interface TabConfig {
  name: TabName;
  label: string;
}

const TABS: TabConfig[] = [
  {name: 'HomeTab612', label: 'Home'},
  {name: 'StudyTab', label: 'Study'},
  {name: 'QuizTab', label: 'Quiz'},
  {name: 'RewardsTab', label: 'Rewards'},
  {name: 'ProfileTab', label: 'Profile'},
];

function TabIcon({name, color}: {name: TabName; color: string}) {
  const s = {stroke: color, strokeWidth: 2, fill: 'none' as const};
  const sl = {strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  switch (name) {
    case 'HomeTab612':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" {...s} {...sl} />
        </Svg>
      );
    case 'StudyTab':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2z" {...s} {...sl} />
          <Path d="M8 3v18" {...s} {...sl} />
        </Svg>
      );
    case 'QuizTab':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M5 4h11l3 3v13H5z" {...s} {...sl} />
          <Path d="M9 10.5l2 2 4-4.5M9 17h6" {...s} {...sl} />
        </Svg>
      );
    case 'RewardsTab':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Rect x={3} y={8} width={18} height={13} rx={2} {...s} {...sl} />
          <Path d="M3 12.5h18M12 8v13" {...s} {...sl} />
          <Path
            d="M12 8C9.8 8 7 7.2 7 5.6 7 4.2 9.4 3.4 12 8c2.6-4.6 5-3.8 5-2.4C17 7.2 14.2 8 12 8z"
            {...s}
            {...sl}
          />
        </Svg>
      );
    case 'ProfileTab':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={8} r={4} {...s} {...sl} />
          <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" {...s} {...sl} />
        </Svg>
      );
  }
}

export function ZKBottomNav({state, descriptors, navigation}: any) {
  const {theme} = useTheme();
  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options;

  if (focusedOptions?.tabBarStyle?.display === 'none') {
    return null;
  }

  const isDark = theme.colors.isDark;
  const barBg = isDark ? theme.colors.navBg : neutral.surface;
  const barBorder = isDark ? theme.colors.border : neutral.line200;
  const activeColor = theme.colors.navActive;
  const inactiveColor = isDark ? theme.colors.navInactive : neutral.ink300;

  return (
    <SafeAreaView edges={['bottom']} style={{backgroundColor: barBg}}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: barBg,
            borderTopColor: barBorder,
          },
        ]}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const tabConfig = TABS.find(t => t.name === route.name);
          if (!tabConfig) return null;

          const color = isFocused ? activeColor : inactiveColor;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={isFocused ? {selected: true} : {}}
              accessibilityLabel={tabConfig.label}
              style={styles.tab}>
              {isFocused && (
                <View style={[styles.indicator, {backgroundColor: activeColor}]} />
              )}
              <TabIcon name={tabConfig.name as TabName} color={color} />
              <Text style={[styles.label, {color}]}>{tabConfig.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    height: spacing.bottomNav,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    height: 4,
    borderRadius: spacing.bottomNav,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    fontSize: 11,
  },
});
