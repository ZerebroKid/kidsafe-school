import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {ChildModeEndedScreen} from '../screens/shared/ChildModeEndedScreen';
import {ChildModeScreen} from '../screens/shared/ChildModeScreen';
import {ExitPinScreen} from '../screens/shared/ExitPinScreen';
import {ForgotPinScreen} from '../screens/shared/ForgotPinScreen';
import {colors} from '../theme';
import type {ChildModeStackParamList} from './types';

const Stack = createNativeStackNavigator<ChildModeStackParamList>();

/**
 * Locked kiosk navigator for shared-phone "Child Mode" sessions.
 *
 * Rooted at `ChildModeScreen` so even if the child navigates away (ExitPin → cancel,
 * ForgotPin → back) they always land back on the kiosk home. `gestureEnabled: false`
 * means no swipe-back from any screen — the only way out of the kiosk is correct PIN
 * entry, password reset, or uninstall of KidSafe (which itself is PIN-gated by the
 * tamper service).
 *
 * `RootNavigator` is the gate that decides this navigator runs at all (only when
 * `deviceMode === 'shared'` AND native `ChildMode.isActive()`).
 */
export function ChildModeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: {backgroundColor: colors.bg},
        gestureEnabled: false,
        animation: 'fade',
      }}>
      <Stack.Screen
        name="ChildMode"
        component={ChildModeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ExitPin"
        component={ExitPinScreen}
        options={{title: 'Exit Child Mode'}}
      />
      <Stack.Screen
        name="ForgotPin"
        component={ForgotPinScreen}
        options={{title: 'Reset parent PIN'}}
      />
      <Stack.Screen
        name="ChildModeEnded"
        component={ChildModeEndedScreen}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
}
