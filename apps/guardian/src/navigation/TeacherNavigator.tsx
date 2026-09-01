import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {TeacherHomeScreen} from '../screens/teacher/HomeScreen';
import {TeacherClassesScreen} from '../screens/teacher/ClassesScreen';
import {ClassDetailScreen} from '../screens/teacher/ClassDetailScreen';
import {TeacherAssignScreen} from '../screens/teacher/AssignScreen';
import {LiveQuizScreen} from '../screens/teacher/LiveQuizScreen';
import {DoneScreen} from '../screens/teacher/DoneScreen';
import {TeacherReportsScreen} from '../screens/teacher/ReportsScreen';
import {ClassReportScreen} from '../screens/teacher/ClassReportScreen';
import {ClassStudentListScreen} from '../screens/teacher/ClassStudentListScreen';
import {StudentsNeedingHelpScreen} from '../screens/teacher/StudentsNeedingHelpScreen';
import {StudentDetailScreen} from '../screens/teacher/StudentDetailScreen';
import {NotificationsScreen} from '../screens/teacher/NotificationsScreen';
import {TeacherMoreScreen} from '../screens/teacher/MoreScreen';
import {TeacherTabIcon} from '../screens/teacher/components/TeacherTabIcons';
import {cosmicColors} from '../screens/teacher/theme';
import type {TeacherStackParamList, TeacherTabsParamList} from './types';

const Tabs = createBottomTabNavigator<TeacherTabsParamList>();

function TeacherTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: cosmicColors.navBg,
          borderTopColor: cosmicColors.navBorder,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: cosmicColors.purpleSoft,
        tabBarInactiveTintColor: cosmicColors.textSubtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        sceneStyle: {backgroundColor: cosmicColors.bg} as any,
      }}>
      <Tabs.Screen
        name="TeacherHomeTab"
        component={TeacherHomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({focused}) => (
            <TeacherTabIcon name="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="TeacherClassesTab"
        component={TeacherClassesScreen}
        options={{
          tabBarLabel: 'Classes',
          tabBarIcon: ({focused}) => (
            <TeacherTabIcon name="classes" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="TeacherReportsTab"
        component={TeacherReportsScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({focused}) => (
            <TeacherTabIcon name="reports" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="TeacherMoreTab"
        component={TeacherMoreScreen}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({focused}) => (
            <TeacherTabIcon name="more" focused={focused} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}

const Stack = createNativeStackNavigator<TeacherStackParamList>();

export function TeacherNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: cosmicColors.bg},
      }}>
      <Stack.Screen name="TeacherTabs" component={TeacherTabs} />
      <Stack.Screen name="TeacherHome" component={TeacherHomeScreen} />
      <Stack.Screen name="TeacherClasses" component={TeacherClassesScreen} />
      <Stack.Screen name="TeacherClassDetail" component={ClassDetailScreen} />
      <Stack.Screen name="TeacherAssign" component={TeacherAssignScreen} />
      <Stack.Screen name="TeacherLiveQuiz" component={LiveQuizScreen} />
      <Stack.Screen name="TeacherDone" component={DoneScreen} />
      <Stack.Screen name="TeacherReports" component={TeacherReportsScreen} />
      <Stack.Screen name="TeacherClassReport" component={ClassReportScreen} />
      <Stack.Screen name="TeacherClassStudents" component={ClassStudentListScreen} />
      <Stack.Screen
        name="TeacherStudentsNeedingHelp"
        component={StudentsNeedingHelpScreen}
      />
      <Stack.Screen
        name="TeacherStudentDetail"
        component={StudentDetailScreen}
      />
      <Stack.Screen
        name="TeacherNotifications"
        component={NotificationsScreen}
      />
      <Stack.Screen name="TeacherMore" component={TeacherMoreScreen} />
    </Stack.Navigator>
  );
}
