import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {StudyMissionScreen} from '../screens/learn/StudyMissionScreen';
import {TopicScreen} from '../screens/learn/TopicScreen';
import {ZumiHomeScreen} from '../screens/fun/ZumiHomeScreen';
import {ZumiVoiceScreen} from '../screens/fun/ZumiVoiceScreen';
import {QuizScreen} from '../screens/learn/QuizScreen';
import {QuizResultScreen} from '../screens/learn/QuizResultScreen';
import {RewardUnlockScreen} from '../screens/learn/RewardUnlockScreen';
import {RewardWebViewScreen} from '../screens/learn/RewardWebViewScreen';
import {VideoPlayerScreen} from '../screens/learn/VideoPlayerScreen';
import {ReelsScreen} from '../screens/reels/ReelsScreen';
import {useChildProfile} from '../context/ChildProfileContext';
import {colors} from '../theme';
import type {StudyStackParamList} from './types';

const Stack = createNativeStackNavigator<StudyStackParamList>();

export function StudyNavigator() {
  // Fun-mode kids (grade <= 6) land straight on Zumi the character; everyone
  // else keeps the standard Study Mission list as the stack's entry point.
  const {isFunMode} = useChildProfile();

  return (
    <Stack.Navigator
      initialRouteName={isFunMode ? 'ZumiHome' : 'StudyMission'}
      screenOptions={{
        headerStyle: {backgroundColor: colors.bg},
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: {backgroundColor: colors.bg},
      }}>
      <Stack.Screen
        name="ZumiHome"
        component={ZumiHomeScreen}
        options={{headerShown: false}}
      />
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
        name="ZumiVoice"
        component={ZumiVoiceScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Quiz"
        component={QuizScreen}
        options={{headerTitle: 'Quiz'}}
      />
      <Stack.Screen
        name="QuizResult"
        component={QuizResultScreen}
        options={{headerTitle: 'Results', headerBackVisible: false}}
      />
      <Stack.Screen
        name="RewardUnlock"
        component={RewardUnlockScreen}
        options={{headerTitle: 'Reward', headerBackVisible: false}}
      />
      <Stack.Screen
        name="RewardWebView"
        component={RewardWebViewScreen}
        options={({route}) => ({
          headerTitle: route.params.title ?? 'Reward',
        })}
      />
      <Stack.Screen
        name="VideoPlayer"
        component={VideoPlayerScreen}
        options={({route}) => ({
          headerTitle: route.params.title ?? 'Video',
        })}
      />
      <Stack.Screen
        name="Reels"
        component={ReelsScreen}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
}
