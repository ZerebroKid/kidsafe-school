/**
 * SubjectDetailScreen — Class 6–12 Subject Detail (Chapter list).
 *
 * Design: "Choose Your World" · Subject Detail (Chapter List & Syllabus Coverage).
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  useChildClassId,
  useChapterMetaMap,
  useTodayAssignments,
} from '../../firebase/study';
import {useAuthStore} from '../../state/authStore';
import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'SubjectDetail'>;

export function SubjectDetailScreen({route, navigation}: Props) {
  const {subjectName} = route.params;
  const {theme} = useTheme();
  const {colors} = theme;

  const uid = useAuthStore(s => s.firebaseUid);
  const classState = useChildClassId(uid);
  const assignmentsState = useTodayAssignments(classState.data?.classId ?? null);
  useChapterMetaMap(assignmentsState.data);

  const assignments = assignmentsState.data ?? [];
  const activeAssignment = assignments.find(
    a => a.subjectName.toLowerCase() === (subjectName || '').toLowerCase(),
  ) || assignments[0];

  const onTopicSelect = (topicTitle: string, chapterTitle: string) => {
    navigation.navigate('TopicDetail', {
      assignmentId: activeAssignment?.id || 'assign_demo',
      curriculumId: activeAssignment?.curriculumId || 'curr_cbse_8',
      chapterId: activeAssignment?.chapterId || 'ch_2',
      topicId: activeAssignment?.topicId || 't_linear_01',
      topicName: activeAssignment?.topicName || topicTitle,
      subjectName,
      chapterName: chapterTitle,
    });
  };

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.bg}
      />
      {/* Top Header & Syllabus Banner */}
      <View style={[styles.headerHero, {backgroundColor: colors.isDark ? colors.surfaceAlt : colors.primary}]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTopBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M15 5l-7 7 7 7" />
              </Svg>
            </Pressable>
            <Text style={[styles.headerTitle, {color: '#FFFFFF'}]}>{subjectName || 'Mathematics'}</Text>
            <Pressable style={styles.searchBtn} hitSlop={8}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={11} cy={11} r={6} />
                <Path d="M15.5 15.5L21 21" />
              </Svg>
            </Pressable>
          </View>

          {/* Syllabus Coverage Card */}
          <View style={[styles.syllabusCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.syllabusTopRow}>
              <Text style={[styles.syllabusOverline, {color: colors.textSecondary}]}>
                SYLLABUS COVERAGE — WHAT YOUR TEACHER SEES
              </Text>
              <Text style={[styles.syllabusPctText, {color: colors.isDark ? colors.textAccentMuted : colors.primary}]}>43%</Text>
            </View>
            <View style={[styles.syllabusTrack, {backgroundColor: colors.isDark ? colors.surfaceAlt : colors.cardInner}]}>
              <View style={[styles.syllabusFill, {width: '43%', backgroundColor: colors.primary}]} />
            </View>
            <Text style={[styles.syllabusSub, {color: colors.mutedText}]}>
              4 of 12 chapters complete · 2 in progress
            </Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Chapter List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Chapter 01 — Completed */}
        <Pressable
          style={({pressed}) => [
            styles.chapterCard,
            {backgroundColor: colors.surface, borderColor: colors.border},
            pressed && styles.cardPressed,
          ]}
          onPress={() => onTopicSelect('Rational Numbers', 'Ch 1')}>
          <View style={[styles.numChipDone, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 12.5l5 5L20 6.5" />
            </Svg>
          </View>
          <View style={styles.chapterTextWrap}>
            <Text style={[styles.chapterTitle, {color: colors.text}]}>Rational Numbers</Text>
            <Text style={[styles.chapterSubDone, {color: colors.success}]}>
              Complete · 4 of 4 topics
            </Text>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 5l7 7-7 7" />
          </Svg>
        </Pressable>

        {/* Chapter 02 — Active (In progress / Today's Chapter) */}
        <View
          style={[
            styles.activeChapterCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}>
          <View style={styles.chapterTopRow}>
            <View style={[styles.numChipActive, {backgroundColor: colors.badgeBg, borderColor: colors.primary}]}>
              <Text style={[styles.numTextActive, {color: colors.primary}]}>02</Text>
            </View>
            <View style={styles.chapterTextWrap}>
              <View style={styles.activeTitleRow}>
                <Text style={[styles.chapterTitle, {color: colors.text}]}>
                  Linear Equations in One Variable
                </Text>
                <View style={[styles.todayPill, {backgroundColor: colors.primary}]}>
                  <Text style={[styles.todayPillText, {color: colors.onPrimary}]}>TODAY</Text>
                </View>
              </View>
              <Text style={[styles.chapterSub, {color: colors.mutedText}]}>
                1 of 4 topics done · 25%
              </Text>
            </View>
          </View>

          {/* Active Topics inside Ch 2 */}
          <View style={styles.topicsCol}>
            {/* Topic 1 - Done */}
            <Pressable
              style={[styles.topicRowDone, {backgroundColor: colors.surfaceAlt}]}
              onPress={() => onTopicSelect('Introduction & Solving Equations', 'Ch 2')}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 12.5l5 5L20 6.5" />
              </Svg>
              <Text style={[styles.topicTitleDone, {color: colors.textSecondary}]}>
                1 · Introduction & Solving Equations
              </Text>
              <Text style={[styles.topicStatusDone, {color: colors.success}]}>Done</Text>
            </Pressable>

            {/* Topic 2 - In progress / Assigned */}
            <Pressable
              style={[
                styles.topicRowActive,
                {
                  backgroundColor: colors.badgeBg,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => onTopicSelect('Word Problems on Linear Equations', 'Ch 2')}>
              <View style={[styles.activeDot, {backgroundColor: colors.primary}]} />
              <View style={styles.topicActiveTextCol}>
                <Text style={[styles.topicTitleActive, {color: colors.text}]}>
                  2 · Word Problems on Linear Equations
                </Text>
                <Text style={[styles.topicSubActive, {color: colors.textAccentMuted}]}>
                  Assigned by teacher · Section 4
                </Text>
              </View>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 5l7 7-7 7" />
              </Svg>
            </Pressable>

            {/* Topic 3 - Next */}
            <Pressable
              style={[styles.topicRowNext, {backgroundColor: colors.surfaceAlt}]}
              onPress={() => onTopicSelect('Equations with Variables on Both Sides', 'Ch 2')}>
              <Text style={[styles.topicNumMuted, {color: colors.mutedText}]}>3</Text>
              <Text style={[styles.topicTitleNext, {color: colors.mutedText}]}>
                Equations with Variables on Both Sides
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Chapter 03 — Not started */}
        <Pressable
          style={({pressed}) => [
            styles.chapterCard,
            {backgroundColor: colors.surface, borderColor: colors.border},
            pressed && styles.cardPressed,
          ]}
          onPress={() => onTopicSelect('Understanding Quadrilaterals', 'Ch 3')}>
          <View style={[styles.numChipNormal, {backgroundColor: colors.cardInner}]}>
            <Text style={[styles.numTextNormal, {color: colors.mutedText}]}>03</Text>
          </View>
          <View style={styles.chapterTextWrap}>
            <Text style={[styles.chapterTitle, {color: colors.text}]}>Understanding Quadrilaterals</Text>
            <Text style={[styles.chapterSub, {color: colors.mutedText}]}>6 topics · not started</Text>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 5l7 7-7 7" />
          </Svg>
        </Pressable>

        {/* Chapter 04 — Locked with Reason */}
        <View
          style={[
            styles.lockedChapterCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderDashed,
            },
          ]}>
          <View style={styles.chapterTopRow}>
            <View style={[styles.numChipLocked, {backgroundColor: colors.cardInner}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.navInactive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={4} y={10} width={16} height={11} rx={2} />
                <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </Svg>
            </View>
            <View style={styles.chapterTextWrap}>
              <Text style={[styles.chapterTitleLocked, {color: colors.mutedText}]}>Data Handling</Text>
              <Text style={[styles.chapterSubLocked, {color: colors.navInactive}]}>5 topics</Text>
            </View>
          </View>
          <Text style={[styles.lockedReasonBox, {backgroundColor: colors.surfaceAlt, color: colors.mutedText}]}>
            Unlocks when your teacher assigns it in class.
          </Text>
        </View>

        {/* Chapter 05 — Locked */}
        <View
          style={[
            styles.lockedChapterCardSimple,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderDashed,
            },
          ]}>
          <View style={[styles.numChipLocked, {backgroundColor: colors.cardInner}]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.navInactive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Rect x={4} y={10} width={16} height={11} rx={2} />
              <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </Svg>
          </View>
          <View style={styles.chapterTextWrap}>
            <Text style={[styles.chapterTitleLocked, {color: colors.mutedText}]}>Squares and Square Roots</Text>
            <Text style={[styles.chapterSubLocked, {color: colors.navInactive}]}>4 topics</Text>
          </View>
        </View>

        <View style={{height: 32}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerHero: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  searchBtn: {
    padding: 4,
  },
  syllabusCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },
  syllabusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syllabusOverline: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  syllabusPctText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  syllabusTrack: {
    height: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  syllabusFill: {
    height: 7,
    borderRadius: radius.pill,
  },
  syllabusSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{scale: 0.99}],
  },

  // Chapter Cards
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  numChipDone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numChipNormal: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numTextNormal: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  chapterTextWrap: {
    flex: 1,
    gap: 3,
  },
  chapterTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  chapterSubDone: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  chapterSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },

  // Active Chapter Card
  activeChapterCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 16,
    gap: 14,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  chapterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  numChipActive: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numTextActive: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '800',
  },
  activeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayPill: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topicsCol: {
    gap: 8,
    paddingTop: 4,
  },
  topicRowDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  topicTitleDone: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  topicStatusDone: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: '600',
  },
  topicRowActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topicActiveTextCol: {
    flex: 1,
    gap: 2,
  },
  topicTitleActive: {
    fontFamily: fonts.heading,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  topicSubActive: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
  },
  topicRowNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  topicNumMuted: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
  },
  topicTitleNext: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },

  // Locked Chapter Cards
  lockedChapterCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 12,
  },
  lockedChapterCardSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  numChipLocked: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterTitleLocked: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  chapterSubLocked: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  lockedReasonBox: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
});
