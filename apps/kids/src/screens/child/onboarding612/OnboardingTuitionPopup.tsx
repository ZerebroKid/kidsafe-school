/**
 * OnboardingTuitionPopup — Second-launch popup (02 · POPUP 2 · no tuition).
 *
 * Design: "Choose Your World" · V8 / F8 / Q8 / Classic POPUP 2.
 */

import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Path, Circle, Rect} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import {fonts, radius, spacing} from '../../../theme';
import {useTheme} from '../../../context/ThemeContext';

interface OnboardingTuitionPopupProps {
  onContinue: () => void;
  onDismiss?: () => void;
  /** Dot index for carousel indicator (1 = this screen). */
  dotIndex?: number;
}

export function OnboardingTuitionPopup({
  onContinue,
  onDismiss,
  dotIndex = 1,
}: OnboardingTuitionPopupProps) {
  const {theme} = useTheme();
  const {colors} = theme;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.isDark ? colors.surfaceAlt : colors.primary}]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, {color: '#FFFFFF'}]}>
              Same content as a coaching institute
            </Text>
            {onDismiss && (
              <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={8}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 6l12 12M18 6L6 18" />
                </Svg>
              </Pressable>
            )}
          </View>
          <Text style={[styles.headerSub, {color: colors.isDark ? colors.primary : '#EDE6FF'}]}>
            Now no need to spend <Text style={[styles.monoText, {color: colors.isDark ? colors.primary : '#FFE9B8'}]}>₹3,000</Text> on monthly tuition.
          </Text>
        </SafeAreaView>
      </View>

      {/* Scrollable body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>

        {/* Card 1 — Same content as coaching */}
        <View style={[styles.cardRow, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Image
            source={require('../../../assets/p2-teacher.png')}
            style={styles.cardImgLeft}
            resizeMode="cover"
          />
          <View style={styles.cardRowText}>
            <Text style={[styles.cardRowTitle, {color: colors.text}]}>
              We will give you the same content as coaching, here on our app
            </Text>
            <View style={styles.labelArrowRow}>
              <Text style={[styles.highlightLabel, {color: colors.textAccentMuted}]}>CLASSROOM</Text>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.textAccentMuted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12h14M13 6l6 6-6 6" />
              </Svg>
              <Text style={[styles.highlightLabel, {color: colors.textAccentMuted}]}>YOUR PHONE</Text>
            </View>
          </View>
        </View>

        {/* Card 2 — No travel / No sun */}
        <View style={[styles.cardCol, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[styles.cardColTitle, {color: colors.text}]}>
            No need to go outside in the sun and get tanned
          </Text>
          <View style={styles.travelContentRow}>
            <Image
              source={require('../../../assets/p2-sun.png')}
              style={styles.sunPhoto}
              resizeMode="cover"
            />
            <View style={styles.bulletsCol}>
              <View style={styles.bulletItem}>
                <View style={[styles.bulletIconBox, {backgroundColor: 'rgba(0,229,255,0.14)'}]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={12} r={8} />
                    <Path d="M12 8v4.6l3 1.8" />
                  </Svg>
                </View>
                <Text style={[styles.bulletText, {color: colors.textSecondary}]}>
                  Going and coming back wastes your time
                </Text>
              </View>

              <View style={styles.bulletItem}>
                <View style={[styles.bulletIconBox, {backgroundColor: 'rgba(255,176,32,0.16)'}]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFB020" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={12} r={4.5} />
                    <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
                  </Svg>
                </View>
                <Text style={[styles.bulletText, {color: colors.textSecondary}]}>
                  Staying in the sun damages your skin
                </Text>
              </View>

              <View style={styles.bulletItem}>
                <View style={[styles.bulletIconBox, {backgroundColor: 'rgba(255,46,147,0.16)'}]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FF2E93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Rect x={3} y={8} width={15} height={8} rx={2} />
                    <Path d="M18 10.5h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-2" />
                    <Path d="M6 11v2" />
                  </Svg>
                </View>
                <Text style={[styles.bulletText, {color: colors.textSecondary}]}>Travelling makes you tired</Text>
              </View>

              <View style={styles.bulletItem}>
                <View style={[styles.bulletIconBox, {backgroundColor: 'rgba(124,77,255,0.2)'}]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#B9A1FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={12} r={8} />
                    <Path d="M9.5 8.5h4a2 2 0 0 1 0 4h-4M9.5 12.5h3.2M9.5 16l3.5-3.5" />
                  </Svg>
                </View>
                <Text style={[styles.bulletText, {color: colors.textSecondary}]}>
                  And you still pay ₹3,000 every month for tuition
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Highlight Banner */}
        <View style={[styles.guaranteeBox, {backgroundColor: colors.primary}]}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={12} cy={12} r={9} />
            <Path d="M8 12.5l3 3 5.5-6" />
          </Svg>
          <Text style={[styles.guaranteeText, {color: colors.onPrimary}]}>
            So no more of all this — now this app gives you the same quality content you would get by going to any coaching institute.
          </Text>
        </View>

        {/* Card 3 — Sit in your room */}
        <View style={[styles.cardRow, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Image
            source={require('../../../assets/p2-room.png')}
            style={styles.cardImgLeft}
            resizeMode="cover"
          />
          <View style={styles.cardRowText}>
            <Text style={[styles.cardRowTitle, {color: colors.text}]}>
              Sit in your room and we will deliver everything required
            </Text>
          </View>
        </View>

        {/* 4 Delivery feature rows */}
        <View style={styles.featuresCol}>
          <View style={[styles.featureCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.featureImgWrap}>
              <Image source={require('../../../assets/p2-live.png')} style={styles.featureThumb} resizeMode="cover" />
              <View style={[styles.liveBadge, {backgroundColor: colors.accent}]}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={[styles.featureTitle, {color: colors.text}]}>Live classes</Text>
            <View style={[styles.comingSoonBadge, {backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder}]}>
              <Text style={[styles.comingSoonText, {color: colors.textAccentMuted}]}>COMING SOON</Text>
            </View>
          </View>

          <View style={[styles.featureCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.featureImgWrap}>
              <Image source={require('../../../assets/p2-recorded.png')} style={styles.featureThumb} resizeMode="cover" />
              <View style={styles.playIconOverlay}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill={colors.secondary}>
                  <Path d="M8 5l11 7-11 7z" />
                </Svg>
              </View>
            </View>
            <Text style={[styles.featureTitle, {color: colors.text}]}>Recorded lectures</Text>
          </View>

          <View style={[styles.featureCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <Image source={require('../../../assets/p2-notes.png')} style={styles.featureThumb} resizeMode="cover" />
            <Text style={[styles.featureTitle, {color: colors.text}]}>
              Notes from top coaching institute teachers
            </Text>
          </View>

          <View style={[styles.featureCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <Image source={require('../../../assets/p2-ebook.png')} style={styles.featureThumb} resizeMode="cover" />
            <Text style={[styles.featureTitle, {color: colors.text}]}>
              E-books from top coaching institutes
            </Text>
          </View>
        </View>

        {/* AI Doubt solver card */}
        <View style={[styles.aiDoubtCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <View style={styles.aiDoubtTop}>
            <Image source={require('../../../assets/p2-robot.png')} style={styles.robotThumb} resizeMode="cover" />
            <Text style={[styles.aiDoubtTitle, {color: colors.text}]}>
              An AI system that lets you ask any doubt from the middle of your lecture — as many times as you want
            </Text>
          </View>
          <View style={[styles.chatPreviewBox, {backgroundColor: colors.bg}]}>
            <View style={[styles.userBubble, {backgroundColor: colors.secondary}]}>
              <Text style={styles.userBubbleText}>Why is x the smallest number?</Text>
            </View>
            <View style={[styles.aiBubble, {backgroundColor: colors.cardInner}]}>
              <Text style={[styles.aiBubbleText, {color: colors.primary}]}>x + (x+1) + (x+2) = 72</Text>
            </View>
            <View style={styles.chatInputRow}>
              <View style={[styles.chatInputFake, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <Text style={[styles.chatInputText, {color: colors.navInactive}]}>Ask anything…</Text>
              </View>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={9} y={3} width={6} height={11} rx={3} />
                <Path d="M5 12a7 7 0 0 0 14 0M12 19v3" />
              </Svg>
            </View>
          </View>
        </View>

        {/* AI Exam Predictor */}
        <View style={[styles.aiPredictorCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
          <View style={[styles.comingPill, {backgroundColor: colors.primary}]}>
            <Text style={[styles.comingPillText, {color: colors.onPrimary}]}>COMING SOON</Text>
          </View>
          <View style={styles.predictorTop}>
            <Image source={require('../../../assets/p2-predictor.png')} style={styles.predictorThumb} resizeMode="cover" />
            <Text style={[styles.predictorDesc, {color: colors.text}]}>
              Before the exam, the AI system will collect your school's past exam papers and give you the questions most likely to come in the next exam
            </Text>
          </View>

          <View style={styles.stepsRow}>
            <View style={[styles.stepItem, {backgroundColor: 'rgba(255,255,255,0.06)'}]}>
              <Text style={[styles.stepLabel, {color: colors.textSecondary}]}>Past papers</Text>
            </View>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
            <View style={[styles.stepItem, {backgroundColor: 'rgba(255,255,255,0.06)'}]}>
              <Text style={[styles.stepLabel, {color: colors.textSecondary}]}>AI analysis</Text>
            </View>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
            <View style={[styles.stepItem, {backgroundColor: colors.primary}]}>
              <Text style={[styles.stepLabel, {color: colors.onPrimary, fontWeight: '700'}]}>Likely questions</Text>
            </View>
          </View>
        </View>

        {/* Carousel Dots */}
        <View style={styles.dotsRow}>
          <View style={[styles.dot, dotIndex === 0 ? [styles.dotActive, {backgroundColor: colors.primary}] : [styles.dotInactive, {backgroundColor: colors.surfaceAlt}]]} />
          <View style={[styles.dot, dotIndex === 1 ? [styles.dotActive, {backgroundColor: colors.primary}] : [styles.dotInactive, {backgroundColor: colors.surfaceAlt}]]} />
        </View>

        {/* CTA Button */}
        <Pressable
          style={({pressed}) => [
            styles.ctaBtn,
            {backgroundColor: colors.primary},
            pressed && styles.btnPressed,
          ]}
          onPress={onContinue}>
          <Text style={[styles.ctaBtnText, {color: colors.onPrimary}]}>Let's Start Learning</Text>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 5l7 7-7 7" />
          </Svg>
        </Pressable>

        <View style={{height: 24}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  monoText: {
    fontFamily: fonts.mono,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImgLeft: {
    width: 140,
    height: 118,
  },
  cardRowText: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  cardRowTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  labelArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  highlightLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  cardCol: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  cardColTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  travelContentRow: {
    flexDirection: 'row',
    gap: 14,
  },
  sunPhoto: {
    width: 128,
    height: 196,
    borderRadius: 16,
  },
  bulletsCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 22,
  },
  guaranteeText: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  featuresCol: {
    gap: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  featureImgWrap: {
    position: 'relative',
  },
  featureThumb: {
    width: 96,
    height: 64,
    borderRadius: 14,
  },
  liveBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 18,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  playIconOverlay: {
    position: 'absolute',
    left: 34,
    top: 18,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  comingSoonBadge: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  comingSoonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  aiDoubtCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  aiDoubtTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  robotThumb: {
    width: 96,
    height: 66,
    borderRadius: 14,
  },
  aiDoubtTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  chatPreviewBox: {
    padding: 12,
    borderRadius: 16,
    gap: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  userBubbleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    color: '#FFFFFF',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  aiBubbleText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  chatInputFake: {
    flex: 1,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chatInputText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  aiPredictorCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  comingPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  predictorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  predictorThumb: {
    width: 96,
    height: 78,
    borderRadius: 14,
  },
  predictorDesc: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    alignItems: 'center',
  },
  stepLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
  },
  dotInactive: {
    width: 6,
  },
  ctaBtn: {
    height: 56,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  ctaBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
});
