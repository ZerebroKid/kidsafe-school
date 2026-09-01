import React, {useMemo} from 'react';
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
import {CosmicOutcomeDonut, type ClassMetrics} from './ClassReportCharts';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherClassReport'>;

// Sample fallback roster data matching the design prototype when Firestore rows are empty
const SAMPLE_ROSTER = [
  {ini: 'AK', name: 'Aarav Kapoor', roll: '04', score: 35, note: 'Word problems', marks: '7/20'},
  {ini: 'MS', name: 'Meera Sharma', roll: '11', score: 38, note: 'Variables both sides', marks: '8/20'},
  {ini: 'RV', name: 'Rohan Verma', roll: '19', score: 0, note: 'Not attempted', marks: '—'},
  {ini: 'IS', name: 'Isha Singh', roll: '07', score: 82, note: 'Steady this week', marks: '16/20'},
  {ini: 'DN', name: 'Dev Nair', roll: '12', score: 76, note: 'Improved +12%', marks: '15/20'},
  {ini: 'PT', name: 'Priya Tiwari', roll: '22', score: 94, note: 'Top of class', marks: '19/20'},
];

function getScoreColor(score: number): string {
  if (score === 0) return 'rgba(255, 255, 255, 0.45)';
  if (score < 50) return cosmicColors.pinkLight;
  if (score < 75) return cosmicColors.purpleSoft;
  return cosmicColors.cyanLight;
}

export function ClassReportScreen({route, navigation}: Props) {
  const {classId, className} = route.params;
  const uid = useAuthStore(s => s.firebaseUid);
  const {rows, loading, error} = useClassStudentRows(classId, uid);

  const rosterData = useMemo(() => {
    if (rows.length > 0) {
      return rows.map((r, idx) => {
        const score = r.latest?.lastPercentage ?? 0;
        const ini = r.name
          ? r.name
              .split(/\s+/)
              .map(p => p[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
          : `S${idx + 1}`;
        const roll = String(idx + 1).padStart(2, '0');
        const note = r.latest
          ? r.latest.topicName
          : 'Not attempted';
        const marks = r.latest
          ? `${Math.round((score / 100) * 20)}/20`
          : '—';

        return {
          id: r.childUid,
          ini,
          name: r.name,
          roll,
          score,
          note,
          marks,
        };
      });
    }
    return SAMPLE_ROSTER.map((s, idx) => ({
      id: `sample-${idx}`,
      ...s,
    }));
  }, [rows]);

  const metrics = useMemo<ClassMetrics>(() => {
    const total = rosterData.length;
    const attempted = rosterData.filter(r => r.score > 0).length;
    const passed = rosterData.filter(r => r.score >= 60).length;
    const failed = attempted - passed;
    const notAttempted = total - attempted;
    const sum = rosterData.reduce((acc, r) => acc + r.score, 0);
    const avg = attempted > 0 ? Math.round(sum / attempted) : 68;

    return {
      total,
      attempted,
      notAttempted,
      passed,
      failed,
      avg,
    };
  }, [rosterData]);

  return (
    <CosmicBackground>
      <CosmicHeader
        title={`Class ${className} report`}
        subtitle={`${metrics.total} students · avg ${metrics.avg}%`}
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
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Donut summary breakdown */}
        <CosmicOutcomeDonut metrics={metrics} />

        {/* Student Marks Section */}
        <View style={styles.rosterSection}>
          <View style={styles.rosterHeader}>
            <Text style={styles.rosterTitle}>Student marks</Text>
            <Text style={styles.rosterNote}>
              Showing {rosterData.length} of {metrics.total} · latest quiz
            </Text>
          </View>

          {loading && rows.length === 0 ? (
            <ActivityIndicator
              color={cosmicColors.purple}
              style={{marginTop: cosmicSpacing.md}}
            />
          ) : (
            <View style={styles.rosterList}>
              {rosterData.map(s => {
                const isWeak = s.score > 0 && s.score < 50;
                const fg = getScoreColor(s.score);
                const avBg = isWeak
                  ? 'rgba(236, 72, 153, 0.2)'
                  : cosmicColors.purpleBg;
                const cardBg = isWeak
                  ? 'rgba(236, 72, 153, 0.08)'
                  : cosmicColors.cardBgSubtle;
                const cardBorder = isWeak
                  ? 'rgba(236, 72, 153, 0.28)'
                  : cosmicColors.cardBorderSubtle;

                return (
                  <Pressable
                    key={s.id}
                    style={[
                      styles.studentCard,
                      {backgroundColor: cardBg, borderColor: cardBorder},
                    ]}
                    onPress={() =>
                      navigation.navigate('TeacherStudentDetail', {
                        studentUid: s.id,
                        studentName: s.name,
                        rollNo: s.roll,
                        classId,
                        className,
                        score: s.score,
                      })
                    }>
                    {/* Avatar */}
                    <View style={[styles.studentAvatar, {backgroundColor: avBg}]}>
                      <Text style={[styles.avatarText, {color: fg}]}>
                        {s.ini}
                      </Text>
                    </View>

                    {/* Meta */}
                    <View style={styles.studentMeta}>
                      <Text style={styles.studentName}>{s.name}</Text>
                      <Text style={styles.studentSub}>
                        Roll {s.roll} · {s.note}
                      </Text>
                    </View>

                    {/* Score */}
                    <View style={styles.studentScoreWrap}>
                      <Text style={[styles.studentScore, {color: fg}]}>
                        {s.score > 0 ? `${s.score}%` : '—'}
                      </Text>
                      <Text style={styles.studentMarks}>{s.marks}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
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
  errorCard: {
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
  rosterSection: {
    gap: 10,
    marginTop: 2,
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 2,
  },
  rosterTitle: {
    color: cosmicColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rosterNote: {
    color: cosmicColors.textSubtle,
    fontSize: 11,
  },
  rosterList: {
    gap: 10,
  },
  studentCard: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  studentMeta: {
    flex: 1,
  },
  studentName: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  studentSub: {
    color: cosmicColors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  studentScoreWrap: {
    alignItems: 'flex-end',
  },
  studentScore: {
    fontSize: 14,
    fontWeight: '700',
  },
  studentMarks: {
    color: cosmicColors.textSubtle,
    fontSize: 10,
    marginTop: 2,
  },
});
