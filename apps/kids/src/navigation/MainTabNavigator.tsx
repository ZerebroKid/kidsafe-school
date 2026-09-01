/**
 * MainTabNavigator — Bottom-tab shell.
 *
 * Routes:
 *  - isFunMode (grade ≤ 6):   3-tab layout: Home · Study/Fun · Reels
 *                              Uses the original inline tab bar.
 *  - !isFunMode (grade 7–12): 5-tab layout: Home · Study · Quiz · Rewards · Profile
 *                              Uses ZKBottomNav (design system custom tab bar).
 *
 * All business logic from StudyNavigator (Firestore, quiz, rewards) is
 * UNCHANGED — only the shell and entry routes differ.
 */

import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

import {KidHomeScreen} from '../screens/child/KidHomeScreen';
import {KidFunScreen} from '../screens/child/KidFunScreen';
import {KidCartoonsScreen} from '../screens/child/KidCartoonsScreen';
import {KidReelsScreen} from '../screens/child/KidReelsScreen';
import {KidGamesScreen} from '../screens/child/KidGamesScreen';
import {ZumiHomeScreen} from '../screens/fun/ZumiHomeScreen';
import {ZumiVoiceScreen} from '../screens/fun/ZumiVoiceScreen';
import {HomeScreen612} from '../screens/child/HomeScreen612';
import {ReelsScreen} from '../screens/reels/ReelsScreen';
import {RewardsScreen} from '../screens/rewards/RewardsScreen';
import {ProfileNavigator} from './ProfileNavigator';
import {colors} from '../theme';
import {useChildProfile} from '../context/ChildProfileContext';
import {ZKBottomNav} from '../components/zk/ZKBottomNav';
import type {JuniorStackParamList, Main612TabParamList} from './types';
import {StudyNavigator} from './StudyNavigator';

const FUN_ACTIVE = '#8b5cf6';
type IconName = 'home' | 'fun' | 'study' | 'reels';

function TabIcon({name, tint}: {name: IconName; tint: string}) {
  const stroke = {stroke: tint, strokeWidth: 1.8, fill: 'none' as const};
  switch (name) {
    case 'home':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d="M4.5 10.5L12 4l7.5 6.5V19a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 19v-8.5z"
            {...stroke}
            strokeLinejoin="round"
          />
          <Path d="M9.75 20.5v-5.5h4.5v5.5" {...stroke} strokeLinejoin="round" />
        </Svg>
      );
    case 'fun':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Rect x={2.75} y={7.75} width={18.5} height={9.5} rx={4.75} {...stroke} />
          <Path d="M7.5 10.5v4M5.5 12.5h4" {...stroke} strokeLinecap="round" />
          <Circle cx={15.5} cy={13.5} r={1.1} fill={tint} />
          <Circle cx={18} cy={11.5} r={1.1} fill={tint} />
        </Svg>
      );
    case 'study':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d="M5 5a2 2 0 012-2h12v15H7a2 2 0 00-2 2V5z"
            {...stroke}
            strokeLinejoin="round"
          />
          <Path d="M5 20a2 2 0 012-2h12v3" {...stroke} strokeLinejoin="round" />
        </Svg>
      );
    case 'reels':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Rect x={3.75} y={3.75} width={16.5} height={16.5} rx={4.5} {...stroke} />
          <Path d="M10.25 9.25l5 2.75-5 2.75v-5.5z" fill={tint} strokeLinejoin="round" />
        </Svg>
      );
  }
}

function TabItem({
  icon,
  label,
  focused,
  activeColor,
}: {
  icon: IconName;
  label: string;
  focused: boolean;
  activeColor: string;
}) {
  const tint = focused ? activeColor : colors.textMuted;
  return (
    <View style={styles.tabItem}>
      <TabIcon name={icon} tint={tint} />
      <Text style={[styles.tabLabel, {color: tint}]}>{label}</Text>
      <View
        style={[
          styles.indicator,
          focused && {backgroundColor: activeColor},
        ]}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Junior mode stack navigator (grade ≤ 6)
// ─────────────────────────────────────────────────────────────────────────────

const JuniorStack = createNativeStackNavigator<JuniorStackParamList>();

function JuniorModeNavigator() {
  return (
    <JuniorStack.Navigator screenOptions={{headerShown: false, animation: 'fade'}}>
      <JuniorStack.Screen name="KidHome" component={KidHomeScreen} />
      <JuniorStack.Screen name="KidFun" component={KidFunScreen} />
      <JuniorStack.Screen name="KidCartoons" component={KidCartoonsScreen} />
      <JuniorStack.Screen name="KidReels" component={KidReelsScreen} />
      <JuniorStack.Screen name="KidGames" component={KidGamesScreen} />
      <JuniorStack.Screen name="ZumiHome" component={ZumiHomeScreen} />
      <JuniorStack.Screen name="ZumiVoice" component={ZumiVoiceScreen} />
    </JuniorStack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Class 6–12 tab navigator (grade 7+) — new 5-tab design
// ─────────────────────────────────────────────────────────────────────────────

const Tab612 = createBottomTabNavigator<Main612TabParamList>();

function SeniorModeNavigator() {
  return (
    <Tab612.Navigator
      tabBar={(props: any) => <ZKBottomNav {...props} />}
      screenOptions={{headerShown: false}}>
      <Tab612.Screen name="HomeTab612" component={HomeScreen612} />
      <Tab612.Screen
        name="StudyTab"
        component={StudyNavigator}
        options={{popToTopOnBlur: true}}
      />
      <Tab612.Screen name="QuizTab" component={RecentQuizPlaceholder} />
      <Tab612.Screen name="RewardsTab" component={RewardsScreen} />
      <Tab612.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{popToTopOnBlur: true}}
      />
    </Tab612.Navigator>
  );
}

/** Placeholder — Recent Quiz tab (wired to SubjectList for now). */
function RecentQuizPlaceholder() {
  return <StudyNavigator />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export — branches on isFunMode
// ─────────────────────────────────────────────────────────────────────────────

export function MainTabNavigator() {
  const {isFunMode, loading, childGrade} = useChildProfile();

  if (loading && childGrade === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Grade 7+ gets the new 5-tab Class 6–12 design.
  // Grade ≤6 (isFunMode) keeps the original 3-tab purple Zumi experience.
  if (isFunMode) {
    return <JuniorModeNavigator />;
  }
  return <SeniorModeNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 0,
    paddingTop: 6,
  },
  tabItem: {
    alignItems: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  indicator: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
});
