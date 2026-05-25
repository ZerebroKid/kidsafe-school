import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {LoginScreen} from '../screens/auth/LoginScreen';
import {SignupScreen} from '../screens/auth/SignupScreen';
import {colors} from '../theme';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * ZConnect auth flow. There's no role picker -- this is the parent + teacher
 * app, role is hard-coded to 'parent'. The "Sign in" / "Sign up" toggle lives
 * inside SignupScreen itself.
 *
 * (The v1 three-option RoleSelector that offered "parent two-device",
 * "parent shared phone", and "child" was deleted in P1.6.1 along with the
 * rest of shared mode.)
 */
export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Signup"
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitle: '',
        contentStyle: {backgroundColor: colors.bg},
      }}>
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        initialParams={{role: 'parent'}}
      />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
