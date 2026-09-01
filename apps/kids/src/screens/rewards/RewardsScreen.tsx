/**
 * RewardsScreen — Class 6–12 Rewards View.
 *
 * Design: "Choose Your World" · V6 / F6 / Q6 / Classic REWARDS.
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

import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';

type FilterType = 'Food' | 'Games' | 'Videos' | 'Shopping';

export function RewardsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('Food');
  const {theme} = useTheme();
  const {colors, images} = theme;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Top Header Banner */}
      <View style={[styles.headerBanner, {backgroundColor: colors.isDark ? colors.surfaceAlt : colors.primary}]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTopRow}>
            <Text style={[styles.headerTitle, {color: '#FFFFFF'}]}>Rewards</Text>
            <View style={[styles.unlockedBadge, {backgroundColor: colors.isDark ? colors.badgeBg : 'rgba(255,255,255,0.22)', borderColor: colors.isDark ? colors.badgeBorder : 'rgba(255,255,255,0.4)'}]}>
              <Text style={[styles.unlockedBadgeText, {color: colors.isDark ? colors.textAccentMuted : '#FFFFFF'}]}>
                Unlocked today
              </Text>
            </View>
          </View>
          <Text style={[styles.headerSub, {color: colors.isDark ? colors.textSecondary : 'rgba(255,255,255,0.85)'}]}>
            Today's topic and quiz are done — these are open for you.
          </Text>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Filter Chips Bar */}
        <View style={styles.filterWrap}>
          {(['Food', 'Games', 'Videos', 'Shopping'] as FilterType[]).map(f => {
            const isActive = activeFilter === f;
            return (
              <Pressable
                key={f}
                style={[
                  styles.filterChip,
                  isActive
                    ? {
                        backgroundColor: colors.badgeBg,
                        borderColor: colors.primary,
                      }
                    : {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                ]}
                onPress={() => setActiveFilter(f)}>
                <Text
                  style={[
                    styles.filterChipText,
                    isActive
                      ? {color: colors.textAccentMuted, fontWeight: '600'}
                      : {color: colors.mutedText, fontWeight: '500'},
                  ]}>
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Section: Food near you */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Food near you</Text>
            <View style={[styles.livePartnerBadge, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
              <Text style={[styles.livePartnerText, {color: colors.success}]}>Live partner</Text>
            </View>
          </View>

          {/* Burger meal card */}
          <View style={[styles.foodCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <Image
              source={require('../../assets/food.png')}
              style={styles.foodImg}
              resizeMode="cover"
            />
            <View style={styles.foodCardBody}>
              <View style={styles.foodTextWrap}>
                <Text style={[styles.restaurantName, {color: colors.textAccentMuted}]}>
                  Marina Restaurant
                </Text>
                <Text style={[styles.foodTitle, {color: colors.text}]}>
                  Burger meal with fries & drink
                </Text>
                <Text style={[styles.foodDistance, {color: colors.mutedText}]}>
                  Delivered · 2.4 km away
                </Text>
              </View>

              {/* 3 Price comparison boxes */}
              <View style={styles.priceBoxesRow}>
                <View style={[styles.priceBox, {backgroundColor: colors.cardInner}]}>
                  <Text style={[styles.priceBoxLabel, {color: colors.mutedText}]}>Shop</Text>
                  <Text style={[styles.priceBoxStrike, {color: colors.mutedText}]}>₹200</Text>
                </View>
                <View style={[styles.priceBox, {backgroundColor: colors.cardInner}]}>
                  <Text style={[styles.priceBoxLabel, {color: colors.mutedText}]}>Online</Text>
                  <Text style={[styles.priceBoxStrike, {color: colors.mutedText}]}>₹230</Text>
                </View>
                <View style={[styles.appPriceBox, {backgroundColor: colors.primary}]}>
                  <Text style={[styles.appPriceLabel, {color: colors.onPrimary}]}>Our app</Text>
                  <Text style={[styles.appPriceValue, {color: colors.onPrimary}]}>₹150</Text>
                </View>
              </View>

              {/* CTA button */}
              <Pressable
                style={({pressed}) => [
                  styles.redeemBtn,
                  {backgroundColor: colors.primary},
                  pressed && styles.btnPressed,
                ]}>
                <Text style={[styles.redeemBtnText, {color: colors.onPrimary}]}>
                  Redeem now · save ₹80
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Section: Play & watch */}
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Play & watch</Text>

          {/* Games Card */}
          <Pressable style={[styles.heroRewardCard, {borderColor: colors.border}]}>
            <Image source={images.rewardGames} style={styles.heroRewardImg} resizeMode="cover" />
            <View style={[styles.heroRewardOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.72)' : 'rgba(0,0,0,0.4)'}]} />
            <View style={styles.heroRewardContent}>
              <Text style={[styles.heroRewardTitle, {color: '#FFFFFF'}]}>Games</Text>
              <View style={styles.openNowRow}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Rect x={4} y={10} width={16} height={11} rx={2} />
                  <Path d="M8 10V7a4 4 0 0 1 7.6-1.6" />
                </Svg>
                <Text style={[styles.openNowText, {color: colors.success}]}>Open now</Text>
              </View>
            </View>
          </Pressable>

          {/* Videos Card */}
          <Pressable style={[styles.heroRewardCard, {borderColor: colors.border}]}>
            <Image source={images.rewardVideos} style={styles.heroRewardImg} resizeMode="cover" />
            <View style={[styles.heroRewardOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.72)' : 'rgba(0,0,0,0.4)'}]} />
            <View style={styles.heroRewardContent}>
              <Text style={[styles.heroRewardTitle, {color: '#FFFFFF'}]}>Funny videos</Text>
              <View style={styles.openNowRow}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Rect x={4} y={10} width={16} height={11} rx={2} />
                  <Path d="M8 10V7a4 4 0 0 1 7.6-1.6" />
                </Svg>
                <Text style={[styles.openNowText, {color: colors.success}]}>Open now</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Section: Clothing & products */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Clothing & products</Text>
            <View style={[styles.openingSoonBadge, {backgroundColor: colors.badgeBg}]}>
              <Text style={[styles.openingSoonText, {color: colors.textAccentMuted}]}>Opening soon</Text>
            </View>
          </View>

          <View style={styles.productsGrid}>
            {/* Headphones */}
            <View style={[styles.productCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <View style={styles.productImgWrap}>
                <Image source={require('../../assets/tile2.png')} style={styles.productImg} resizeMode="cover" />
                <View style={styles.lockIconTop}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Rect x={4} y={10} width={16} height={11} rx={2} />
                    <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </Svg>
                </View>
              </View>
              <View style={styles.productCardBody}>
                <Text style={[styles.productName, {color: colors.mutedText}]}>Headphones</Text>
                <Text style={[styles.productSub, {color: colors.navInactive}]}>Coming to your city</Text>
              </View>
            </View>

            {/* Sports shoes */}
            <View style={[styles.productCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <View style={styles.productImgWrap}>
                <Image source={require('../../assets/tile5.png')} style={styles.productImg} resizeMode="cover" />
                <View style={styles.lockIconTop}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Rect x={4} y={10} width={16} height={11} rx={2} />
                    <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </Svg>
                </View>
              </View>
              <View style={styles.productCardBody}>
                <Text style={[styles.productName, {color: colors.mutedText}]}>Sports shoes</Text>
                <Text style={[styles.productSub, {color: colors.navInactive}]}>Coming to your city</Text>
              </View>
            </View>
          </View>
        </View>

        {/* City Info Banner */}
        <View
          style={[
            styles.cityInfoBanner,
            {
              backgroundColor: colors.badgeBg,
              borderColor: colors.badgeBorder,
            },
          ]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={12} cy={12} r={9} />
            <Path d="M12 16v-4M12 8h.01" />
          </Svg>
          <Text style={[styles.cityInfoText, {color: colors.textSecondary}]}>
            More shops are joining as more students in your city complete missions. Keep going — new rewards unlock for everyone.
          </Text>
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
  headerBanner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  unlockedBadge: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockedBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  headerSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 18,
  },
  filterWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },

  // Sections
  sectionWrap: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  livePartnerBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePartnerText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  openingSoonBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openingSoonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
  },

  // Food Card
  foodCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  foodImg: {
    width: '100%',
    height: 140,
  },
  foodCardBody: {
    padding: 16,
    gap: 12,
  },
  foodTextWrap: {
    gap: 3,
  },
  restaurantName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  foodTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  foodDistance: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  priceBoxesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  priceBox: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    gap: 3,
  },
  priceBoxLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  priceBoxStrike: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  appPriceBox: {
    flex: 1.2,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    gap: 3,
  },
  appPriceLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  appPriceValue: {
    fontFamily: fonts.mono,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
  },
  redeemBtn: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },

  // Hero reward banner card (Games / Videos)
  heroRewardCard: {
    height: 104,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  heroRewardImg: {
    width: '100%',
    height: 104,
    position: 'absolute',
  },
  heroRewardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroRewardContent: {
    paddingHorizontal: 16,
    gap: 3,
  },
  heroRewardTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: '700',
  },
  openNowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  openNowText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },

  // Products Grid
  productsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  productCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    opacity: 0.75,
  },
  productImgWrap: {
    position: 'relative',
    height: 100,
  },
  productImg: {
    width: '100%',
    height: 100,
  },
  lockIconTop: {
    position: 'absolute',
    left: 8,
    top: 8,
  },
  productCardBody: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  productName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  productSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
  },

  // City Info Banner
  cityInfoBanner: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 18,
    borderWidth: 1,
  },
  cityInfoText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
});
