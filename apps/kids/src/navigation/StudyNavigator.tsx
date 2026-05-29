import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {StudyMissionScreen} from '../screens/learn/StudyMissionScreen';
import {TopicScreen} from '../screens/learn/TopicScreen';
import {QuizScreen} from '../screens/learn/QuizScreen';
import {VideoPlayerScreen} from '../screens/learn/VideoPlayerScreen';
import {colors} from '../theme';
import type {StudyStackParamList} from './types';

const Stack = createNativeStackNavigator<StudyStackParamList>();

export function StudyNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: {backgroundColor: colors.bg},
      }}>
      <Stack.Screen
        name="StudyMission"
        component={StudyMissionScreen}
        options={{headerTitle: 'Study Mission'}}
      />
      <Stack.Screen
        name="TopicLearn"
        component={TopicScreen}
        options={({route}) => ({headerTitle: route.params.topicName})}
      />
      <Stack.Screen
        name="Quiz"
        component={QuizScreen}
        options={{headerTitle: 'Quiz'}}
      />
      <Stack.Screen
        name="VideoPlayer"
        component={VideoPlayerScreen}
        options={({route}) => ({
          headerTitle: route.params.title ?? 'Video',
        })}
      />
    </Stack.Navigator>
  );
}
