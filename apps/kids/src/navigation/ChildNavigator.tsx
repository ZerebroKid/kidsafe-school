import React, {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {PairingCodeScreen} from '../screens/auth/PairingCodeScreen';
import {PermissionsOnboardingScreen} from '../screens/child/PermissionsOnboardingScreen';
import {SchoolStep} from '../screens/child/onboarding/SchoolStep';
import {StatusScreen} from '../screens/child/StatusScreen';
import {
  AppBlocker,
  DeviceAdmin,
  ForegroundService,
  Location,
  ScreenTime,
} from '../modules/native';
import {useAuthStore} from '../state/authStore';
import {colors} from '../theme';
import type {ChildStackParamList} from './types';

const Stack = createNativeStackNavigator<ChildStackParamList>();

/**
 * Routes a child user through four linear states (post-P4.4):
 *   1. Not paired to a parent yet → Pairing
 *   2. Paired but not yet school-linked → SchoolStep (P4.4)
 *   3. School-linked but permissions missing → PermissionsOnboarding
 *   4. All good → Status
 *
 * The SchoolStep gate (`users.schoolIds` empty/missing) MUST come BEFORE
 * the permissions gate -- a child who hasn't joined a school yet has no
 * roster to drive their study mission, so forcing them through Android
 * permission grants first would just be friction.
 */
export function ChildNavigator() {
  const userDoc = useAuthStore(s => s.userDoc);
  const [allPermissionsGranted, setAll] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        // Device admin is part of the OEM-aware wizard now. We still tolerate it being denied
        // on stubborn OEM skins (Infinix, etc.) — the wizard's verification sheet lets the
        // user move past it — but if it *was* successfully granted, we want the navigator to
        // notice. The wizard never reaches its terminal "Finish" step (which starts the
        // foreground service) without resolving every step in some way, so gating on
        // ForegroundService.isRunning here is what really enforces "wizard completed".
        const [access, overlay, usage, running, fine] = await Promise.all([
          AppBlocker.isAccessibilityServiceEnabled().catch(() => false),
          AppBlocker.canDrawOverlays().catch(() => false),
          ScreenTime.hasUsageAccess().catch(() => false),
          ForegroundService.isRunning().catch(() => false),
          Location.hasLocationPermission().catch(() => false),
        ]);
        // Probe device admin to keep observability — we don't fail the gate on it because
        // some OEMs silently refuse activation, but knowing this is useful when debugging.
        DeviceAdmin.isActive().catch(() => false);
        if (!cancelled) {setAll(access && overlay && usage && running && fine);}
      } catch {
        if (!cancelled) {setAll(false);}
      }
    }

    check();
    // Re-check every few seconds while in onboarding so the nav flips to Status as soon as the
    // foreground service starts, without requiring the child to background + foreground the app.
    const interval = setInterval(check, 3000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {check();}
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [userDoc]);

  const screenOptions = {
    headerStyle: {backgroundColor: colors.bg},
    headerTintColor: colors.text,
    headerTitle: '',
    headerShadowVisible: false,
    contentStyle: {backgroundColor: colors.bg},
  };

  if (!userDoc?.parentUid) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="Pairing" component={PairingCodeScreen} />
      </Stack.Navigator>
    );
  }

  // P4.4 -- school-link gate. Paired but no schoolIds yet -> SchoolStep.
  // After `joinSchool` writes schoolIds + children/{uid}.classId, the
  // user-doc tick re-evaluates and drops us into the next gate.
  const hasJoinedSchool =
    Array.isArray(userDoc.schoolIds) && userDoc.schoolIds.length > 0;
  if (!hasJoinedSchool) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="SchoolStep" component={SchoolStep} />
      </Stack.Navigator>
    );
  }

  if (!allPermissionsGranted) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="PermissionsOnboarding" component={PermissionsOnboardingScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Status" component={StatusScreen} />
    </Stack.Navigator>
  );
}
