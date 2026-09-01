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

import {useClassStudentRows} from '../../firebase/studyReports';
import {useAuthStore} from '../../state/authStore';
import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

type Props = NativeStackScreenProps<
  TeacherStackParamList,
  'TeacherClassStudents'
>;

export function ClassStudentListScreen({route, navigation}: Props) {
  const {classId, className} = route.params;
  const uid = useAuthStore(s => s.firebaseUid);

  const {rows, loading, error} = useClassStudentRows(classId, uid);
  const attemptedCount = rows.filter(r => r.latest !== null).length;

  return (
    <CosmicBackground>
      <CosmicHeader
        title={`Class ${className} Students`}
        subtitle={`${rows.length} students • ${attemptedCount} attempted`}
        onBack={() => navigation.goBack()}
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
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : loading ? (
          <ActivityIndicator color={cosmicColors.purple} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No students in this class yet.</Text>
            <Text style={styles.emptyBody}>
              Ask your principal to add students to this class. Their quiz results
              will appear here once they start.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((row, index) => (
              <Pressable
                key={row.childUid}
                style={styles.card}
                onPress={() =>
                  navigation.navigate('TeacherStudentDetail', {
                    studentUid: row.childUid,
                    studentName: row.name,
                    rollNo: String(index + 1).padStart(2, '0'),
                    classId,
                    className,
                    score: row.latest ? row.latest.bestPercentage : 0,
                  })
                }>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{row.name}</Text>
                  {row.latest ? (
                    <View
                      style={[
                        styles.badge,
                        row.latest.passed ? styles.badgePass : styles.badgeFail,
                      ]}>
                      <Text
                        style={[
                          styles.badgeText,
                          row.latest.passed
                            ? styles.badgeTextPass
                            : styles.badgeTextFail,
                        ]}>
                        {row.latest.lastPercentage}%
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.chevron}>›</Text>
                </View>
                {row.latest ? (
                  <Text style={styles.cardMeta}>
                    {row.latest.topicName}
                    {row.latest.passed ? ' • Passed' : ' • Keep going'}
                  </Text>
                ) : (
                  <Text style={styles.cardMetaMuted}>Not attempted yet</Text>
                )}
              </Pressable>
            ))}
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
  errorBanner: {
    padding: cosmicSpacing.sm + 4,
    borderRadius: cosmicRadius.md,
    backgroundColor: cosmicColors.pinkBg,
    borderWidth: 1,
    borderColor: cosmicColors.pinkBorder,
  },
  errorText: {
    color: cosmicColors.pinkLight,
    fontSize: 13,
  },
  empty: {
    backgroundColor: cosmicColors.cardBg,
    borderColor: cosmicColors.cardBorder,
    borderWidth: 1,
    borderRadius: cosmicRadius.xl,
    padding: cosmicSpacing.lg,
    gap: cosmicSpacing.xs,
  },
  emptyTitle: {
    color: cosmicColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBody: {
    color: cosmicColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: cosmicColors.cardBgSubtle,
    borderColor: cosmicColors.cardBorderSubtle,
    borderWidth: 1,
    borderRadius: cosmicRadius.lg,
    padding: 16,
    gap: cosmicSpacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cosmicSpacing.sm,
  },
  cardName: {
    flex: 1,
    color: cosmicColors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cardMeta: {
    color: cosmicColors.textMuted,
    fontSize: 12,
  },
  cardMetaMuted: {
    color: cosmicColors.textSubtle,
    fontSize: 12,
    fontStyle: 'italic',
  },
  badge: {
    paddingHorizontal: cosmicSpacing.sm + 2,
    paddingVertical: 3,
    borderRadius: cosmicRadius.pill,
  },
  badgePass: {
    backgroundColor: 'rgba(6, 182, 212, 0.16)',
  },
  badgeFail: {
    backgroundColor: 'rgba(236, 72, 153, 0.16)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextPass: {
    color: cosmicColors.cyanLight,
  },
  badgeTextFail: {
    color: cosmicColors.pinkLight,
  },
  chevron: {
    color: cosmicColors.textSubtle,
    fontSize: 18,
    marginLeft: 4,
  },
});
