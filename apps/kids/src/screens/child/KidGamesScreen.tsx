import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Circle, Defs, LinearGradient, Path, Rect, Stop} from 'react-native-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {JuniorStackParamList} from '../../navigation/types';
import {fonts, junior, neutral, radius, shadows, spacing} from '../../theme';

type Props = NativeStackScreenProps<JuniorStackParamList, 'KidGames'>;

const G_HERO_LEFT = require('../../assets/g-hero-left.png');
const G_HERO_RIGHT = require('../../assets/g-hero-right.png');

const BOYS_GAMES_ROW1 = [
  {id: '1', title: 'Sky Warrior', sub: 'Air Battle', image: require('../../assets/g-sky.png')},
  {id: '2', title: 'Turbo Drift', sub: 'Racing', image: require('../../assets/g-turbo.png')},
  {id: '3', title: 'Mountain Dash', sub: 'Offroad', image: require('../../assets/g-mountain.png')},
  {id: '4', title: 'Robot Rage', sub: 'Action', image: require('../../assets/g-robot.png')},
  {id: '5', title: 'Treasure Quest', sub: 'Adventure', image: require('../../assets/g-treasure.png')},
];

const BOYS_GAMES_ROW2 = [
  {id: '6', title: 'Ninja Run', sub: 'Endless Run', image: require('../../assets/g-ninja.png')},
  {id: '7', title: 'Splash Battle', sub: 'Water Fight', image: require('../../assets/g-splash.png')},
  {id: '8', title: 'Space Patrol', sub: 'Galaxy', image: require('../../assets/g-space.png')},
  {id: '9', title: 'Soccer Stars', sub: 'Sports', image: require('../../assets/g-soccer.png')},
  {id: '10', title: 'Dino Escape', sub: 'Adventure', image: require('../../assets/g-dino.png')},
];

const GIRLS_GAMES_ROW1 = [
  {id: '11', title: 'Makeover Magic', sub: 'Makeup', image: require('../../assets/g-makeover.png')},
  {id: '12', title: 'Sweet Chef', sub: 'Cooking', image: require('../../assets/g-sweetchef.png')},
  {id: '13', title: 'Baby Doctor', sub: 'Care', image: require('../../assets/g-babydoc.png')},
  {id: '14', title: 'Princess World', sub: 'Dress Up', image: require('../../assets/g-princess.png')},
  {id: '15', title: 'Pet Paradise', sub: 'Love & Care', image: require('../../assets/g-pet.png')},
];

const GIRLS_GAMES_ROW2 = [
  {id: '16', title: 'Fashion Studio', sub: 'Style', image: require('../../assets/g-fashion.png')},
  {id: '17', title: 'Ice Cream Craze', sub: 'Cooking', image: require('../../assets/g-icecream.png')},
  {id: '18', title: 'My Home Decor', sub: 'Decorate', image: require('../../assets/g-homedecor.png')},
  {id: '19', title: 'Unicorn Dream', sub: 'Adventure', image: require('../../assets/g-unicorn.png')},
  {id: '20', title: 'Art & Color', sub: 'Creativity', image: require('../../assets/g-artcolor.png')},
];

import {useAuthStore} from '../../state/authStore';

