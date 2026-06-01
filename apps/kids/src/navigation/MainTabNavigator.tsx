import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {StatusScreen} from '../screens/child/StatusScreen';
import {colors} from '../theme';
import type {MainTabParamList} from './types';
import {StudyNavigator} from './StudyNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabItem({emoji, label, focused}: {emoji: string; label: string; focused: boolean}) {
  const tint = focused ? colors.primary : colors.textMuted;
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIcon, {color: tint}]}>{emoji}</Text>
      <Text style={[styles.tabLabel, {color: tint}]}>{label}</Text>
      <View style={[styles.indicator, focused && styles.indicatorActive]} />
    </View>
  );
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}>
      <Tab.Screen
        name="HomeTab"
        component={StatusScreen}
        options={{
          tabBarIcon: ({focused}) => <TabItem emoji="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="StudyTab"
        component={StudyNavigator}
        options={{
          tabBarIcon: ({focused}) => <TabItem emoji="📖" label="Study" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 0,
    paddingTop: 6,
  },
  tabItem: {
    alignItems: 'center',
    gap: 2,
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  indicator: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  indicatorActive: {
    backgroundColor: colors.primary,
  },
});
