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
  type ClassRow,
} from '../../firebase/teacher';
import {useAuthStore} from '../../state/authStore';
import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherClasses'>;

export function TeacherClassesScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const schoolState = useTeacherActiveSchool(uid);
  const classesState = useTeacherClasses(schoolState.data?.schoolId ?? null, uid);

  const classes = classesState.data ?? [];
  const loading = schoolState.loading || classesState.loading;

  return (
    <CosmicBackground>
      <CosmicHeader
        title="Classes"
        subtitle="Your registered classes"
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
          {classes.length} {classes.length === 1 ? 'class' : 'classes'} registered · tap one to view syllabus & assign
        </Text>

        {loading && classes.length === 0 ? (
          <ActivityIndicator
            color={cosmicColors.purple}
            style={{marginTop: cosmicSpacing.xl}}
          />
        ) : classes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No classes found</Text>
            <Text style={styles.emptySub}>
              Ask your principal to assign classes to your teacher account.
            </Text>
          </View>
        ) : (
          <View style={styles.classList}>
            {classes.map((c, idx) => {
              const sampleMastery = Math.min(95, 50 + ((idx * 17) % 45));
              const needHelpCount = ((idx + 2) * 3) % 9 || 4;
              const isHighNeed = needHelpCount > 5;

              return (
                <Pressable
                  key={c.id}
                  style={styles.classCard}
                  onPress={() =>
                    navigation.navigate('TeacherAssign', {
                      classId: c.id,
                      className: c.className,
                    })
                  }>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <View style={styles.classAvatar}>
                      <Text style={styles.classAvatarText}>
                        {c.className.slice(0, 3).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.classMeta}>
                      <Text style={styles.className}>Class {c.className}</Text>
                      <Text style={styles.classSub}>
                        Grade {c.grade} · Section {c.section}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {width: `${sampleMastery}%`},
                      ]}
                    />
                  </View>

                  {/* Bottom stats row */}
                  <View style={styles.cardBottom}>
                    <Text style={styles.masteryText}>
                      {sampleMastery}% mastery · 1 live
                    </Text>
                    <View
                      style={[
                        styles.chip,
                        isHighNeed ? styles.chipPink : styles.chipCyan,
                      ]}>
                      <Text
                        style={[
                          styles.chipText,
                          isHighNeed ? styles.chipTextPink : styles.chipTextCyan,
                        ]}>
                        {needHelpCount} need help
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

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
    padding: 17,
    borderRadius: cosmicRadius.xl,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorder,
    gap: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  classAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: cosmicColors.purpleBg,
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classAvatarText: {
    color: cosmicColors.purpleSoft,
    fontSize: 16,
    fontWeight: '700',
  },
  classMeta: {
    flex: 1,
  },
  className: {
    color: cosmicColors.text,
    fontSize: 17,
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
  progressTrack: {
    height: 8,
    borderRadius: cosmicRadius.pill,
    backgroundColor: cosmicColors.trackBg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: cosmicRadius.pill,
    backgroundColor: cosmicColors.purple,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masteryText: {
    color: cosmicColors.textMuted,
    fontSize: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipPink: {
    backgroundColor: cosmicColors.pinkBg,
  },
  chipCyan: {
    backgroundColor: cosmicColors.cyanBg,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextPink: {
    color: cosmicColors.pinkLight,
  },
  chipTextCyan: {
    color: cosmicColors.cyanLight,
  },
  emptyCard: {
    padding: 24,
    borderRadius: cosmicRadius.xl,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorder,
    alignItems: 'center',
    gap: 6,
    marginTop: cosmicSpacing.md,
  },
  emptyTitle: {
    color: cosmicColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: cosmicColors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
