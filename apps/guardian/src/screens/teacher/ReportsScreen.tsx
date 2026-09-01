import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  useTeacherActiveSchool,
  useTeacherClasses,
} from '../../firebase/teacher';
import {useAuthStore} from '../../state/authStore';
import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherReports'>;

const WEEKLY_BARS = [
  {day: 'Mon', height: '44%', color: 'rgba(139, 92, 246, 0.5)'},
  {day: 'Tue', height: '66%', color: cosmicColors.purple},
  {day: 'Wed', height: '32%', color: 'rgba(139, 92, 246, 0.4)'},
  {day: 'Thu', height: '78%', color: cosmicColors.cyan},
  {day: 'Fri', height: '88%', color: cosmicColors.pink},
];

export function TeacherReportsScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const schoolState = useTeacherActiveSchool(uid);
  const classesState = useTeacherClasses(schoolState.data?.schoolId ?? null, uid);

  const classes = classesState.data ?? [];
  const loading = schoolState.loading || classesState.loading;

  return (
    <CosmicBackground>
      <CosmicHeader
        title="Reports"
        subtitle="Class-wise performance"
        showBack={false}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {}}
            tintColor={cosmicColors.purple}
          />
        }>
        <Text style={styles.hintText}>
          Pick a class to see every student's marks and performance
        </Text>

        {loading && classes.length === 0 ? (
          <ActivityIndicator
            color={cosmicColors.purple}
            style={{marginTop: cosmicSpacing.xl}}
          />
        ) : (
          <View style={styles.classList}>
            {classes.map((c, idx) => {
              const sampleMastery = Math.min(95, 52 + ((idx * 17) % 45));

              return (
                <Pressable
                  key={c.id}
                  style={styles.classCard}
                  onPress={() =>
                    navigation.navigate('TeacherClassReport', {
                      classId: c.id,
                      className: c.className,
                    })
                  }>
                  <View style={styles.classAvatar}>
                    <Text style={styles.classAvatarText}>
                      {c.className.slice(0, 3).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.classMeta}>
                    <Text style={styles.className}>Class {c.className}</Text>
                    <Text style={styles.classSub}>
                      Grade {c.grade}{c.section} · avg {sampleMastery}%
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* This Week Performance Card */}
        <View style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>This week</Text>
            <Text style={styles.weeklyDelta}>+8% vs last</Text>
          </View>

          {/* Bar chart */}
          <View style={styles.chartArea}>
            {WEEKLY_BARS.map(b => (
              <View key={b.day} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {height: b.height as any, backgroundColor: b.color},
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.barDay,
                    b.day === 'Fri' && styles.barDayHighlight,
                  ]}>
                  {b.day}
                </Text>
              </View>
            ))}
          </View>
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
    gap: cosmicSpacing.md,
  },
  hintText: {
    color: cosmicColors.textMuted,
    fontSize: 13,
    paddingHorizontal: 2,
  },
  classList: {
    gap: 12,
  },
  classCard: {
    padding: 16,
    borderRadius: cosmicRadius.xl,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  classAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: cosmicColors.purpleBg,
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classAvatarText: {
    color: cosmicColors.purpleSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  classMeta: {
    flex: 1,
  },
  className: {
    color: cosmicColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  classSub: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  chevron: {
    color: cosmicColors.textSubtle,
    fontSize: 20,
  },
  weeklyCard: {
    padding: 18,
    borderRadius: cosmicRadius.xl,
    backgroundColor: cosmicColors.cardBgSubtle,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorderSubtle,
    marginTop: 4,
    gap: 16,
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  weeklyTitle: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  weeklyDelta: {
    color: cosmicColors.cyanLight,
    fontSize: 12,
    fontWeight: '700',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 104,
    paddingTop: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    gap: 8,
  },
  barTrack: {
    flex: 1,
    width: '60%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barDay: {
    color: cosmicColors.textSubtle,
    fontSize: 10,
    fontWeight: '600',
  },
  barDayHighlight: {
    color: cosmicColors.pinkLight,
    fontWeight: '700',
  },
});
