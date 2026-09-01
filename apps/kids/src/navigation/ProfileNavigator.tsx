/**
 * ProfileNavigator — Stack navigator for Profile tab (Class 6–12).
 *
 * Contains:
 *  - ProfileHome (ProfileScreen612)
 *  - Settings (SettingsScreen)
 *  - ChooseWorld (ChooseWorldScreen)
 *  - FocusMode (FocusModeScreen)
 *  - ExamPredictor (ExamPredictorScreen)
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ProfileScreen612} from '../screens/profile/ProfileScreen612';
import {SettingsScreen} from '../screens/profile/SettingsScreen';
import {ChooseWorldScreen} from '../screens/theme/ChooseWorldScreen';
import {FocusModeScreen} from '../screens/focus/FocusModeScreen';
import {ExamPredictorScreen} from '../screens/predictor/ExamPredictorScreen';
import type {ProfileStackParamList} from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false, animation: 'slide_from_right'}}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen612} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ChooseWorld" component={ChooseWorldScreen} />
      <Stack.Screen name="FocusMode" component={FocusModeScreen} />
      <Stack.Screen name="ExamPredictor" component={ExamPredictorScreen} />
    </Stack.Navigator>
  );
}
