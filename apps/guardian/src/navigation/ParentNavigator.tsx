import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {ChildrenTabIcon, SettingsTabIcon} from '../components/ParentTabIcons';
import {ChildDetailsScreen} from '../screens/parent/ChildDetailsScreen';
import {ChildrenListScreen} from '../screens/parent/ChildrenListScreen';
import {SettingsScreen} from '../screens/parent/SettingsScreen';
import {colors} from '../theme';
import type {ParentStackParamList, ParentTabsParamList} from './types';

const Tabs = createBottomTabNavigator<ParentTabsParamList>();

function ParentTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {fontSize: 12, fontWeight: '600'},
        sceneStyle: {backgroundColor: colors.bg} as any,
      }}>
      <Tabs.Screen
        name="Children"
        component={ChildrenListScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Children',
          tabBarIcon: ({color, size, focused}) => (
            <ChildrenTabIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Settings',
          tabBarIcon: ({color, size, focused}) => (
            <SettingsTabIcon color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}

const Stack = createNativeStackNavigator<ParentStackParamList>();

/**
 * ZConnect parent navigator -- two-device dashboard only.
 *
 * The v1 shared-mode branches (SharedProfileSetup, SharedPermissionsOnboarding)
 * and their useSharedPermissionGate hook + native-module imports were deleted in
 * P1.6.1. ZConnect now consumes zero native modules at runtime.
 */
export function ParentNavigator() {
  const screenOptions = {
    headerStyle: {backgroundColor: colors.bg},
    headerTintColor: colors.text,
    headerShadowVisible: false,
    contentStyle: {backgroundColor: colors.bg},
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ParentTabs" component={ParentTabs} options={{headerShown: false}} />
      <Stack.Screen
        name="ChildDetails"
        component={ChildDetailsScreen}
        options={({route}) => ({title: route.params.childName})}
      />
    </Stack.Navigator>
  );
}
