import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherNotifications'>;

const NOTIFICATIONS = [
  {
    id: '1',
    title: '6 students in 8A scored below 40% on Word Problems',
    time: '12 min ago',
    hot: true,
  },
  {
    id: '2',
    title: 'Class 8B completed “Solving Basic Linear Equations”',
    time: '1 hour ago',
    hot: false,
  },
  {
    id: '3',
    title: 'Weekly report for Class 7C is ready',
    time: 'Yesterday',
    hot: false,
  },
  {
    id: '4',
    title: 'Timetable updated: Math 8A moved to 10:30 AM',
    time: '2 days ago',
    hot: false,
  },
];

export function NotificationsScreen({navigation}: Props) {
  return (
    <CosmicBackground>
      <CosmicHeader
        title="Notifications"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <View style={styles.list}>
          {NOTIFICATIONS.map(n => {
            return (
              <View
                key={n.id}
                style={[
                  styles.notifCard,
                  n.hot && styles.notifCardHot,
                ]}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifTime}>{n.time}</Text>
              </View>
            );
          })}
        </View>
        <View style={{height: 40}} />
      </ScrollView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: cosmicSpacing.lg,
    paddingTop: cosmicSpacing.xs,
  },
  list: {
    gap: 10,
  },
  notifCard: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: cosmicColors.cardBgSubtle,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorderSubtle,
    gap: 5,
  },
  notifCardHot: {
    backgroundColor: cosmicColors.pinkBg,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  notifTitle: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  notifTime: {
    color: cosmicColors.textMuted,
    fontSize: 12,
  },
});
