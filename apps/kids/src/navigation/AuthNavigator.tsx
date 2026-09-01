import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {LoginScreen} from '../screens/auth/LoginScreen';
import {SignupScreen} from '../screens/auth/SignupScreen';
import {colors} from '../theme';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * ZKid auth flow. Role is hard-coded to 'child' -- the only person who should
 * be signing into ZKid is a kid pairing with their parent's ZConnect install.
 *
 * (The v1 three-option RoleSelector that offered "parent two-device",
 * "parent shared phone", and "child" was deleted in P1.6.1 along with the
 * rest of shared mode.)
 */
export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitle: '',
        contentStyle: {backgroundColor: colors.bg},
      }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        initialParams={{role: 'child'}}
      />
    </Stack.Navigator>
  );
}
