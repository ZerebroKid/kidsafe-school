import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {PhoneConfirmScreen} from '../screens/auth/PhoneConfirmScreen';
import {PhoneLoginScreen} from '../screens/auth/PhoneLoginScreen';
import {colors} from '../theme';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * ZConnect auth flow.
 *
 * P4.3 -- phone-OTP only (PhoneLogin -> PhoneConfirm).
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
    </Stack.Navigator>
  );
}
