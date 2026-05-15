import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

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
        tabBarStyle: {backgroundColor: colors.surface, borderTopColor: colors.border},
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: {backgroundColor: colors.bg} as any,
      }}>
      <Tabs.Screen name="Children" component={ChildrenListScreen} options={{headerShown: false}} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{headerShown: false}} />
    </Tabs.Navigator>
  );
}

const Stack = createNativeStackNavigator<ParentStackParamList>();

export function ParentNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: {backgroundColor: colors.bg},
      }}>
      <Stack.Screen name="ParentTabs" component={ParentTabs} options={{headerShown: false}} />
      <Stack.Screen
        name="ChildDetails"
        component={ChildDetailsScreen}
        options={({route}) => ({title: route.params.childName})}
      />
    </Stack.Navigator>
  );
}
