/**
 * TopicDetailScreen — Class 6–12 Topic Detail (Connected 7-Section Journey).
 *
 * Design: "Choose Your World" · V3 / F3 / Q3 / Classic TOPIC DETAIL.
 */

import React, {useState} from 'react';
import {
  Image,
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

import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {StudyStackParamList} from '../../navigation/types';
import {useTopicContent} from '../../firebase/study';
import {useTopicProgressStore} from '../../state/topicProgressStore';

type Props = NativeStackScreenProps<StudyStackParamList, 'TopicDetail'>;

interface SectionItem {
  num: number;
  title: string;
  sub: string;
  duration?: string;
}

const SECTIONS_LIST: SectionItem[] = [
  {num: 1, title: 'Explanation', sub: 'The concept in simple words'},
  {num: 2, title: 'Watch & Learn', sub: 'Video explanation'},
  {num: 3, title: 'Practice', sub: 'Try it yourself'},
  {num: 4, title: 'Curiosity', sub: 'Why does this work, and what if the answer is a decimal?', duration: '4 min'},
  {num: 5, title: 'Real-Life', sub: 'Real-world connections & applications'},
  {num: 6, title: 'Common Mistakes', sub: '3 min'},
  {num: 7, title: 'Experiment', sub: '2 min'},
];

export function TopicDetailScreen({route, navigation}: Props) {
  const {
    topicName,
    chapterName,
    subjectName,
    assignmentId,
    curriculumId,
    chapterId,
    topicId,
  } = route.params;
  const {theme} = useTheme();
  const {colors, images} = theme;

  const topicKey = topicId || assignmentId;
  const {completedSectionsByTopic, getNextActiveSection} = useTopicProgressStore();
  const completedList = completedSectionsByTopic[topicKey] || [];
  const completedCount = completedList.length;
  const activeSectionNum = getNextActiveSection(topicKey);
  const allSectionsDone = completedCount >= 7;
  const progressRatio = Math.min(1, Math.max(0, completedCount / 7));
  const strokeDashoffset = 213.63 * (1 - progressRatio);

  const {data: topicContent} = useTopicContent(
    curriculumId,
    chapterId,
    topicId,
  );

  const displayTopicName = topicContent?.topicName || topicName;
  const displayChapterName = topicContent?.chapterName || chapterName || (topicContent?.chapterNo ? `Ch ${topicContent.chapterNo}` : 'Chapter');
  const displaySubjectName = topicContent?.subject || subjectName || 'Study';

  const onStartSection = (secNum: number = 1) => {
    navigation.navigate('TopicLearn', {
      assignmentId,
      curriculumId,
      chapterId,
      topicId,
      topicName: displayTopicName,
      sectionNum: secNum,
    });
  };

  const onStartQuiz = () => {
    navigation.navigate('Quiz', {
      assignmentId,
      curriculumId,
      chapterId,
      topicId,
      topicName: displayTopicName,
    });
  };

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Hero Header with Background Image */}
        <View style={styles.heroBannerBox}>
          <Image source={images.topicHeader} style={styles.heroBannerImg} resizeMode="cover" />
          <View style={[styles.heroOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.72)' : 'rgba(30,10,60,0.55)'}]} />

          <SafeAreaView edges={['top']} style={styles.heroSafeTop}>
            <View style={styles.heroTopRow}>
              <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M15 5l-7 7 7 7" />
                </Svg>
              </Pressable>
              <View style={[styles.tagPill, {backgroundColor: colors.isDark ? colors.badgeBg : 'rgba(255,255,255,0.22)', borderColor: colors.isDark ? colors.badgeBorder : 'rgba(255,255,255,0.45)'}]}>
                <Text style={[styles.tagPillText, {color: colors.isDark ? colors.textAccentMuted : '#FFFFFF'}]}>
                  {displaySubjectName} · {displayChapterName}
                </Text>
              </View>
              <Pressable style={styles.bookmarkBtn} hitSlop={8}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 4h12v17l-6-4.6L6 21z" />
                </Svg>
              </Pressable>
            </View>

            <View style={styles.heroBottomContent}>
              <Text style={[styles.heroTitle, {color: '#FFFFFF'}]}>
                {displayTopicName}
              </Text>
              <View style={styles.heroProgressRow}>
                {/* Dynamic Progress Ring */}
                <View style={styles.ringWrap}>
                  <Svg width={56} height={56} viewBox="0 0 80 80">
                    <Circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth={9} />
                    <Circle
                      cx={40}
                      cy={40}
                      r={34}
                      fill="none"
                      stroke={allSectionsDone ? colors.success : colors.primary}
                      strokeWidth={9}
                      strokeLinecap="round"
                      strokeDasharray={213.63}
                      strokeDashoffset={strokeDashoffset}
                      transform="rotate(-90 40 40)"
                    />
                  </Svg>
                  <Text style={[styles.ringText, {color: '#FFFFFF'}]}>{completedCount}/7</Text>
                </View>
                <Text style={[styles.heroProgressSub, {color: colors.textSecondary}]}>
                  {allSectionsDone
                    ? 'All 7 sections complete! · Ready for Quiz'
                    : `${7 - completedCount} sections left · about ${(7 - completedCount) * 3} min · due 11:59 PM`}
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* 7-Section Journey List */}
        <View style={styles.journeyWrap}>
          {SECTIONS_LIST.map((sec, idx) => {
            const isDone = completedList.includes(sec.num);
            const isCurrent = sec.num === activeSectionNum && !allSectionsDone;
            const isLocked = !isDone && !isCurrent;

            return (
              <Pressable
                key={sec.num}
                style={styles.journeyRow}
                onPress={() => !isLocked && onStartSection(sec.num)}>
                {/* Left Step Node + Connector Line */}
                <View style={styles.nodeColumn}>
                  {isDone ? (
                    <View style={[styles.stepNodeDone, {backgroundColor: 'rgba(52,231,181,0.16)', borderColor: 'rgba(52,231,181,0.4)'}]}>
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M4 12.5l5 5L20 6.5" />
                      </Svg>
                    </View>
                  ) : isCurrent ? (
                    <View style={[styles.stepNodeActive, {backgroundColor: colors.badgeBg, borderColor: colors.primary}]}>
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <Circle cx={12} cy={12} r={8} />
                        <Path d="M9.6 9.4A2.5 2.5 0 0 1 14.5 10c0 1.7-2.5 2-2.5 3.5" />
                        <Path d="M12 17h.01" />
                      </Svg>
                    </View>
                  ) : (
                    <View style={[styles.stepNodeLocked, {backgroundColor: colors.cardInner, borderColor: colors.border}]}>
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.navInactive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <Rect x={4} y={10} width={16} height={11} rx={2} />
                        <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </Svg>
                    </View>
                  )}

                  {/* Vertical Connector Line */}
                  <View
                    style={[
                      styles.connectorLine,
                      {
                        backgroundColor: isDone
                          ? colors.success
                          : isCurrent
                            ? colors.primary
                            : colors.surfaceAlt,
                      },
                    ]}
                  />
                </View>

                {/* Right Card Content */}
                <View style={styles.cardColumn}>
                  {isCurrent ? (
                    /* Active "You are here" card */
                    <View
                      style={[
                        styles.activeSectionCard,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: colors.primary,
                          shadowColor: colors.primary,
                        },
                      ]}>
                      <Text style={[styles.activeSectionOverline, {color: colors.primary}]}>
                        Section {sec.num} · you are here
                      </Text>
                      <Text style={[styles.activeSectionTitle, {color: colors.text}]}>
                        {sec.title}
                      </Text>
                      <Text style={[styles.activeSectionSub, {color: colors.mutedText}]}>
                        {sec.sub}
                      </Text>
                      <Pressable
                        style={[styles.resumeSectionBtn, {backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder}]}
                        onPress={() => onStartSection(sec.num)}>
                        <Text style={[styles.resumeSectionBtnText, {color: colors.textAccentMuted}]}>
                          Resume this section
                        </Text>
                      </Pressable>
                    </View>
                  ) : isDone ? (
                    /* Completed section row with green tick badge */
                    <View
                      style={[
                        styles.doneSectionCard,
                        {backgroundColor: colors.surface, borderColor: colors.border},
                      ]}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1}}>
                        <View style={[styles.doneCheckBadge, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M4 12.5l5 5L20 6.5" />
                          </Svg>
                        </View>
                        <Text style={[styles.doneSectionTitle, {color: colors.text}]}>
                          {sec.num} · {sec.title}
                        </Text>
                      </View>
                      <Text style={[styles.doneStatusText, {color: colors.success}]}>Done</Text>
                    </View>
                  ) : (
                    /* Locked section row */
                    <View
                      style={[
                        styles.lockedSectionCard,
                        {backgroundColor: colors.surface, borderColor: colors.border},
                      ]}>
                      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                        <Text style={[styles.lockedSectionTitle, {color: colors.textSecondary}]}>
                          {sec.num} · {sec.title}
                        </Text>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.navInactive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M9 5l7 7-7 7" />
                        </Svg>
                      </View>
                      <Text style={[styles.lockedSectionSub, {color: colors.navInactive}]}>
                        {sec.sub}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}

          {/* Quiz Gate (Last Row) */}
          <View style={styles.journeyRow}>
            <View style={styles.nodeColumn}>
              <View style={[
                styles.stepNodeLocked,
                allSectionsDone
                  ? {backgroundColor: 'rgba(52,231,181,0.16)', borderColor: colors.success}
                  : {backgroundColor: colors.cardInner, borderColor: colors.border},
              ]}>
                {allSectionsDone ? (
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </Svg>
                ) : (
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.navInactive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Rect x={4} y={10} width={16} height={11} rx={2} />
                    <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </Svg>
                )}
              </View>
            </View>
            <View style={styles.cardColumn}>
              <Pressable
                style={[
                  styles.quizGateCard,
                  allSectionsDone
                    ? {backgroundColor: colors.surfaceAlt, borderColor: colors.primary}
                    : {backgroundColor: colors.surface, borderColor: colors.borderDashed},
                ]}
                onPress={onStartQuiz}>
                <Text style={[styles.quizGateTitle, {color: allSectionsDone ? colors.primary : colors.mutedText}]}>
                  {allSectionsDone ? 'Quiz — Unlocked!' : 'Quiz — the gate'}
                </Text>
                <Text style={[styles.quizGateSub, {color: allSectionsDone ? colors.textSecondary : colors.navInactive}]}>
                  {allSectionsDone
                    ? 'All 7 sections are done. Take the quiz to test your mastery!'
                    : `${7 - completedCount} sections to go. Result goes to your parent & teacher.`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={{height: 100}} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.bottomBar, {backgroundColor: colors.navBg, borderTopColor: colors.border}]}>
        <View style={styles.bottomBarProgressRow}>
          <View style={[styles.bottomTrack, {backgroundColor: colors.surfaceAlt}]}>
            <View
              style={[
                styles.bottomFill,
                {
                  width: `${Math.round(progressRatio * 100)}%`,
                  backgroundColor: allSectionsDone ? colors.success : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.bottomBarPctText, {color: colors.textAccentMuted}]}>
            {completedCount} / 7
          </Text>
        </View>
        <Pressable
          style={({pressed}) => [
            styles.continueBtn,
            {backgroundColor: colors.primary},
            pressed && styles.btnPressed,
          ]}
          onPress={() => (allSectionsDone ? onStartQuiz() : onStartSection(activeSectionNum))}>
          <Text style={[styles.continueBtnText, {color: colors.onPrimary}]}>
            {allSectionsDone ? 'Start Quiz' : `Continue — Section ${activeSectionNum}`}
          </Text>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12h14M13 6l6 6-6 6" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Hero header banner
  heroBannerBox: {
    position: 'relative',
    height: 230,
  },
  heroBannerImg: {
    width: '100%',
    height: 230,
    position: 'absolute',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroSafeTop: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  iconBtn: {
    padding: 4,
  },
  tagPill: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  bookmarkBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  heroBottomContent: {
    gap: 10,
  },
  heroTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
  },
  heroProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringWrap: {
    width: 56,
    height: 56,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  heroProgressSub: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },

  // Journey list
  journeyWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 0,
  },
  journeyRow: {
    flexDirection: 'row',
    gap: 14,
  },
  nodeColumn: {
    width: 44,
    alignItems: 'center',
  },
  cardColumn: {
    flex: 1,
    paddingBottom: 12,
  },

  stepNodeDone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNodeActive: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNodeLocked: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorLine: {
    width: 3,
    flex: 1,
    marginVertical: 6,
  },

  // Cards in journey
  doneSectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  doneSectionTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  doneCheckBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneStatusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
  },

  activeSectionCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 2,
    gap: 10,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
  },
  activeSectionOverline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  activeSectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  activeSectionSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  resumeSectionBtn: {
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeSectionBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },

  lockedSectionCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 2,
  },
  lockedSectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  lockedSectionSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },

  quizGateCard: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 6,
  },
  quizGateTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  quizGateSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Sticky bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    gap: 10,
  },
  bottomBarProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  bottomFill: {
    height: 8,
    borderRadius: radius.pill,
  },
  bottomBarPctText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  continueBtn: {
    height: 56,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
});
