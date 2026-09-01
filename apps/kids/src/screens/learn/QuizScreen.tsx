/**
 * QuizScreen — Class 6–12 Quiz Experience (Grade 7+).
 *
 * Bound to useTopicContent hook (topic.quiz[] array).
 * Submits raw answers to `submitQuizAttempt` Cloud Function.
 * Scoring and pass/fail evaluation happen exclusively server-side.
 */

import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {callFn} from '@zerebro/shared-firebase';
import type {
  SubmitQuizAttemptInput,
  SubmitQuizAttemptOutput,
} from '@zerebro/shared-types';

import {AIDoubtModal} from './components/AIDoubtModal';
import {useTopicContent} from '../../firebase/study';
import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'Quiz'>;

export function QuizScreen({route, navigation}: Props) {
  const {assignmentId, curriculumId, chapterId, topicId, topicName} = route.params;
  const {theme} = useTheme();
  const {colors, images} = theme;

  const {data: topic, loading: topicLoading, error} = useTopicContent(
    curriculumId,
    chapterId,
    topicId,
  );

  const quiz = useMemo(() => topic?.quiz ?? [], [topic]);
  const total = quiz.length;

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);

  // 1. Loading State
  if (topicLoading) {
    return (
      <View style={[styles.centerBg, {backgroundColor: colors.bg}]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, {color: colors.mutedText}]}>
          Loading quiz questions…
        </Text>
      </View>
    );
  }

  // 2. Error / No Quiz Questions
  if (error || !topic || total === 0) {
    return (
      <View style={[styles.centerBg, {backgroundColor: colors.bg}]}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={[styles.errorTitle, {color: '#EF4444'}]}>
          Quiz not available
        </Text>
        <Text style={[styles.errorBody, {color: colors.mutedText}]}>
          {error || 'No quiz questions are assigned for this topic yet.'}
        </Text>
        <Pressable
          style={[styles.outlineBtn, {borderColor: colors.border, backgroundColor: colors.surface}]}
          onPress={() => navigation.goBack()}>
          <Text style={[styles.outlineBtnText, {color: colors.text}]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const question = quiz[current];
  const selectedIdx = answers[question.questionId] ?? null;
  const isLast = current === total - 1;

  const onSelectOption = (index: number) => {
    setAnswers(prev => ({
      ...prev,
      [question.questionId]: index,
    }));
  };

  const onNextOrSubmit = async () => {
    if (selectedIdx === null) {
      Alert.alert('Please select an answer', 'Choose an option before continuing.');
      return;
    }

    if (!isLast) {
      setCurrent(c => c + 1);
      return;
    }

    // Submit Attempt
    setSubmitting(true);
    try {
      const payload: SubmitQuizAttemptInput = {
        assignmentId,
        answers: quiz.map(q => ({
          questionId: q.questionId,
          selectedIndex: answers[q.questionId] ?? -1,
        })),
      };

      const result = await callFn<SubmitQuizAttemptInput, SubmitQuizAttemptOutput>(
        'submitQuizAttempt',
        payload,
      );

      navigation.replace('QuizResult', {
        result,
        topicName: topic.topicName || topicName,
        assignmentId,
        curriculumId,
        chapterId,
        topicId,
      });
    } catch (err: any) {
      setSubmitting(false);
      Alert.alert(
        'Submission Failed',
        err?.message || 'Unable to submit your quiz attempt. Please check your internet connection and try again.',
      );
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Hero Header with Background Image */}
        <View style={styles.quizHeaderBox}>
          <Image source={images.quizHeader} style={styles.quizHeaderImg} resizeMode="cover" />
          <View style={[styles.quizOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.72)' : 'rgba(30,10,60,0.55)'}]} />

          <SafeAreaView edges={['top']} style={styles.quizSafeTop}>
            <View style={styles.quizTopRow}>
              <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 6l12 12M18 6L6 18" />
                </Svg>
              </Pressable>
              <Text style={[styles.quizQuestionCount, {color: '#FFFFFF'}]}>
                Question {current + 1} of {total}
              </Text>
              <Pressable
                style={styles.askAiBtn}
                onPress={() => setShowAiModal(true)}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 5a4 4 0 0 0-4 4 3 3 0 0 0 0 6 3.5 3.5 0 0 0 4 3.4z" />
                  <Path d="M12 5a4 4 0 0 1 4 4 3 3 0 0 1 0 6 3.5 3.5 0 0 1-4 3.4z" />
                </Svg>
              </Pressable>
            </View>

            {/* Segmented Progress Bar */}
            <View style={styles.segmentedBar}>
              {Array.from({length: total}).map((_, idx) => {
                const isAnswered = answers[quiz[idx]?.questionId] !== undefined;
                const isCurrent = idx === current;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.segmentPill,
                      {
                        backgroundColor: isCurrent
                          ? colors.primary
                          : isAnswered
                            ? (colors.isDark ? colors.textAccentMuted : '#FFFFFF')
                            : 'rgba(255,255,255,0.24)',
                      },
                    ]}
                  />
                );
              })}
            </View>
          </SafeAreaView>
        </View>

        {/* Question & Options Body */}
        <View style={styles.quizBody}>
          <Text style={[styles.questionText, {color: colors.text}]}>
            {question.question}
          </Text>

          {/* Options List */}
          <View style={styles.optionsWrap}>
            {question.options.map((opt, index) => {
              const isSelected = selectedIdx === index;
              return (
                <Pressable
                  key={index}
                  style={[
                    styles.optionCard,
                    isSelected
                      ? {
                          backgroundColor: colors.isDark ? 'rgba(0,229,255,0.1)' : 'rgba(109,59,255,0.08)',
                          borderColor: colors.primary,
                          borderWidth: 2,
                        }
                      : {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderWidth: 1.5,
                        },
                  ]}
                  onPress={() => onSelectOption(index)}>
                  <View
                    style={[
                      styles.letterBox,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.cardInner,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.letterText,
                        {
                          color: isSelected ? colors.onPrimary : colors.mutedText,
                        },
                      ]}>
                      {optionLetters[index] || String(index + 1)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: colors.text,
                        fontWeight: isSelected ? '600' : '500',
                      },
                    ]}>
                    {opt}
                  </Text>
                  {isSelected && (
                    <Text style={[styles.selectedPillText, {color: colors.textAccentMuted}]}>
                      SELECTED
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Teacher & Parent Info Notice */}
          <View
            style={[
              styles.noticeBox,
              {
                backgroundColor: colors.isDark ? 'rgba(124,77,255,0.12)' : 'rgba(109,59,255,0.08)',
                borderColor: colors.isDark ? 'rgba(124,77,255,0.3)' : 'rgba(109,59,255,0.2)',
              },
            ]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={8} r={4} />
              <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
            </Svg>
            <Text style={[styles.noticeText, {color: colors.textSecondary}]}>
              Your result goes to your parent & teacher. Pass mark is 60%.
            </Text>
          </View>
        </View>

        <View style={{height: 120}} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomSafeArea, {backgroundColor: colors.navBg}]}>
        <View style={[styles.bottomBar, {backgroundColor: colors.navBg, borderTopColor: colors.border}]}>
          <Pressable
            disabled={submitting}
            style={({pressed}) => [
              styles.nextBtn,
              {backgroundColor: colors.primary},
              pressed && styles.btnPressed,
              submitting && {opacity: 0.7},
            ]}
            onPress={onNextOrSubmit}>
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <Text style={[styles.nextBtnText, {color: colors.onPrimary}]}>
                  {isLast ? 'Submit Quiz' : 'Next question'}
                </Text>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12h14M13 6l6 6-6 6" />
                </Svg>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* AI Doubt Modal */}
      {showAiModal && (
        <AIDoubtModal
          visible={showAiModal}
          onClose={() => setShowAiModal(false)}
          topicTitle={topic.topicName || topicName || 'Quiz Question'}
          sectionTitle={`Question ${current + 1}: ${question.question}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerBg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.pagePad,
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  errorEmoji: {
    fontSize: 44,
  },
  errorTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  outlineBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Quiz Header
  quizHeaderBox: {
    position: 'relative',
    height: 160,
  },
  quizHeaderImg: {
    width: '100%',
    height: 160,
    position: 'absolute',
  },
  quizOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  quizSafeTop: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  quizTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  iconBtn: {
    padding: 4,
  },
  quizQuestionCount: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '700',
  },
  askAiBtn: {
    padding: 6,
  },
  segmentedBar: {
    flexDirection: 'row',
    gap: 5,
    paddingTop: 8,
  },
  segmentPill: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
  },

  // Body
  quizBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  questionText: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '700',
  },
  optionsWrap: {
    gap: 12,
    paddingTop: 4,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
  },
  letterBox: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  optionText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
  },
  selectedPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Sticky Bottom Bar
  bottomSafeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  nextBtn: {
    height: 54,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
});
