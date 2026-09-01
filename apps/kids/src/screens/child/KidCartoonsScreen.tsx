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
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {JuniorStackParamList} from '../../navigation/types';
import {fonts, junior, neutral, radius, shadows, spacing} from '../../theme';

type Props = NativeStackScreenProps<JuniorStackParamList, 'KidCartoons'>;

const KID_CARTOONS = require('../../assets/kid-cartoons.png');

const CATEGORIES = ['All', 'Funny', 'Stories', 'Rhymes'];
const VIDEOS = [
  {id: '1', title: 'Episode 1', color1: '#FFE0EE', color2: '#FFD0E4', iconColor: '#D6246A', text: '#C2185B'},
  {id: '2', title: 'Episode 2', color1: '#E0ECFF', color2: '#CFE0FF', iconColor: '#2F6BFF', text: '#1B4FD1'},
  {id: '3', title: 'Episode 3', color1: '#E4F7EC', color2: '#D0F0DE', iconColor: '#12B76A', text: '#0B7B48'},
  {id: '4', title: 'Episode 4', color1: '#FFF0D6', color2: '#FFE4B8', iconColor: '#F5A623', text: '#8A5A00'},
];

export function KidCartoonsScreen({navigation}: Props) {
  const [activeCat, setActiveCat] = useState('All');
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Top Bar – title row + filter tabs both on pink gradient header */}
      <View style={styles.headerWrap}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          {/* Row 1: back button + title */}
          <View style={styles.headerTop}>
            <Pressable
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              android_ripple={{color: 'rgba(255,255,255,0.2)', borderless: true, radius: 23}}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M15 5l-7 7 7 7" />
              </Svg>
            </Pressable>
            <Text style={styles.headerTitle}>Cartoons</Text>
          </View>

          {/* Row 2: filter pills – horizontal scroll, inside pink header */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}>
            {CATEGORIES.map(cat => {
              const isActive = activeCat === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setActiveCat(cat)}
                  style={[styles.filterPill, isActive ? styles.filterPillActive : styles.filterPillInactive]}>
                  <Text style={[styles.filterText, isActive ? styles.filterTextActive : styles.filterTextInactive]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: 20 + insets.bottom}]}
        showsVerticalScrollIndicator={false}>
        {/* Featured Hero */}
        <Pressable style={styles.heroCard}>
          <Image source={KID_CARTOONS} style={styles.heroImg} resizeMode="cover" />

          <View style={styles.heroPlayBtn}>
            <Svg width={34} height={34} viewBox="0 0 24 24" fill="#D6246A">
              <Path d="M8 5l11 7-11 7z" />
            </Svg>
          </View>

          <View style={styles.heroTime}>
            <Text style={styles.heroTimeText}>11:20</Text>
          </View>

          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroTitle}>Aaj ka naya episode</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>Sab cartoons</Text>

        <View style={styles.grid}>
          {VIDEOS.map(v => (
            <Pressable key={v.id} style={styles.gridItem}>
              <View style={[styles.thumb, {backgroundColor: v.color1}]}>
                <Text style={[styles.thumbLabel, {color: v.text}]}>YOUR CARTOON 16:9</Text>
                <View style={styles.thumbPlayBtn}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill={v.iconColor}>
                    <Path d="M8 5l11 7-11 7z" />
                  </Svg>
                </View>
              </View>
              <Text style={styles.gridTitle}>{v.title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: neutral.bgApp,
  },
  headerWrap: {
    backgroundColor: junior.pinkHeaderEnd,
  },
  headerSafe: {
    paddingTop: spacing.md12,
    paddingBottom: 18,
    gap: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md12,
    paddingHorizontal: spacing.md,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.headingExtraBold,
    fontSize: 28,
    lineHeight: 32,
    color: neutral.surface,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterPill: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: neutral.surface,
  },
  filterPillInactive: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  filterText: {
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  filterTextActive: {
    color: junior.pinkText,
  },
  filterTextInactive: {
    color: neutral.surface,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.pagePad,
    gap: spacing.md,
  },
  heroCard: {
    height: 200,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: neutral.ink700,
    ...shadows.cardMd,
  },
  heroImg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroPlayBtn: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -36,
    marginTop: -36,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.cardMd,
    paddingLeft: 4,
  },
  heroTime: {
    position: 'absolute',
    right: spacing.md12,
    bottom: spacing.md12,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTimeText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: neutral.surface,
  },
  heroTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: 34,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 20,
    lineHeight: 24,
    color: neutral.surface,
  },
  sectionTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 22,
    color: junior.textHeaderDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  gridItem: {
    width: '47%',
    gap: spacing.sm,
  },
  thumb: {
    height: 108,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.sm,
    ...shadows.card,
  },
  thumbLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  thumbPlayBtn: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  gridTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 21,
    color: junior.textHeaderDark,
  },
});
