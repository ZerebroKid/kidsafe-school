import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {LoginScreen} from '../screens/auth/LoginScreen';
import {RoleSelectorScreen} from '../screens/auth/RoleSelectorScreen';
import {SignupScreen} from '../screens/auth/SignupScreen';
import {colors} from '../theme';
import type {AuthStackParamList} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitle: '',
        contentStyle: {backgroundColor: colors.bg},
      }}>
      <Stack.Screen
        name="RoleSelector"
        component={RoleSelectorScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
