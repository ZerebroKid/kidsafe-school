import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {StudentHomeScreen} from '../screens/child/StudentHomeScreen';
import {FocusScreen} from '../screens/child/FocusScreen';
import {ProfileScreen} from '../screens/child/ProfileScreen';
import {colors} from '../theme';
import {useChildProfile} from '../context/ChildProfileContext';
import type {MainTabParamList} from './types';
import {StudyNavigator} from './StudyNavigator';
import {ReelsScreen} from '../screens/reels/ReelsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabItem({emoji, label, focused}: {emoji: string; label: string; focused: boolean}) {
  const tint = focused ? colors.primary : colors.textMuted;
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIcon, {color: tint}]}>{emoji}</Text>
      <Text style={[styles.tabLabel, {color: tint}]}>{label}</Text>
      <View style={[styles.indicator, focused && styles.indicatorActive]} />
    </View>
  );
}

export function MainTabNavigator() {
  // Grade <= 6 children see the playful "Fun" tab (Zumi); everyone else keeps
  // the standard "Study" tab. The tab still hosts the same StudyNavigator --
  // only the label/icon changes, and per-topic routing decides Zumi vs lesson.
  const {isFunMode} = useChildProfile();
  const studyEmoji = isFunMode ? '🎮' : '📖';
  const studyLabel = isFunMode ? 'Fun' : 'Study';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}>
      <Tab.Screen
        name="HomeTab"
        component={StudentHomeScreen}
        options={{
          tabBarIcon: ({focused}) => <TabItem emoji="🏠" label="Today" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="StudyTab"
        component={StudyNavigator}
        options={{
          tabBarIcon: ({focused}) => (
            <TabItem emoji={studyEmoji} label={studyLabel} focused={focused} />
          ),
        }}
      />
      {!isFunMode && (
        <Tab.Screen
          name="FocusTab"
          component={FocusScreen}
          options={{
            tabBarIcon: ({focused}) => <TabItem emoji="🎯" label="Focus" focused={focused} />,
          }}
        />
      )}
      {isFunMode && (
        <Tab.Screen
          name="ReelsTab"
          component={ReelsScreen}
          options={{
            tabBarIcon: ({focused}) => (
              <TabItem emoji="🎬" label="Reels" focused={focused} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({focused}) => <TabItem emoji="🙂" label="Me" focused={focused} />,
        }}
      />
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
  tabIcon: {
    fontSize: 20,
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
  indicatorActive: {
    backgroundColor: colors.primary,
  },
});
