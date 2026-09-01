import React from 'react';
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useChildProfile} from '../../context/ChildProfileContext';
import {fonts, junior, neutral, radius, shadows, spacing} from '../../theme';
import type {JuniorStackParamList} from '../../navigation/types';

import {useAuthStore} from '../../state/authStore';

const KID_HERO = require('../../assets/kid-hero.png');
const KID_FUN = require('../../assets/kid-fun.png');
const KID_CARTOONS = require('../../assets/kid-cartoons.png');
const KID_REELS = require('../../assets/kid-reels.png');
const KID_GAMES = require('../../assets/kid-games.png');

type Props = NativeStackScreenProps<JuniorStackParamList, 'KidHome'>;

export function KidHomeScreen({navigation}: Props) {
  const {childName} = useChildProfile();
  const userDoc = useAuthStore(s => s.userDoc);
  const coins = (userDoc as any)?.coins ?? 240;
  const lives = (userDoc as any)?.lives ?? 3;
  const heartsText = `${lives}/10`;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Background Sparkles */}
      <Sparkle style={{top: 120, right: 34, width: 10, height: 10}} />
      <Sparkle style={{top: 210, left: 30, width: 12, height: 12}} />
      <Sparkle style={{top: 290, right: 56, width: 9, height: 9}} />
      <Sparkle style={{top: 340, left: 60, width: 8, height: 8}} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Topbar */}
        <View style={styles.topbar}>
          <View style={styles.pill}>
            <View style={styles.coinBadge}>
              <Text style={styles.coinSym}>₹</Text>
            </View>
            <Text style={styles.pillText}>{coins}</Text>
          </View>
          <View style={styles.pill}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="#FF4D8D">
              <Path d="M12 21s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.6 4.5 4.5 0 0 1 19.5 11c0 5.3-7.5 10-7.5 10z" />
            </Svg>
            <Text style={styles.pillText}>{heartsText}</Text>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.heroWrap}>
          <Image source={KID_HERO} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.bubble}>
            <Text style={styles.bubbleTitle}>Hi {childName || 'Aalya'}!</Text>
            <Text style={styles.bubbleSub}>Kaise ho?</Text>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <HomeCard
              color="#F0921A"
              imageSrc={KID_FUN}
              title="Fun"
              subtitle="Play with Zumi"
              iconNode={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 9h12a4 4 0 0 1 4 4v2a3 3 0 0 1-3 3c-1.2 0-2.2-.6-2.8-1.6L15.5 15h-7l-.7 1.4A3.3 3.3 0 0 1 5 18a3 3 0 0 1-3-3v-2a4 4 0 0 1 4-4z" />
                  <Path d="M8 12v3M6.5 13.5h3M15.5 12h.01M17.5 14h.01" />
                </Svg>
              }
              onPress={() => navigation.navigate('ZumiHome')}
            />
            <HomeCard
              color="#E8407F"
              imageSrc={KID_CARTOONS}
              title="Cartoons"
              subtitle="Watch & giggle"
              iconNode={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="#FF0000">
                  <Path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8C22 15.2 22 12 22 12s0-3.2-.4-4.8z" />
                  <Path d="M10 15.5v-7l6 3.5z" fill="#fff" />
                </Svg>
              }
              onPress={() => navigation.navigate('KidCartoons')}
            />
          </View>
          <View style={styles.gridRow}>
            <HomeCard
              color="#5B3BE8"
              imageSrc={KID_REELS}
              title="Reels"
              subtitle="Cool clips"
              iconNode={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Rect x={3} y={3} width={18} height={18} rx={5} />
                  <Circle cx={12} cy={12} r={4} />
                  <Path d="M17.5 6.5h.01" />
                </Svg>
              }
              iconBgColor="#D62976"
              onPress={() => navigation.navigate('KidReels')}
            />
            <HomeCard
              color="#0E9E63"
              imageSrc={KID_GAMES}
              title="Games"
              subtitle="Win coins!"
              iconNode={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#12B76A" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M6 9h12a4 4 0 0 1 4 4v2a3 3 0 0 1-3 3c-1.2 0-2.2-.6-2.8-1.6L15.5 15h-7l-.7 1.4A3.3 3.3 0 0 1 5 18a3 3 0 0 1-3-3v-2a4 4 0 0 1 4-4z" />
                  <Path d="M8 12v3M6.5 13.5h3M15.5 12h.01M17.5 14h.01" />
                </Svg>
              }
              onPress={() => navigation.navigate('KidGames')}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Sparkle({style}: {style: any}) {
  return (
    <View style={[styles.sparkle, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 24 24" fill="#FFD84D">
        <Path d="M12 0L14.64 9.36L24 12L14.64 14.64L12 24L9.36 14.64L0 12L9.36 9.36L12 0Z" />
      </Svg>
    </View>
  );
}

function HomeCard({
  color,
  imageSrc,
  iconNode,
  iconBgColor = '#FFFFFF',
  title,
  subtitle,
  onPress,
}: {
  color: string;
  imageSrc: any;
  iconNode: React.ReactNode;
  iconBgColor?: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.cardWrap}>
      <Pressable
        onPress={() => onPress?.()}
        android_ripple={{color: 'rgba(255,255,255,0.25)'}}
        style={({pressed}) => [
          styles.card,
          {backgroundColor: color},
          pressed && styles.cardPressed,
        ]}>
        <Image source={imageSrc} style={styles.cardImg} resizeMode="cover" />

        <View style={[styles.cardIconBox, {backgroundColor: iconBgColor}]}>
          {iconNode}
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: junior.bgHome,
  },
  sparkle: {
    position: 'absolute',
  },
  safe: {
    flex: 1,
  },
  topbar: {
    flexDirection: 'row',
    gap: spacing.md12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md12,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: neutral.surface,
    ...shadows.card,
  },
  coinBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: junior.yellowCoinBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinSym: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 14,
    color: junior.yellowCoinText,
    top: 1,
  },
  pillText: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 22,
    color: junior.purplePillText,
    top: 1,
  },
  heroWrap: {
    height: 348,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: junior.bgHome,
    marginVertical: spacing.xs,
  },
  heroImg: {
    width: '100%',
    height: 348,
    position: 'absolute',
  },
  bubble: {
    position: 'absolute',
    left: spacing.md12,
    bottom: 34,
    zIndex: 2,
    width: 116,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderBottomLeftRadius: spacing.xs,
    backgroundColor: neutral.surface,
    ...shadows.cardMd,
  },
  bubbleTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 21,
    lineHeight: 24,
    color: junior.textHeaderDark,
  },
  bubbleSub: {
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 19,
    color: '#3B2E6E',
  },
  grid: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: spacing.md12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md12,
  },
  cardWrap: {
    flex: 1,
  },
  card: {
    height: 191,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadows.cardMd,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardImg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  cardIconBox: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neutral.surface,
  },
  cardBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md12,
    paddingTop: 34,
    paddingBottom: spacing.md12,
  },
  cardTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 24,
    lineHeight: 27,
    color: neutral.surface,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 6,
  },
  cardSubtitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 5,
  },
});
