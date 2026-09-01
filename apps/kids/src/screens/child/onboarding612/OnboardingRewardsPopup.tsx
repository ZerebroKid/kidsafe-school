/**
 * OnboardingRewardsPopup — First-launch popup (01 · POPUP 1 · rewards).
 *
 * Design: "Choose Your World" · V7 / F7 / Q7 / Classic POPUP 1.
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
import Svg, {Path} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import {fonts, radius, spacing} from '../../../theme';
import {useTheme} from '../../../context/ThemeContext';

interface OnboardingRewardsPopupProps {
  onContinue: () => void;
  onDismiss?: () => void;
  /** Dot index for carousel indicator (0 = this screen). */
  dotIndex?: number;
}

export function OnboardingRewardsPopup({
  onContinue,
  onDismiss,
  dotIndex = 0,
}: OnboardingRewardsPopupProps) {
  const {theme} = useTheme();
  const {colors} = theme;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      {/* Top Header */}
      <View style={[styles.header, {backgroundColor: colors.isDark ? colors.surfaceAlt : colors.primary}]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTopRow}>
            <Text style={[styles.headerTitle, {color: '#FFFFFF'}]}>
              Complete your today's topic and{' '}
              <Text style={{color: colors.isDark ? colors.primary : '#FFE9B8'}}>get rewards</Text>
            </Text>
            {onDismiss && (
              <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={8}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 6l12 12M18 6L6 18" />
                </Svg>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Scrollable body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>

        {/* Card 1 — New games */}
        <View style={[styles.rewardCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Image
            source={require('../../../assets/games.png')}
            style={styles.rewardImg}
            resizeMode="cover"
          />
          <View style={styles.rewardTextWrap}>
            <Text style={[styles.rewardTitle, {color: colors.text}]}>New games</Text>
            <Text style={[styles.rewardSub, {color: colors.mutedText}]}>
              Unlocked when today's topic is done.
            </Text>
          </View>
        </View>

        {/* Card 2 — New funny videos */}
        <View style={[styles.rewardCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Image
            source={require('../../../assets/videos.png')}
            style={styles.rewardImg}
            resizeMode="cover"
          />
          <View style={styles.rewardTextWrap}>
            <Text style={[styles.rewardTitle, {color: colors.text}]}>New funny videos</Text>
            <Text style={[styles.rewardSub, {color: colors.mutedText}]}>Fresh comedy every day.</Text>
          </View>
        </View>

        {/* Card 3 — Food at discounts */}
        <View style={[styles.rewardCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Image
            source={require('../../../assets/food.png')}
            style={styles.rewardImg}
            resizeMode="cover"
          />
          <View style={styles.rewardTextWrap}>
            <Text style={[styles.rewardTitle, {color: colors.text}]}>
              Get food delivered at home at special discounts
            </Text>
            <Text style={[styles.rewardSub, {color: colors.mutedText}]}>Study first. Enjoy food later.</Text>
          </View>
        </View>

        {/* Card 4 — Other products */}
        <View style={[styles.rewardCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Image
            source={require('../../../assets/products.png')}
            style={[styles.rewardImg, {height: 122}]}
            resizeMode="cover"
          />
          <View style={styles.rewardTextWrap}>
            <Text style={[styles.rewardTitle, {color: colors.text}]}>
              Get other products delivered at home at special discounts
            </Text>
            <Text style={[styles.rewardSub, {color: colors.mutedText}]}>
              Shoes, gadgets, books & more.
            </Text>
          </View>
        </View>

        {/* 3-Price Comparison Hero Box */}
        <View style={[styles.priceCompareBox, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
          <Text style={[styles.priceCompareOverline, {color: colors.textAccentMuted}]}>
            SAME ITEM · THREE PRICES
          </Text>

          <View style={styles.priceColumnsRow}>
            {/* Offline shop */}
            <View style={[styles.priceCol, {backgroundColor: colors.cardInner}]}>
              <Text style={[styles.priceColLabel, {color: colors.mutedText}]}>Offline shop</Text>
              <Text style={[styles.priceStrike, {color: colors.mutedText}]}>₹200</Text>
            </View>

            {/* Amazon / Zomato */}
            <View style={[styles.priceCol, {backgroundColor: colors.cardInner}]}>
              <Text style={[styles.priceColLabel, {color: colors.mutedText}]}>Amazon · Zomato</Text>
              <Text style={[styles.priceStrike, {color: colors.mutedText}]}>₹230</Text>
            </View>

            {/* Our app */}
            <View style={[styles.appPriceCol, {backgroundColor: colors.primary}]}>
              <Text style={[styles.appPriceColLabel, {color: colors.onPrimary}]}>Our app</Text>
              <Text style={[styles.appPriceColValue, {color: colors.onPrimary}]}>₹150</Text>
              <View style={[styles.savePill, {backgroundColor: colors.bg}]}>
                <Text style={[styles.savePillText, {color: colors.success}]}>You save ₹80</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.priceCompareDesc, {color: colors.textSecondary}]}>
            What costs <Text style={{fontWeight: '700', color: colors.text}}>₹200</Text> at an offline shop outside, and <Text style={{fontWeight: '700', color: colors.text}}>₹230</Text> on an online store like Zomato or Amazon — you get for only <Text style={{fontWeight: '700', color: colors.primary}}>₹150</Text> on our app.
          </Text>
        </View>

        {/* Carousel Dots */}
        <View style={styles.dotsRow}>
          <View style={[styles.dot, dotIndex === 0 ? [styles.dotActive, {backgroundColor: colors.primary}] : [styles.dotInactive, {backgroundColor: colors.surfaceAlt}]]} />
          <View style={[styles.dot, dotIndex === 1 ? [styles.dotActive, {backgroundColor: colors.primary}] : [styles.dotInactive, {backgroundColor: colors.surfaceAlt}]]} />
        </View>

        {/* Main CTA */}
        <Pressable
          style={({pressed}) => [
            styles.ctaBtn,
            {backgroundColor: colors.primary},
            pressed && styles.btnPressed,
          ]}
          onPress={onContinue}>
          <Text style={[styles.ctaBtnText, {color: colors.onPrimary}]}>
            Complete Today's Topic & Start Earning
          </Text>
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
  },
  headerTopRow: {
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rewardImg: {
    width: 132,
    height: 112,
  },
  rewardTextWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rewardTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  rewardSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  // 3-Price compare box
  priceCompareBox: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  priceCompareOverline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  priceColumnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  priceCol: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
  },
  priceColLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
    textAlign: 'center',
  },
  priceStrike: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  appPriceCol: {
    flex: 1.25,
    paddingVertical: 18,
    paddingHorizontal: 6,
    borderRadius: 18,
    alignItems: 'center',
    gap: 6,
  },
  appPriceColLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  appPriceColValue: {
    fontFamily: fonts.mono,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '700',
  },
  savePill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  priceCompareDesc: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
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
    alignItems: 'center',
    justifyContent: 'center',
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
