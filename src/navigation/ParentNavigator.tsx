import React, {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {ChildDetailsScreen} from '../screens/parent/ChildDetailsScreen';
import {ChildrenListScreen} from '../screens/parent/ChildrenListScreen';
import {SettingsScreen} from '../screens/parent/SettingsScreen';
import {SharedPermissionsOnboardingScreen} from '../screens/parent/SharedPermissionsOnboardingScreen';
import {SharedProfileSetupScreen} from '../screens/auth/SharedProfileSetupScreen';
import {
  AppBlocker,
  ForegroundService,
  Location,
  ScreenTime,
} from '../modules/native';
import {useAuthStore} from '../state/authStore';
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

/**
 * Polls the same permission set the `ChildNavigator` checks, but only on shared-phone
 * installs. Returns `null` while we don't know yet (avoids a flash from "wizard" → "tabs"
 * when the parent's permissions are already granted), then `true` / `false` once we do.
 *
 * We never run this poll for two-device parents — they don't need any of these permissions
 * on their own phone, and polling would just burn battery for no UI benefit.
 */
function useSharedPermissionGate(enabled: boolean): boolean | null {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) {
      setGranted(null);
      return;
    }
    let cancelled = false;
    async function check() {
      try {
        const [access, overlay, usage, running, fine] = await Promise.all([
          AppBlocker.isAccessibilityServiceEnabled().catch(() => false),
          AppBlocker.canDrawOverlays().catch(() => false),
          ScreenTime.hasUsageAccess().catch(() => false),
          ForegroundService.isRunning().catch(() => false),
          Location.hasLocationPermission().catch(() => false),
        ]);
        if (!cancelled) {setGranted(access && overlay && usage && running && fine);}
      } catch {
        if (!cancelled) {setGranted(false);}
      }
    }
    check();
    const interval = setInterval(check, 3000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {check();}
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled]);
  return granted;
}

const Stack = createNativeStackNavigator<ParentStackParamList>();

/**
 * Parent navigator with three routing branches:
 *
 *   1. `deviceMode === 'shared'` + no `sharedProfile` yet
 *        → SharedProfileSetupScreen (one-time name entry, creates the child doc).
 *   2. `deviceMode === 'shared'` + has sharedProfile + permissions NOT all granted
 *        → SharedPermissionsOnboardingScreen (reuses the OEM-aware wizard).
 *   3. Otherwise (default two-device flow, or shared with everything ready)
 *        → ParentTabs (the dashboard).
 *
 * Child Mode (the kiosk) is gated higher up in `RootNavigator` — by the time we get here,
 * we already know Child Mode is OFF.
 */
export function ParentNavigator() {
  const userDoc = useAuthStore(s => s.userDoc);
  const isShared = userDoc?.deviceMode === 'shared';
  const hasSharedProfile = !!userDoc?.sharedProfile;
  const permissionsGranted = useSharedPermissionGate(isShared && hasSharedProfile);

  const screenOptions = {
    headerStyle: {backgroundColor: colors.bg},
    headerTintColor: colors.text,
    headerShadowVisible: false,
    contentStyle: {backgroundColor: colors.bg},
  };

  // Branch 1: shared mode, profile not set up yet.
  if (isShared && !hasSharedProfile) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="SharedProfileSetup"
          component={SharedProfileSetupScreen}
          options={{headerShown: false}}
        />
      </Stack.Navigator>
    );
  }

  // Branch 2: shared mode, profile exists but permissions still missing.
  if (isShared && hasSharedProfile && permissionsGranted === false) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="SharedPermissionsOnboarding"
          component={SharedPermissionsOnboardingScreen}
          options={{headerShown: false}}
        />
      </Stack.Navigator>
    );
  }

  // Branch 3: dashboard. Also where shared-mode parents land while `permissionsGranted` is
  // still `null` (loading) — the regular dashboard is a safe fallback and the wizard will
  // re-appear automatically if the audit fails.
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
