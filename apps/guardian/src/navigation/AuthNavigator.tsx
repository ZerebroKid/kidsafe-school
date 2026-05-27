import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {LoginScreen} from '../screens/auth/LoginScreen';
import {PhoneConfirmScreen} from '../screens/auth/PhoneConfirmScreen';
import {PhoneLoginScreen} from '../screens/auth/PhoneLoginScreen';
import {SignupScreen} from '../screens/auth/SignupScreen';
import {colors} from '../theme';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * ZConnect auth flow.
 *
 * P4.3 -- default entry is phone-OTP (PhoneLogin -> PhoneConfirm). The
 * email/password Login + Signup screens stay reachable as "Continue with
 * email" so existing accounts and our test rigs aren't locked out during
 * the cutover; planned for removal in a Phase 5 cleanup once 100% of
 * accounts have been migrated to phone-OTP.
 *
 * Role selection (parent vs teacher) is NOT done on this stack -- a brand
 * new phone-OTP signup lands with `users/{uid}.roles=[]` and RootNavigator
 * hands them off to RoleOnboardingGate (the intent picker) on the next
 * snapshot tick. See packages/shared-firebase/src/auth.ts normaliseUserDoc
 * for the gate predicate.
 */
export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PhoneLogin"
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitle: '',
        contentStyle: {backgroundColor: colors.bg},
      }}>
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="PhoneConfirm" component={PhoneConfirmScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        initialParams={{role: 'parent'}}
      />
    </Stack.Navigator>
  );
}
