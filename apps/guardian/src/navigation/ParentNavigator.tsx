import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {useParentTheme} from '../state/themeStore';
import {ParentTabIcon} from '../screens/parent/components/ParentTabIcons';
import {ChildrenListScreen} from '../screens/parent/ChildrenListScreen';
import {ControlsScreen} from '../screens/parent/ControlsScreen';
import {ReportsScreen} from '../screens/parent/ReportsScreen';
import {SettingsScreen} from '../screens/parent/SettingsScreen';
import {ChildDetailsScreen} from '../screens/parent/ChildDetailsScreen';
import {JoinSchoolScreen} from '../screens/parent/JoinSchoolScreen';
import type {ParentStackParamList, ParentTabsParamList} from './types';

const Tabs = createBottomTabNavigator<ParentTabsParamList>();

function ParentTabs() {
  const {theme, isDark} = useParentTheme();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.navBg,
          borderTopColor: theme.navBorder,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
          elevation: isDark ? 0 : 8,
          shadowColor: isDark ? '#000000' : '#000000',
          shadowOffset: {width: 0, height: -2},
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: isDark ? '#FFFFFF' : theme.primary,
        tabBarInactiveTintColor: theme.textSubtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        sceneStyle: {backgroundColor: theme.bg} as any,
      }}>
      <Tabs.Screen
        name="ParentHomeTab"
        component={ChildrenListScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({focused}) => (
            <ParentTabIcon name="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ParentControlsTab"
        component={ControlsScreen}
        options={{
          tabBarLabel: 'Controls',
          tabBarIcon: ({focused}) => (
            <ParentTabIcon name="controls" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ParentReportsTab"
        component={ReportsScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({focused}) => (
            <ParentTabIcon name="reports" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ParentSettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({focused}) => (
            <ParentTabIcon name="settings" focused={focused} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}

const Stack = createNativeStackNavigator<ParentStackParamList>();

function ScheduleScreenWrapper({route, navigation}: any) {
  const childUid = route?.params?.childUid;
  const childName = route?.params?.childName ?? 'Child';
  return (
    <ChildDetailsScreen
      route={{key: 'Schedule', name: 'ChildDetails', params: {childUid, childName, initialTab: 'schedule'}}}
      navigation={navigation}
    />
  );
}

function AppsScreenWrapper({route, navigation}: any) {
  const childUid = route?.params?.childUid;
  const childName = route?.params?.childName ?? 'Child';
  return (
    <ChildDetailsScreen
      route={{key: 'Apps', name: 'ChildDetails', params: {childUid, childName, initialTab: 'apps'}}}
      navigation={navigation}
    />
  );
}

function LocationScreenWrapper({route, navigation}: any) {
  const childUid = route?.params?.childUid;
  const childName = route?.params?.childName ?? 'Child';
  return (
    <ChildDetailsScreen
      route={{key: 'Location', name: 'ChildDetails', params: {childUid, childName, initialTab: 'location'}}}
      navigation={navigation}
    />
  );
}

function ReelsScreenWrapper({route, navigation}: any) {
  const childUid = route?.params?.childUid;
  const childName = route?.params?.childName ?? 'Child';
  return (
    <ChildDetailsScreen
      route={{key: 'Reels', name: 'ChildDetails', params: {childUid, childName, initialTab: 'reels'}}}
      navigation={navigation}
    />
  );
}

function StudyScreenWrapper({route, navigation}: any) {
  const childUid = route?.params?.childUid;
  const childName = route?.params?.childName ?? 'Child';
  return (
    <ChildDetailsScreen
      route={{key: 'Study', name: 'ChildDetails', params: {childUid, childName, initialTab: 'study'}}}
      navigation={navigation}
    />
  );
}

function PinScreenWrapper({route, navigation}: any) {
  const childUid = route?.params?.childUid;
  const childName = route?.params?.childName ?? 'Child';
  return (
    <ChildDetailsScreen
      route={{key: 'Pin', name: 'ChildDetails', params: {childUid, childName, initialTab: 'pin'}}}
      navigation={navigation}
    />
  );
}

export function ParentNavigator() {
  const {theme} = useParentTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: theme.bg},
      }}>
      <Stack.Screen name="ParentTabs" component={ParentTabs} />
      <Stack.Screen name="ChildDetails" component={ChildDetailsScreen} />
      <Stack.Screen name="JoinSchool" component={JoinSchoolScreen} />
      <Stack.Screen name="Controls" component={ControlsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreenWrapper} />
      <Stack.Screen name="Apps" component={AppsScreenWrapper} />
      <Stack.Screen name="Location" component={LocationScreenWrapper} />
      <Stack.Screen name="ReelsInsights" component={ReelsScreenWrapper} />
      <Stack.Screen name="Study" component={StudyScreenWrapper} />
      <Stack.Screen name="Pin" component={PinScreenWrapper} />
    </Stack.Navigator>
  );
}
