/**
 * QuizResultScreen — Class 6–12 Quiz Result View (Grade 7+).
 *
 * Displays the server-graded breakdown returned by submitQuizAttempt:
 *  - Score percentage and circular progress indicator
 *  - Pass / Fail status banner (Pass threshold: 60%)
 *  - Detailed Question-by-Question Review breakdown
 *  - Claim Reward (on pass) or Try Again (on fail) actions
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
import Svg, {Circle, Path} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {AIDoubtModal} from './components/AIDoubtModal';
import {fonts, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';
import {useTheme} from '../../context/ThemeContext';
import type {QuizQuestionResult} from '@zerebro/shared-types';

type Props = NativeStackScreenProps<StudyStackParamList, 'QuizResult'>;

export function QuizResultScreen({route, navigation}: Props) {
  const {result, topicName, assignmentId, curriculumId, chapterId, topicId} = route.params;
  const {theme} = useTheme();
  const {colors, images} = theme;
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showReviewList, setShowReviewList] = useState<boolean>(false);

  const percentage = typeof result?.percentage === 'number' ? result.percentage : 0;
  const score = typeof result?.score === 'number' ? result.score : 0;
  const total = typeof result?.total === 'number' ? result.total : 0;
  const passed = result?.passed ?? (percentage >= 60);
  const questionResults = result?.results ?? [];

  const onClaimReward = () => {
    navigation.navigate('RewardsTab');
  };

  const onTryAgain = () => {
    navigation.replace('Quiz', {
      assignmentId,
      curriculumId,
      chapterId,
      topicId,
      topicName,
    });
  };

  const onBackToStudy = () => {
    navigation.navigate('SubjectList');
  };

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        {/* Hero Header Banner */}
        <View style={styles.heroBannerBox}>
          <Image source={images.resultHeader} style={styles.heroBannerImg} resizeMode="cover" />
          <View style={[styles.heroOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.72)' : 'rgba(20,10,50,0.55)'}]} />

          <SafeAreaView edges={['top']} style={styles.heroSafeTop}>
            <View style={styles.heroContentCol}>
              {/* Circular Score Ring */}
              <View style={styles.ringWrap}>
                <Svg width={104} height={104} viewBox="0 0 80 80">
                  <Circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={9} />
                  <Circle
                    cx={40}
                    cy={40}
                    r={34}
                    fill="none"
                    stroke={passed ? colors.success : colors.accent}
                    strokeWidth={9}
                    strokeLinecap="round"
                    strokeDasharray={213.63}
                    strokeDashoffset={213.63 * (1 - Math.min(100, Math.max(0, percentage)) / 100)}
                    transform="rotate(-90 40 40)"
                  />
                </Svg>
                <View style={styles.ringTextCol}>
                  <Text style={[styles.scorePctText, {color: '#FFFFFF'}]}>{percentage}%</Text>
                  <Text style={[styles.scoreCountText, {color: passed ? colors.success : colors.accent}]}>
                    {score} of {total}
                  </Text>
                </View>
              </View>

              <Text style={[styles.heroTitle, {color: '#FFFFFF'}]}>
                {passed ? 'Great Job!' : 'Keep Practicing!'}
              </Text>

              {/* Status pill */}
              <View
                style={[
                  styles.statusPill,
                  passed
                    ? {
                        backgroundColor: 'rgba(52,231,181,0.16)',
                        borderColor: 'rgba(52,231,181,0.42)',
                      }
                    : {
                        backgroundColor: 'rgba(255,46,147,0.16)',
                        borderColor: 'rgba(255,46,147,0.42)',
                      },
                ]}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={passed ? colors.success : colors.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  {passed ? (
                    <Path d="M4 12.5l5 5L20 6.5" />
                  ) : (
                    <Path d="M12 8v5M12 17h.01" />
                  )}
                </Svg>
                <Text style={[styles.statusPillText, {color: passed ? colors.success : colors.accent}]}>
                  {passed
                    ? 'Passed (60% achieved) · Sent to parent & teacher'
                    : 'Pass mark is 60% · You can retry any time'}
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Body Content */}
        <View style={styles.bodyWrap}>
          {/* Topic Info Card */}
          <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <Text style={[styles.cardOverline, {color: colors.textAccentMuted}]}>TOPIC</Text>
            <Text style={[styles.topicTitleText, {color: colors.text}]}>
              {topicName}
            </Text>
            <Text style={[styles.topicSubText, {color: colors.mutedText}]}>
              {passed
                ? `You scored ${score}/${total} questions correctly.`
                : `You got ${score} of ${total} questions. Try again to clear the 60% requirement!`}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <Pressable
              style={[
                styles.actionBtnSecondary,
                {backgroundColor: colors.surface, borderColor: colors.border},
              ]}
              onPress={() => setShowReviewList(prev => !prev)}>
              <Text style={[styles.actionBtnSecondaryText, {color: colors.text}]}>
                {showReviewList ? 'Hide Review' : 'Review Answers'}
              </Text>
            </Pressable>

            {passed ? (
              <Pressable
                style={[styles.actionBtnPrimary, {backgroundColor: colors.primary}]}
                onPress={onClaimReward}>
                <Text style={[styles.actionBtnPrimaryText, {color: colors.onPrimary}]}>
                  Claim Reward
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.actionBtnPrimary, {backgroundColor: colors.primary}]}
                onPress={onTryAgain}>
                <Text style={[styles.actionBtnPrimaryText, {color: colors.onPrimary}]}>
                  Try Again
                </Text>
              </Pressable>
            )}
          </View>

          {/* Question Breakdown List (if toggled) */}
          {showReviewList && questionResults.length > 0 && (
            <View style={styles.reviewSectionCol}>
              <Text style={[styles.sectionHeading, {color: colors.text}]}>
                Question Breakdown
              </Text>

              {questionResults.map((qRes: QuizQuestionResult, idx: number) => (
                <View
                  key={qRes.questionId || idx}
                  style={[
                    styles.qReviewCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: qRes.isCorrect ? colors.success : colors.border,
                    },
                  ]}>
                  <View style={styles.qReviewHeader}>
                    <View
                      style={[
                        styles.qBadge,
                        {
                          backgroundColor: qRes.isCorrect
                            ? 'rgba(52,231,181,0.16)'
                            : 'rgba(255,46,147,0.14)',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.qBadgeText,
                          {color: qRes.isCorrect ? colors.success : colors.accent},
                        ]}>
                        Q{idx + 1}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.qVerdictText,
                        {color: qRes.isCorrect ? colors.success : colors.accent},
                      ]}>
                      {qRes.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </Text>
                  </View>

                  {qRes.explanation ? (
                    <Text style={[styles.qExplanationText, {color: colors.textSecondary}]}>
                      {qRes.explanation}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Reward Banner Card (if passed) */}
          {passed && (
            <Pressable
              style={[styles.rewardBannerCard, {borderColor: colors.border}]}
              onPress={onClaimReward}>
              <Image source={images.rewardBanner} style={styles.rewardBannerImg} resizeMode="cover" />
              <View style={[styles.rewardBannerOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.72)' : 'rgba(0,0,0,0.4)'}]} />
              <View style={styles.rewardBannerTextContent}>
                <Text style={[styles.rewardBannerTitle, {color: '#FFFFFF'}]}>
                  Reward Unlocked!
                </Text>
                <Text style={[styles.rewardBannerSub, {color: colors.textSecondary}]}>
                  Games, videos, and daily offers are unlocked for you.
                </Text>
              </View>
            </Pressable>
          )}

          {/* Back to Study List Button */}
          <Pressable
            style={[styles.backStudyBtn, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}
            onPress={onBackToStudy}>
            <Text style={[styles.backStudyBtnText, {color: colors.textSecondary}]}>
              Return to Subject List
            </Text>
          </Pressable>
        </View>

        <View style={{height: 40}} />
      </ScrollView>

      {showAiModal && (
        <AIDoubtModal
          visible={showAiModal}
          onClose={() => setShowAiModal(false)}
          topicTitle={topicName || 'Quiz Review'}
          sectionTitle="Quiz Performance & Doubts"
        />
      )}
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
  content: {
    paddingBottom: 24,
  },

  // Hero Header
  heroBannerBox: {
    position: 'relative',
    height: 290,
  },
  heroBannerImg: {
    width: '100%',
    height: 290,
    position: 'absolute',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroSafeTop: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  heroContentCol: {
    alignItems: 'center',
    gap: 10,
  },
  ringWrap: {
    width: 104,
    height: 104,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTextCol: {
    position: 'absolute',
    alignItems: 'center',
  },
  scorePctText: {
    fontFamily: fonts.mono,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
  },
  scoreCountText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  heroTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: '600',
  },

  // Body
  bodyWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },
  cardSurface: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  cardOverline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  topicTitleText: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: '700',
  },
  topicSubText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondaryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '700',
  },

  // Question Breakdown List
  reviewSectionCol: {
    gap: 10,
    paddingTop: 6,
  },
  sectionHeading: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  qReviewCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  qReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  qVerdictText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: '700',
  },
  qExplanationText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },

  // Reward Banner Card
  rewardBannerCard: {
    height: 104,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  rewardBannerImg: {
    width: '100%',
    height: 104,
    position: 'absolute',
  },
  rewardBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  rewardBannerTextContent: {
    paddingHorizontal: 16,
    gap: 2,
  },
  rewardBannerTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: '700',
  },
  rewardBannerSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },

  // Back to study list
  backStudyBtn: {
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backStudyBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
});
