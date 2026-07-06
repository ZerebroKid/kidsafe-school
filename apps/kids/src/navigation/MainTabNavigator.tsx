import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

import {StatusScreen} from '../screens/child/StatusScreen';
import {KidHomeScreen} from '../screens/child/KidHomeScreen';
import {colors} from '../theme';
import {useChildProfile} from '../context/ChildProfileContext';
import type {MainTabParamList} from './types';
import {StudyNavigator} from './StudyNavigator';
import {ReelsScreen} from '../screens/reels/ReelsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Zumi's signature purple -- active tab tint in fun mode. */
const FUN_ACTIVE = '#8b5cf6';

type IconName = 'home' | 'fun' | 'study' | 'reels';

/** Outline tab icons matching the design mockup (tintable, stroke-based). */
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

export function MainTabNavigator() {
  // Grade <= 6 children see the playful kid dashboard on Home and the "Fun"
  // tab (Zumi); everyone else keeps the StatusScreen + standard "Study" tab.
  // The Study tab still hosts the same StudyNavigator -- only the label/icon
  // changes, and per-topic routing decides Zumi vs lesson.
  const {isFunMode} = useChildProfile();
  const studyIcon: IconName = isFunMode ? 'fun' : 'study';
  const studyLabel = isFunMode ? 'Fun' : 'Study';
  const activeColor = isFunMode ? FUN_ACTIVE : colors.primary;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}>
      <Tab.Screen
        name="HomeTab"
        component={isFunMode ? KidHomeScreen : StatusScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabItem icon="home" label="Home" focused={focused} activeColor={activeColor} />
          ),
        }}
      />
      <Tab.Screen
        name="StudyTab"
        component={StudyNavigator}
        // Pressing the tab always lands on the stack root (ZumiHome /
        // StudyMission). Without this, a stale deep screen (e.g. Reels opened
        // from ZumiHome) stays on top of the stack and greets the child
        // instead of Zumi.
        listeners={({navigation}: {navigation: {navigate: (screen: string, params?: object) => void}}) => ({
          tabPress: (e: {preventDefault: () => void}) => {
            e.preventDefault();
            navigation.navigate('StudyTab', {
              screen: isFunMode ? 'ZumiHome' : 'StudyMission',
            });
          },
        })}
        options={{
          tabBarIcon: ({focused}) => (
            <TabItem
              icon={studyIcon}
              label={studyLabel}
              focused={focused}
              activeColor={activeColor}
            />
          ),
        }}
      />
      {isFunMode && (
        <Tab.Screen
          name="ReelsTab"
          component={ReelsScreen}
          options={{
            tabBarIcon: ({focused}) => (
              <TabItem icon="reels" label="Reels" focused={focused} activeColor={activeColor} />
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
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