export function KidGamesScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const userDoc = useAuthStore(s => s.userDoc);
  const coins = (userDoc as any)?.coins ?? 240;
  const lives = (userDoc as any)?.lives ?? 3;
  const heartsText = `${lives}/10`;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {paddingBottom: 24 + insets.bottom}]}
        showsVerticalScrollIndicator={false}>
        {/* Games Hero */}
        <View style={styles.heroWrap}>
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#3A1B66" />
                <Stop offset="0.48" stopColor="#5B2A8F" />
                <Stop offset="1" stopColor="#2A1148" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroBg)" />
          </Svg>

          <Image source={G_HERO_LEFT} style={styles.heroImgLeft} resizeMode="cover" />
          <Image source={G_HERO_RIGHT} style={styles.heroImgRight} resizeMode="cover" />

          {/* Top Row: Back + Coins + Hearts */}
          <SafeAreaView edges={['top']} style={styles.topRow}>
            <Pressable
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              android_ripple={{color: 'rgba(0,0,0,0.1)', borderless: true, radius: 20}}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#3A1B66" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M15 5l-7 7 7 7" />
              </Svg>
            </Pressable>
            <View style={{flex: 1}} />
            <View style={styles.badgePill}>
              <View style={styles.badgeCoinIcon}>
                <Text style={styles.badgeCoinSym}>₹</Text>
              </View>
              <Text style={styles.badgeText}>{coins}</Text>
            </View>
            <View style={styles.badgePill}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FF4D6D">
                <Path d="M12 21s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.6 4.5 4.5 0 0 1 19.5 11c0 5.3-7.5 10-7.5 10z" />
              </Svg>
              <Text style={styles.badgeText}>{heartsText}</Text>
            </View>
          </SafeAreaView>

          {/* Center Lock Hero Content */}
          <View style={styles.heroCenter}>
            <View style={styles.lockBadge}>
              <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#E9D5FF" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={4} y={10} width={16} height={11} rx={3} />
                <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <Circle cx={12} cy={15} r={1.4} />
                <Path d="M12 16.6v1.4" />
              </Svg>
            </View>
            <Text style={styles.heroTitle}>Saare games kholo</Text>
            <Text style={styles.heroSub}>Ek baar pay karo, hamesha khelo</Text>
            
            <Pressable style={({pressed}) => [styles.btnUnlock, pressed && {transform: [{scale: 0.98}]}]}>
              <Text style={styles.btnUnlockText}>Pay ₹300 to unlock games</Text>
            </Pressable>

            <View style={styles.trustBadges}>
              <View style={styles.trustItem}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#C79BFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
                  <Path d="M9 12.5l2 2 4-4" />
                </Svg>
                <Text style={styles.trustText}>Safe</Text>
              </View>
              <View style={styles.trustItem}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FF7DB0" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Circle cx={12} cy={12} r={9} />
                  <Path d="M6 18L18 6" />
                </Svg>
                <Text style={styles.trustText}>No Ads</Text>
              </View>
              <View style={styles.trustItem}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="#FFD84D">
                  <Path d="M12 3l2.6 6.1 6.6.5-5 4.3 1.5 6.4L12 17l-5.7 3.3 1.5-6.4-5-4.3 6.6-.5z" />
                </Svg>
                <Text style={styles.trustText}>100+ Games</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 1: Boys ke games */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBox, {backgroundColor: '#1E3A8A'}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#7DB2FF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 9h12a4 4 0 0 1 4 4v2a3 3 0 0 1-3 3c-1.2 0-2.2-.6-2.8-1.6L15.5 15h-7l-.7 1.4A3.3 3.3 0 0 1 5 18a3 3 0 0 1-3-3v-2a4 4 0 0 1 4-4z" />
                <Path d="M8 12v3M6.5 13.5h3" />
              </Svg>
            </View>
            <Text style={[styles.sectionTitle, {color: '#7DB2FF'}]}>Boys ke games</Text>
            <View style={[styles.seeAllPill, {backgroundColor: '#2B3E7A'}]}>
              <Text style={styles.seeAllText}>See All</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 5l7 7-7 7" />
              </Svg>
            </View>
          </View>

          {/* Row 1 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railScroll}>
            {BOYS_GAMES_ROW1.map(g => (
              <GameCard key={g.id} game={g} />
            ))}
          </ScrollView>

          {/* Row 2 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railScroll}>
            {BOYS_GAMES_ROW2.map(g => (
              <GameCard key={g.id} game={g} />
            ))}
          </ScrollView>
        </View>

        {/* Section 2: Girls ke games */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBox, {backgroundColor: '#7A1F4B'}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FF9DC8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 12L5.5 8.5A2.8 2.8 0 0 1 8.5 4l3.5 8" />
                <Path d="M12 12l6.5-3.5A2.8 2.8 0 0 0 15.5 4L12 12z" />
                <Circle cx={12} cy={14} r={2.4} />
                <Path d="M9.5 21l2.5-4.6L14.5 21" />
              </Svg>
            </View>
            <Text style={[styles.sectionTitle, {color: '#FF9DC8'}]}>Girls ke games</Text>
            <View style={[styles.seeAllPill, {backgroundColor: '#7A1F4B'}]}>
              <Text style={styles.seeAllText}>See All</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 5l7 7-7 7" />
              </Svg>
            </View>
          </View>

          {/* Row 1 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railScroll}>
            {GIRLS_GAMES_ROW1.map(g => (
              <GameCard key={g.id} game={g} />
            ))}
          </ScrollView>

          {/* Row 2 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railScroll}>
            {GIRLS_GAMES_ROW2.map(g => (
              <GameCard key={g.id} game={g} />
            ))}
          </ScrollView>
        </View>

        {/* Bottom Banner */}
        <View style={styles.bottomBanner}>
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="bannerBg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#6D28D9" />
                <Stop offset="1" stopColor="#4C1D95" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#bannerBg)" />
          </Svg>
          <View style={styles.bannerIconBox}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#FFD84D" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Rect x={3} y={9} width={18} height={12} rx={2} />
              <Path d="M3 13.5h18M12 9v12" />
              <Path d="M12 9C9.8 9 7 8.2 7 6.6 7 5.2 9.4 4.4 12 9c2.6-4.6 5-3.8 5-2.4C17 8.2 14.2 9 12 9z" />
            </Svg>
          </View>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle}>Ek baar payment, unlimited games!</Text>
            <Text style={styles.bannerSub}>Pay ₹300 to unlock all games</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function GameCard({game}: {game: {id: string; title: string; sub: string; image: any}}) {
  return (
    <View style={styles.gameCard}>
      <Image source={game.image} style={styles.gameImg} resizeMode="cover" />
      <View style={styles.gameInfo}>
        <Text style={styles.gameTitle} numberOfLines={1}>{game.title}</Text>
        <Text style={styles.gameSub} numberOfLines={1}>{game.sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#120A24',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  heroWrap: {
    height: 312,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImgLeft: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 150,
    height: 250,
  },
  heroImgRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 150,
    height: 250,
  },
  topRow: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },
  badgeCoinIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCoinSym: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 12,
    color: '#8A5A00',
    top: 1,
  },
  badgeText: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 18,
    color: '#5B2A8F',
    top: 1,
  },
  heroCenter: {
    position: 'relative',
    zIndex: 2,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(160,110,255,0.28)',
    borderWidth: 2.5,
    borderColor: '#C79BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 30,
    lineHeight: 34,
    color: neutral.surface,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  heroSub: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 21,
    color: junior.yellowCoinBg,
  },
  btnUnlock: {
    height: 56,
    width: '100%',
    borderRadius: 28,
    backgroundColor: '#FFD24A',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.cta,
    marginTop: 2,
  },
  btnUnlockText: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 21,
    color: '#4A2B00',
  },
  trustBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 6,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: neutral.surface,
  },
  sectionWrap: {
    gap: 11,
    paddingTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: spacing.md,
  },
  sectionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fonts.headingExtraBold,
    fontSize: 20,
    color: neutral.surface,
  },
  seeAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: spacing.md12,
    borderRadius: radius.pill,
  },
  seeAllText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: neutral.surface,
  },
  railScroll: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },
  gameCard: {
    width: 122,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1E1744',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...shadows.card,
  },
  gameImg: {
    width: '100%',
    height: 76,
  },
  gameInfo: {
    paddingHorizontal: 9,
    paddingTop: spacing.sm,
    paddingBottom: 10,
    gap: 1,
  },
  gameTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 14,
    lineHeight: 17,
    color: neutral.surface,
  },
  gameSub: {
    fontFamily: fonts.heading,
    fontSize: 11,
    lineHeight: 14,
    color: neutral.ink300,
  },
  bottomBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md12,
    marginHorizontal: spacing.md,
    marginTop: 18,
    padding: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.cta,
  },
  bannerIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.chip,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextWrap: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 17,
    lineHeight: 21,
    color: neutral.surface,
  },
  bannerSub: {
    fontFamily: fonts.heading,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.82)',
  },
});
