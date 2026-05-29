import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {TeacherHomeScreen} from '../screens/teacher/HomeScreen';
import {TeacherAssignScreen} from '../screens/teacher/AssignScreen';
import {ClassReportScreen} from '../screens/teacher/ClassReportScreen';
import {ClassStudentListScreen} from '../screens/teacher/ClassStudentListScreen';
import type {TeacherStackParamList} from './types';

const Stack = createNativeStackNavigator<TeacherStackParamList>();

/**
 * P4.5 -- ZConnect teacher mode root navigator.
 *
 * Mounted by `RootNavigator` when `userDoc.primaryRole === 'teacher'`.
 * Two screens for the MVP -- the assign flow + the home (today's
 * assignments list). Class report (P4.11) will land as a third screen.
 *
 * Header styling matches the parent navigator (dark theme + back arrow
 * provided by the native header). We do NOT hide the header here so
 * `TeacherAssignScreen` gets a native back arrow without us wiring a
 * custom one.
 */
export function TeacherNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TeacherHome"
        component={TeacherHomeScreen}
        options={{title: 'Today'}}
      />
      <Stack.Screen
        name="TeacherAssign"
        component={TeacherAssignScreen}
        options={{title: 'Assign a topic'}}
      />
      <Stack.Screen
        name="TeacherClassReport"
        component={ClassReportScreen}
        options={{title: 'Class report'}}
      />
      <Stack.Screen
        name="TeacherClassStudents"
        component={ClassStudentListScreen}
        options={{title: 'Students'}}
      />
    </Stack.Navigator>
  );
}
