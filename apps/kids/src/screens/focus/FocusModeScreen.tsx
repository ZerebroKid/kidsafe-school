/**
 * FocusModeScreen — Setup, Active, and Parent-Locked Focus States.
 *
 * Design: "Choose Your World" · Focus Mode (setup · active · parent-locked).
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
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'FocusMode'>;

type FocusState = 'setup' | 'active' | 'parent_locked';

export function FocusModeScreen({navigation}: Props) {
  const [focusState, setFocusState] = useState<FocusState>('setup');
  const [controller, setController] = useState<'me' | 'parent'>('me');
  const {theme} = useTheme();
  const {colors} = theme;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      {focusState === 'setup' ? (
        /* ================= SETUP STATE ================= */
        <View style={styles.setupContainer}>
          <SafeAreaView edges={['top']} style={[styles.setupHeaderSafe, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M15 5l-7 7 7 7" />
                </Svg>
              </Pressable>
              <Text style={[styles.headerTitle, {color: colors.text}]}>Focus Mode</Text>
            </View>
          </SafeAreaView>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Demo State Switcher */}
            <View style={styles.demoStateRow}>
              {(['setup', 'active', 'parent_locked'] as FocusState[]).map(st => {
                const isActive = focusState === st;
                return (
                  <Pressable
                    key={st}
                    style={[
                      styles.demoChip,
                      {backgroundColor: isActive ? colors.badgeBg : colors.surface, borderColor: isActive ? colors.primary : colors.border},
                    ]}
                    onPress={() => setFocusState(st)}>
                    <Text style={[styles.demoChipText, {color: isActive ? colors.primary : colors.mutedText}]}>
                      {st.replace('_', ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Study Window Card */}
            <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Text style={[styles.cardOverline, {color: colors.textSecondary}]}>STUDY WINDOW</Text>
              <View style={styles.timeWindowRow}>
                <View style={[styles.timeBox, {backgroundColor: colors.cardInner}]}>
                  <Text style={[styles.timeVal, {color: colors.text}]}>6:00 PM</Text>
                  <Text style={[styles.timeLabel, {color: colors.mutedText}]}>Start</Text>
                </View>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 5l7 7-7 7" />
                </Svg>
                <View style={[styles.timeBox, {backgroundColor: colors.cardInner}]}>
                  <Text style={[styles.timeVal, {color: colors.text}]}>7:00 PM</Text>
                  <Text style={[styles.timeLabel, {color: colors.mutedText}]}>End</Text>
                </View>
              </View>
            </View>

            {/* Who Controls It */}
            <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Text style={[styles.cardOverline, {color: colors.textSecondary}]}>WHO CONTROLS IT</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  style={[
                    styles.toggleBtn,
                    {backgroundColor: controller === 'me' ? colors.primary : colors.cardInner, borderColor: controller === 'me' ? colors.primary : colors.border},
                  ]}
                  onPress={() => setController('me')}>
                  <Text style={[styles.toggleText, {color: controller === 'me' ? colors.onPrimary : colors.mutedText}]}>Me</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.toggleBtn,
                    {backgroundColor: controller === 'parent' ? colors.primary : colors.cardInner, borderColor: controller === 'parent' ? colors.primary : colors.border},
                  ]}
                  onPress={() => setController('parent')}>
                  <Text style={[styles.toggleText, {color: controller === 'parent' ? colors.onPrimary : colors.mutedText}]}>My parent</Text>
                </Pressable>
              </View>
            </View>

            {/* Stays Open vs Paused Chips */}
            <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Text style={[styles.cardOverline, {color: colors.success}]}>STAYS OPEN</Text>
              <View style={styles.chipsRow}>
                <View style={[styles.chipGreen, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M4 12.5l5 5L20 6.5" />
                  </Svg>
                  <Text style={[styles.chipTextGreen, {color: colors.success}]}>ZerebroKid</Text>
                </View>
                <View style={[styles.chipGreen, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M4 12.5l5 5L20 6.5" />
                  </Svg>
                  <Text style={[styles.chipTextGreen, {color: colors.success}]}>Search</Text>
                </View>
                <View style={[styles.chipGreen, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M4 12.5l5 5L20 6.5" />
                  </Svg>
                  <Text style={[styles.chipTextGreen, {color: colors.success}]}>Calls</Text>
                </View>
              </View>

              <Text style={[styles.cardOverline, {color: colors.accent, marginTop: 12}]}>PAUSED</Text>
              <View style={styles.chipsRow}>
                <View style={[styles.chipOrange, {backgroundColor: 'rgba(255,122,26,0.14)'}]}>
                  <Text style={[styles.chipTextOrange, {color: colors.accent}]}>Social apps</Text>
                </View>
                <View style={[styles.chipOrange, {backgroundColor: 'rgba(255,122,26,0.14)'}]}>
                  <Text style={[styles.chipTextOrange, {color: colors.accent}]}>Video apps</Text>
                </View>
                <View style={[styles.chipOrange, {backgroundColor: 'rgba(255,122,26,0.14)'}]}>
                  <Text style={[styles.chipTextOrange, {color: colors.accent}]}>Games</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <SafeAreaView edges={['bottom']} style={[styles.stickyBottomSafeArea, {backgroundColor: colors.navBg}]}>
            <View style={[styles.stickyBottomBar, {backgroundColor: colors.navBg, borderTopColor: colors.border}]}>
              <Pressable style={[styles.startFocusCta, {backgroundColor: colors.primary}]} onPress={() => setFocusState('active')}>
                <Text style={[styles.startFocusText, {color: colors.onPrimary}]}>Start focus — 60 min</Text>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12h14M13 6l6 6-6 6" />
                </Svg>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      ) : focusState === 'active' ? (
        /* ================= ACTIVE COUNTDOWN STATE ================= */
        <SafeAreaView style={[styles.rootDark, {backgroundColor: colors.bg}]} edges={['top', 'bottom']}>
          <View style={styles.demoStateRowDark}>
            {(['setup', 'active', 'parent_locked'] as FocusState[]).map(st => {
              const isActive = focusState === st;
              return (
                <Pressable
                  key={st}
                  style={[
                    styles.demoChipDark,
                    {backgroundColor: isActive ? colors.primary : colors.surfaceAlt, borderColor: isActive ? colors.primary : colors.border},
                  ]}
                  onPress={() => setFocusState(st)}>
                  <Text style={[styles.demoChipTextDark, {color: isActive ? colors.onPrimary : colors.mutedText}]}>
                    {st.replace('_', ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.activeCenterCol}>
            <Text style={[styles.focusOverline, {color: colors.textAccentMuted}]}>FOCUS MODE IS ON</Text>

            {/* Countdown Ring */}
            <View style={styles.timerRingWrap}>
              <Svg width={220} height={220} viewBox="0 0 80 80">
                <Circle cx={40} cy={40} r={34} fill="none" stroke={colors.surfaceAlt} strokeWidth={5} />
                <Circle
                  cx={40}
                  cy={40}
                  r={34}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={213.63}
                  strokeDashoffset={85.45}
                  transform="rotate(-90 40 40)"
                />
              </Svg>
              <View style={styles.timerTextWrap}>
                <Text style={[styles.countdownBigText, {color: colors.text}]}>36:20</Text>
                <Text style={[styles.countdownSubText, {color: colors.mutedText}]}>left of 60 min</Text>
              </View>
            </View>

            {/* Mission Progress Card */}
            <View style={[styles.activeMissionCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
              <View style={[styles.bookIconChip, {backgroundColor: colors.badgeBg}]}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" />
                  <Path d="M8 3v18" />
                </Svg>
              </View>
              <View style={styles.activeMissionTextCol}>
                <Text style={[styles.activeMissionTitle, {color: colors.text}]}>Today's mission · 3 of 7</Text>
                <View style={[styles.trackBar, {backgroundColor: colors.cardInner}]}>
                  <View style={[styles.fillBar, {width: '43%', backgroundColor: colors.primary}]} />
                </View>
              </View>
            </View>

            {/* Paused Apps Badge */}
            <View style={[styles.pausedBadgeRow, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFD84D" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={4} y={10} width={16} height={11} rx={2} />
                <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </Svg>
              <Text style={[styles.pausedBadgeText, {color: colors.mutedText}]}>14 apps paused</Text>
            </View>

            <Pressable style={[styles.emergencyBtn, {borderColor: colors.border}]} onPress={() => setFocusState('setup')}>
              <Text style={[styles.emergencyBtnText, {color: colors.mutedText}]}>Emergency exit</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : (
        /* ================= PARENT LOCKED STATE ================= */
        <SafeAreaView style={[styles.rootDark, {backgroundColor: colors.bg}]} edges={['top', 'bottom']}>
          <View style={styles.demoStateRowDark}>
            {(['setup', 'active', 'parent_locked'] as FocusState[]).map(st => {
              const isActive = focusState === st;
              return (
                <Pressable
                  key={st}
                  style={[
                    styles.demoChipDark,
                    {backgroundColor: isActive ? colors.primary : colors.surfaceAlt, borderColor: isActive ? colors.primary : colors.border},
                  ]}
                  onPress={() => setFocusState(st)}>
                  <Text style={[styles.demoChipTextDark, {color: isActive ? colors.onPrimary : colors.mutedText}]}>
                    {st.replace('_', ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.activeCenterCol}>
            <View style={[styles.bigLockBadge, {backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder}]}>
              <Svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={4} y={10} width={16} height={11} rx={2} />
                <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </Svg>
            </View>

            <Text style={[styles.lockedMainTitle, {color: colors.text}]}>
              Focus is on until today's topic is done
            </Text>
            <Text style={[styles.lockedSubText, {color: colors.mutedText}]}>
              Set by your parent. Finish the mission and everything opens — no waiting for a clock.
            </Text>

            {/* Path Out Card */}
            <View style={[styles.pathOutCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
              <Text style={[styles.pathOutOverline, {color: colors.textAccentMuted}]}>YOUR PATH OUT</Text>
              <View style={styles.pathStepRow}>
                <View style={[styles.stepCheckDone, {backgroundColor: colors.success}]}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M4 12.5l5 5L20 6.5" />
                  </Svg>
                </View>
                <Text style={[styles.pathStepTextDone, {color: colors.textSecondary}]}>Sections 1–3</Text>
              </View>

              <View style={styles.pathStepRow}>
                <View style={[styles.stepNumCurrent, {backgroundColor: colors.primary}]}>
                  <Text style={[styles.stepNumCurrentText, {color: colors.onPrimary}]}>4</Text>
                </View>
                <Text style={[styles.pathStepTextCurrent, {color: colors.text}]}>Curiosity · you are here</Text>
              </View>

              <View style={styles.pathStepRow}>
                <View style={[styles.stepDotLocked, {backgroundColor: colors.cardInner}]} />
                <Text style={[styles.pathStepTextLocked, {color: colors.mutedText}]}>Sections 5–7 and the quiz</Text>
              </View>
            </View>

            <Pressable
              style={[styles.startFocusCta, {backgroundColor: colors.primary}]}
              onPress={() => navigation.navigate('SubjectList')}>
              <Text style={[styles.startFocusText, {color: colors.onPrimary}]}>Continue — Section 4</Text>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12h14M13 6l6 6-6 6" />
              </Svg>
            </Pressable>

            <Pressable style={styles.messageParentBtn}>
              <Text style={[styles.messageParentText, {color: colors.textAccentMuted}]}>Message my parent</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootDark: {
    flex: 1,
  },
  setupContainer: {
    flex: 1,
  },
  setupHeaderSafe: {
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.pagePad,
    paddingVertical: 14,
    gap: spacing.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: '700',
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  demoChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
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
  timeWindowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    padding: 14,
    borderRadius: 16,
  },
  timeVal: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
  },
  timeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
  },
  chipTextGreen: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  chipOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
  },
  chipTextOrange: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
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
  startFocusCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.pill,
    width: '100%',
  },
  startFocusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },

  /* ACTIVE & LOCKED STYLES */
  demoStateRowDark: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  demoChipDark: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  demoChipTextDark: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
  },
  activeCenterCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: spacing.pagePad,
  },
  focusOverline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timerRingWrap: {
    width: 220,
    height: 220,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTextWrap: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
  },
  countdownBigText: {
    fontFamily: fonts.mono,
    fontSize: 48,
    lineHeight: 50,
    fontWeight: '700',
  },
  countdownSubText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  activeMissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 320,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  bookIconChip: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeMissionTextCol: {
    flex: 1,
    gap: 6,
  },
  activeMissionTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  trackBar: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fillBar: {
    height: 6,
    borderRadius: radius.pill,
  },
  pausedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 320,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  pausedBadgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  emergencyBtn: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },

  /* LOCKED SPECIFIC STYLES */
  bigLockBadge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedMainTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockedSubText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  pathOutCard: {
    width: '100%',
    maxWidth: 320,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
  },
  pathOutOverline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pathStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepCheckDone: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathStepTextDone: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  stepNumCurrent: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumCurrentText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  pathStepTextCurrent: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  stepDotLocked: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  pathStepTextLocked: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  messageParentBtn: {
    height: 44,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageParentText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
});
