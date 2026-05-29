import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {StatusScreen} from '../screens/child/StatusScreen';
import {colors} from '../theme';
import type {MainTabParamList} from './types';
import {StudyNavigator} from './StudyNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tab.Screen
        name="HomeTab"
        component={StatusScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({color}) => (
            <Text style={[styles.tabIcon, {color}]}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="StudyTab"
        component={StudyNavigator}
        options={{
          tabBarLabel: 'Study',
          tabBarIcon: ({color}) => (
            <Text style={[styles.tabIcon, {color}]}>📖</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 20,
  },
});
