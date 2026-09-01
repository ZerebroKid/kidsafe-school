/**
 * StudyNavigator — Stack navigator for the Study tab.
 *
 * Initial screen selection:
 *  - isFunMode (grade ≤ 6): ZumiHome (unchanged)
 *  - !isFunMode (grade 7+): SubjectList (new Class 6–12 design)
 *
 * All existing screens (StudyMission, TopicLearn, ZumiVoice, Quiz,
 * QuizResult, RewardUnlock, RewardWebView, VideoPlayer, Reels) are
 * PRESERVED — new screens are added alongside them.
 */

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
import {SubjectListScreen} from '../screens/learn/SubjectListScreen';
import {SubjectDetailScreen} from '../screens/learn/SubjectDetailScreen';
import {TopicDetailScreen} from '../screens/learn/TopicDetailScreen';
import {FocusModeScreen} from '../screens/focus/FocusModeScreen';
import {ExamPredictorScreen} from '../screens/predictor/ExamPredictorScreen';
import {SettingsScreen} from '../screens/profile/SettingsScreen';
import {ChooseWorldScreen} from '../screens/theme/ChooseWorldScreen';

import {useChildProfile} from '../context/ChildProfileContext';
import {brand, neutral} from '../theme';
import type {StudyStackParamList} from './types';

const Stack = createNativeStackNavigator<StudyStackParamList>();

export function StudyNavigator() {
  // Fun-mode kids (grade ≤ 6) land straight on Zumi; everyone
  // else lands on the new Subject List screen.
  const {isFunMode} = useChildProfile();

  return (
    <Stack.Navigator
      initialRouteName={isFunMode ? 'ZumiHome' : 'SubjectList'}
      screenOptions={{
        headerStyle: {backgroundColor: neutral.surface},
        headerTintColor: neutral.ink900,
        headerShadowVisible: false,
        contentStyle: {backgroundColor: neutral.bgApp},
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      }}>
      {/* ── Class 6–12 screens ─────────────────────────── */}
      <Stack.Screen
        name="SubjectList"
        component={SubjectListScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="SubjectDetail"
        component={SubjectDetailScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="TopicDetail"
        component={TopicDetailScreen}
        options={{headerShown: false}}
      />

      {/* ── Fun-mode (Zumi) screens — unchanged ────────── */}
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
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ZumiVoice"
        component={ZumiVoiceScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Quiz"
        component={QuizScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="QuizResult"
        component={QuizResultScreen}
        options={{headerShown: false}}
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
      <Stack.Screen
        name="FocusMode"
        component={FocusModeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ExamPredictor"
        component={ExamPredictorScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ChooseWorld"
        component={ChooseWorldScreen}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
}
