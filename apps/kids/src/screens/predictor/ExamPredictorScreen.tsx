/**
 * ExamPredictorScreen — AI Exam Predictor setup & results.
 *
 * Design: "Choose Your World" · AI Exam Predictor (setup & results).
 */

import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Path, Rect} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'ExamPredictor'>;

type PredictorState = 'setup' | 'results';

export function ExamPredictorScreen({navigation}: Props) {
  const [screenState, setScreenState] = useState<PredictorState>('results');
  const {theme} = useTheme();
  const {colors} = theme;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      {screenState === 'setup' ? (
        /* ================= SETUP STATE ================= */
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.darkHeader, {backgroundColor: colors.isDark ? colors.surfaceAlt : colors.primary}]}>
            <SafeAreaView edges={['top']}>
              <View style={styles.ribbonRow}>
                <View style={[styles.comingSoonRibbon, {backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder}]}>
                  <Text style={[styles.comingSoonText, {color: colors.isDark ? colors.textAccentMuted : '#FFFFFF'}]}>
                    COMING SOON
                  </Text>
                </View>
              </View>

              <View style={styles.darkHeaderContent}>
                <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M15 5l-7 7 7 7" />
                  </Svg>
                </Pressable>
                <Text style={[styles.headerMainTitle, {color: '#FFFFFF'}]}>AI Exam Predictor</Text>
                <Text style={[styles.headerSub, {color: colors.isDark ? colors.textSecondary : 'rgba(255,255,255,0.85)'}]}>
                  Your school's past papers in. The most likely questions out.
                </Text>
              </View>
            </SafeAreaView>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Demo state switcher */}
            <View style={styles.demoStateRow}>
              {(['setup', 'results'] as PredictorState[]).map(st => {
                const isActive = screenState === st;
                return (
                  <Pressable
                    key={st}
                    style={[
                      styles.demoChip,
                      {backgroundColor: isActive ? colors.badgeBg : colors.surface, borderColor: isActive ? colors.primary : colors.border},
                    ]}
                    onPress={() => setScreenState(st)}>
                    <Text style={[styles.demoChipText, {color: isActive ? colors.primary : colors.mutedText}]}>
                      {st}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Exam selection card */}
            <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Text style={[styles.cardOverline, {color: colors.textSecondary}]}>YOUR EXAM</Text>
              <View style={[styles.pickerBox, {backgroundColor: colors.cardInner}]}>
                <Text style={[styles.pickerText, {color: colors.text}]}>Saharanpur Public School</Text>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 9l6 6 6-6" />
                </Svg>
              </View>
              <View style={[styles.pickerBox, {backgroundColor: colors.cardInner}]}>
                <Text style={[styles.pickerText, {color: colors.text}]}>Maths · Unit Test 2 · 12 Aug</Text>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 9l6 6 6-6" />
                </Svg>
              </View>
            </View>

            {/* Add past papers upload box */}
            <View style={[styles.uploadDashedCard, {backgroundColor: colors.surface, borderColor: colors.borderDashed}]}>
              <View style={[styles.uploadIconBadge, {backgroundColor: colors.badgeBg}]}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                  <Path d="M12 16V4M8 8l4-4 4 4" />
                </Svg>
              </View>
              <Text style={[styles.uploadTitle, {color: colors.text}]}>Add past papers</Text>
              <Text style={[styles.uploadSub, {color: colors.mutedText}]}>
                Photograph old question papers, or pick a PDF. Three or more gives a much better read.
              </Text>
              <View style={styles.uploadButtonsRow}>
                <Pressable style={[styles.uploadPrimaryBtn, {backgroundColor: colors.primary}]}>
                  <Text style={[styles.uploadPrimaryText, {color: colors.onPrimary}]}>Camera</Text>
                </Pressable>
                <Pressable style={[styles.uploadSecondaryBtn, {backgroundColor: colors.cardInner, borderColor: colors.border}]}>
                  <Text style={[styles.uploadSecondaryText, {color: colors.text}]}>Files</Text>
                </Pressable>
              </View>
            </View>

            {/* Uploaded Papers Grid */}
            <View style={styles.papersGrid}>
              <View style={[styles.paperMiniCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={[styles.paperMiniThumb, {backgroundColor: colors.cardInner}]}>
                  <Text style={[styles.paperMiniYear, {color: colors.text}]}>2024 · T1</Text>
                </View>
                <Text style={[styles.paperTagGreen, {color: colors.success}]}>✓ Read</Text>
              </View>
              <View style={[styles.paperMiniCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={[styles.paperMiniThumb, {backgroundColor: colors.cardInner}]}>
                  <Text style={[styles.paperMiniYear, {color: colors.text}]}>2024 · T2</Text>
                </View>
                <Text style={[styles.paperTagGreen, {color: colors.success}]}>✓ Read</Text>
              </View>
              <View style={[styles.paperMiniCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={[styles.paperMiniAddThumb, {backgroundColor: colors.cardInner}]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 5v14M5 12h14" />
                  </Svg>
                </View>
                <Text style={[styles.paperTagAdd, {color: colors.mutedText}]}>Add more</Text>
              </View>
            </View>

            {/* Privacy Callout */}
            <View style={[styles.privacyCallout, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={4} y={10} width={16} height={11} rx={2} />
                <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </Svg>
              <Text style={[styles.privacyText, {color: colors.textSecondary}]}>
                Papers are used only to predict your questions. They stay on your account and are never shared with other students.
              </Text>
            </View>
          </ScrollView>

          <SafeAreaView edges={['bottom']} style={[styles.stickyBottomSafeArea, {backgroundColor: colors.navBg}]}>
            <View style={[styles.stickyBottomBar, {backgroundColor: colors.navBg, borderTopColor: colors.border}]}>
              <Pressable style={[styles.analyseCta, {backgroundColor: colors.primary}]} onPress={() => setScreenState('results')}>
                <Text style={[styles.analyseCtaText, {color: colors.onPrimary}]}>Analyse 2 papers</Text>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12h14M13 6l6 6-6 6" />
                </Svg>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      ) : (
        /* ================= RESULTS STATE ================= */
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.darkHeader, {backgroundColor: colors.isDark ? colors.surfaceAlt : colors.primary}]}>
            <SafeAreaView edges={['top']}>
              <View style={styles.resultsTopRow}>
                <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M15 5l-7 7 7 7" />
                  </Svg>
                </Pressable>
                <Text style={[styles.resultsHeaderTitle, {color: '#FFFFFF'}]}>Most likely questions</Text>
              </View>

              <View style={[styles.resultsHeroCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={styles.resultsDaysWrap}>
                  <Text style={[styles.resultsDaysBig, {color: colors.text}]}>7 days</Text>
                  <Text style={[styles.resultsDaysSub, {color: colors.mutedText}]}>to Maths Unit Test 2</Text>
                </View>
                <View style={[styles.papersBadge, {backgroundColor: colors.badgeBg}]}>
                  <Text style={[styles.papersBadgeText, {color: colors.primary}]}>From 2 papers</Text>
                </View>
              </View>
            </SafeAreaView>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Demo state switcher */}
            <View style={styles.demoStateRow}>
              {(['setup', 'results'] as PredictorState[]).map(st => {
                const isActive = screenState === st;
                return (
                  <Pressable
                    key={st}
                    style={[
                      styles.demoChip,
                      {backgroundColor: isActive ? colors.badgeBg : colors.surface, borderColor: isActive ? colors.primary : colors.border},
                    ]}
                    onPress={() => setScreenState(st)}>
                    <Text style={[styles.demoChipText, {color: isActive ? colors.primary : colors.mutedText}]}>
                      {st}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Chapter Heat Map Card */}
            <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Text style={[styles.cardOverline, {color: colors.textSecondary}]}>CHAPTER HEAT MAP</Text>
              <View style={styles.heatMapCol}>
                <View style={styles.heatMapRow}>
                  <Text style={[styles.chapterNameText, {color: colors.text}]}>Linear Equations</Text>
                  <View style={[styles.barTrack, {backgroundColor: colors.cardInner}]}>
                    <View style={[styles.barFill, {width: '86%', backgroundColor: '#FF2E93'}]} />
                  </View>
                  <Text style={[styles.pctMonoText, {color: colors.text}]}>86%</Text>
                </View>

                <View style={styles.heatMapRow}>
                  <Text style={[styles.chapterNameText, {color: colors.text}]}>Rational Numbers</Text>
                  <View style={[styles.barTrack, {backgroundColor: colors.cardInner}]}>
                    <View style={[styles.barFill, {width: '62%', backgroundColor: colors.accent}]} />
                  </View>
                  <Text style={[styles.pctMonoText, {color: colors.text}]}>62%</Text>
                </View>

                <View style={styles.heatMapRow}>
                  <Text style={[styles.chapterNameText, {color: colors.text}]}>Quadrilaterals</Text>
                  <View style={[styles.barTrack, {backgroundColor: colors.cardInner}]}>
                    <View style={[styles.barFill, {width: '34%', backgroundColor: '#FFB020'}]} />
                  </View>
                  <Text style={[styles.pctMonoText, {color: colors.text}]}>34%</Text>
                </View>

                <View style={styles.heatMapRow}>
                  <Text style={[styles.chapterNameText, {color: colors.text}]}>Data Handling</Text>
                  <View style={[styles.barTrack, {backgroundColor: colors.cardInner}]}>
                    <View style={[styles.barFill, {width: '18%', backgroundColor: colors.success}]} />
                  </View>
                  <Text style={[styles.pctMonoText, {color: colors.text}]}>18%</Text>
                </View>
              </View>
            </View>

            {/* Questions List */}
            <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Text style={[styles.cardOverline, {color: colors.primary}]}>PREDICTED QUESTIONS (5)</Text>
              
              <View style={styles.predictedItem}>
                <View style={styles.predictedTopRow}>
                  <View style={[styles.probPill, {backgroundColor: 'rgba(255,46,147,0.14)'}]}>
                    <Text style={[styles.probPillText, {color: '#FF2E93'}]}>92% LIKELY</Text>
                  </View>
                  <Text style={[styles.marksText, {color: colors.mutedText}]}>4 marks</Text>
                </View>
                <Text style={[styles.questionBodyText, {color: colors.text}]}>
                  Find three consecutive even integers whose sum is 234.
                </Text>
              </View>

              <View style={[styles.predictedItem, {borderTopColor: colors.border, borderTopWidth: 1}]}>
                <View style={styles.predictedTopRow}>
                  <View style={[styles.probPill, {backgroundColor: 'rgba(255,46,147,0.14)'}]}>
                    <Text style={[styles.probPillText, {color: '#FF2E93'}]}>88% LIKELY</Text>
                  </View>
                  <Text style={[styles.marksText, {color: colors.mutedText}]}>3 marks</Text>
                </View>
                <Text style={[styles.questionBodyText, {color: colors.text}]}>
                  Solve: 3(x + 2) - 2(x - 1) = 7
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  darkHeader: {
    paddingHorizontal: spacing.pagePad,
    paddingBottom: 20,
  },
  ribbonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  comingSoonRibbon: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  comingSoonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  darkHeaderContent: {
    gap: 8,
    paddingTop: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMainTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  headerSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePad,
    paddingTop: spacing.md,
    paddingBottom: 120,
    gap: 16,
  },
  demoStateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  demoChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  demoChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardSurface: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  cardOverline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
  },
  pickerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  uploadDashedCard: {
    padding: 24,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 10,
  },
  uploadIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: '700',
  },
  uploadSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    paddingTop: 6,
  },
  uploadPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPrimaryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '700',
  },
  uploadSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadSecondaryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  papersGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  paperMiniCard: {
    flex: 1,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  paperMiniThumb: {
    width: '100%',
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperMiniYear: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  paperTagGreen: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '700',
  },
  paperMiniAddThumb: {
    width: '100%',
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperTagAdd: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  privacyCallout: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  privacyText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  stickyBottomSafeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  stickyBottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.pagePad,
    paddingTop: 14,
    paddingBottom: 16,
  },
  analyseCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.pill,
    width: '100%',
  },
  analyseCtaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },

  /* RESULTS STYLES */
  resultsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  resultsHeaderTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  resultsHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  resultsDaysWrap: {
    gap: 2,
  },
  resultsDaysBig: {
    fontFamily: fonts.heading,
    fontSize: 22,
    fontWeight: '800',
  },
  resultsDaysSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  papersBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  papersBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: '700',
  },
  heatMapCol: {
    gap: 12,
  },
  heatMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chapterNameText: {
    width: 120,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: radius.pill,
  },
  pctMonoText: {
    width: 36,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  predictedItem: {
    gap: 8,
    paddingVertical: 10,
  },
  predictedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  probPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  probPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  marksText: {
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  questionBodyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
