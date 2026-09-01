/**
 * SubjectListScreen — Class 6–12 Subject List.
 *
 * Design: "Choose Your World" · V2 / F2 / Q2 / Classic SUBJECT LIST.
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
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  useChildClassId,
  useChapterMetaMap,
  useTodayAssignments,
} from '../../firebase/study';
import {useAuthStore} from '../../state/authStore';
import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'SubjectList'>;

type FilterType = 'All' | 'In progress' | 'Not started' | 'Mastered';

export function SubjectListScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const classState = useChildClassId(uid);
  const assignmentsState = useTodayAssignments(classState.data?.classId ?? null);
  useChapterMetaMap(assignmentsState.data);

  const assignments = assignmentsState.data ?? [];
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const {theme} = useTheme();
  const {colors, images} = theme;

  const onSubjectPress = (subjName: string) => {
    navigation.navigate('SubjectDetail', {
      subjectName: subjName,
      subjectLabel: subjName,
    });
  };

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <SafeAreaView edges={['top']} style={[styles.safeTop, {backgroundColor: colors.bg}]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Study</Text>
          <Pressable hitSlop={8} style={styles.searchBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={11} cy={11} r={6} />
              <Path d="M15.5 15.5L21 21" />
            </Svg>
          </Pressable>
        </View>

        {/* Filter Chips Row */}
        <View style={styles.filterRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            {(['All', 'In progress', 'Not started', 'Mastered'] as FilterType[]).map(f => {
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
          </ScrollView>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>

        {/* Card 1: Today's Subject (Mathematics) */}
        <Pressable
          style={({pressed}) => [
            styles.todaySubjectCard,
            {
              borderColor: colors.primary,
              shadowColor: colors.primary,
            },
            pressed && styles.cardPressed,
          ]}
          onPress={() => onSubjectPress('Mathematics')}>
          <View style={styles.todayBannerBox}>
            <Image source={images.subjectMaths} style={styles.todayBannerImg} resizeMode="cover" />
            <View style={[styles.todayOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.65)' : 'rgba(0,0,0,0.35)'}]} />
            {/* TODAY pill */}
            <View style={[styles.todayPill, {backgroundColor: colors.primary}]}>
              <Text style={[styles.todayPillText, {color: colors.onPrimary}]}>TODAY</Text>
            </View>
            <View style={styles.todayBannerBottom}>
              <View style={styles.todayTitleCol}>
                <Text style={[styles.todaySubjectTitle, {color: '#FFFFFF'}]}>Mathematics</Text>
                <Text style={[styles.todaySubjectSub, {color: '#C9C2E0'}]}>4 of 12 chapters done</Text>
              </View>
              <Text style={[styles.todayPctText, {color: colors.textAccentMuted}]}>43%</Text>
            </View>
          </View>
          <View style={[styles.todayBottomRow, {backgroundColor: colors.surface}]}>
            <Text style={[styles.todayTopicTitle, {color: colors.textSecondary}]}>
              {assignments[0]?.topicName || 'Word Problems on Linear Equations'}
            </Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
          </View>
        </Pressable>

        {/* Card 2: Science */}
        <Pressable
          style={({pressed}) => [
            styles.subjectHeroCard,
            {borderColor: colors.border},
            pressed && styles.cardPressed,
          ]}
          onPress={() => onSubjectPress('Science')}>
          <Image source={images.subjectScience} style={styles.subjectHeroImg} resizeMode="cover" />
          <View style={[styles.subjectHeroOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.65)' : 'rgba(0,0,0,0.35)'}]} />
          <View style={styles.subjectHeroContent}>
            <View style={styles.subjectHeroTextCol}>
              <Text style={[styles.subjectHeroTitle, {color: '#FFFFFF'}]}>Science</Text>
              <Text style={[styles.subjectHeroSub, {color: colors.textSecondary}]}>Next: Force and Pressure</Text>
            </View>
            <Text style={[styles.subjectHeroPct, {color: colors.success}]}>70%</Text>
          </View>
        </Pressable>

        {/* Card 3: English */}
        <Pressable
          style={({pressed}) => [
            styles.subjectHeroCard,
            {borderColor: colors.border},
            pressed && styles.cardPressed,
          ]}
          onPress={() => onSubjectPress('English')}>
          <Image source={images.subjectEnglish} style={styles.subjectHeroImg} resizeMode="cover" />
          <View style={[styles.subjectHeroOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.65)' : 'rgba(0,0,0,0.35)'}]} />
          <View style={styles.subjectHeroContent}>
            <View style={styles.subjectHeroTextCol}>
              <Text style={[styles.subjectHeroTitle, {color: '#FFFFFF'}]}>English</Text>
              <Text style={[styles.subjectHeroSub, {color: colors.textSecondary}]}>Next: The Tsunami — Ch 2</Text>
            </View>
            <Text style={[styles.subjectHeroPct, {color: colors.accent}]}>25%</Text>
          </View>
        </Pressable>

        {/* Card 4: Hindi (Completed) */}
        <Pressable
          style={({pressed}) => [
            styles.completedSubjectCard,
            {backgroundColor: colors.surface, borderColor: colors.border},
            pressed && styles.cardPressed,
          ]}
          onPress={() => onSubjectPress('Hindi')}>
          <View style={[styles.checkIconBox, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 12.5l5 5L20 6.5" />
            </Svg>
          </View>
          <View style={styles.completedTextCol}>
            <Text style={[styles.completedTitle, {color: colors.text}]}>Hindi</Text>
            <Text style={[styles.completedSub, {color: colors.success}]}>
              All assigned chapters complete
            </Text>
          </View>
        </Pressable>

        {/* Card 5: Social Science (Locked) */}
        <View
          style={[
            styles.lockedSubjectCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderDashed,
            },
          ]}>
          <View style={styles.lockedHeaderRow}>
            <View style={[styles.lockIconBox, {backgroundColor: colors.cardInner}]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.navInactive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={4} y={10} width={16} height={11} rx={2} />
                <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </Svg>
            </View>
            <View style={styles.completedTextCol}>
              <Text style={[styles.lockedTitle, {color: colors.mutedText}]}>Social Science</Text>
              <Text style={[styles.lockedSub, {color: colors.navInactive}]}>Not assigned yet</Text>
            </View>
          </View>
          <View style={[styles.lockedTipBox, {backgroundColor: colors.surfaceAlt}]}>
            <Text style={[styles.lockedTipText, {color: colors.mutedText}]}>
              Unlocks when your teacher assigns it in class.
            </Text>
          </View>
        </View>

        <View style={{height: 24}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeTop: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.pagePad,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  searchBtn: {
    padding: 4,
  },
  filterRowWrap: {
    paddingBottom: 14,
  },
  filterRow: {
    paddingHorizontal: spacing.pagePad,
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing.pagePad,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 14,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{scale: 0.99}],
  },

  // Today's subject banner card
  todaySubjectCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  todayBannerBox: {
    position: 'relative',
    height: 120,
  },
  todayBannerImg: {
    width: '100%',
    height: 120,
  },
  todayOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  todayPill: {
    position: 'absolute',
    left: 14,
    top: 12,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  todayBannerBottom: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  todayTitleCol: {
    flex: 1,
    gap: 2,
  },
  todaySubjectTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  todaySubjectSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
  },
  todayPctText: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
  },
  todayBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  todayTopicTitle: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Regular subject hero card
  subjectHeroCard: {
    height: 104,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  subjectHeroImg: {
    width: '100%',
    height: 104,
    position: 'absolute',
  },
  subjectHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  subjectHeroContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subjectHeroTextCol: {
    flex: 1,
    gap: 4,
  },
  subjectHeroTitle: {
    fontFamily: fonts.heading,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
  },
  subjectHeroSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
  },
  subjectHeroPct: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
  },

  // Completed card
  completedSubjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  checkIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTextCol: {
    flex: 1,
    gap: 2,
  },
  completedTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  completedSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },

  // Locked card
  lockedSubjectCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 10,
  },
  lockedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  lockedSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  lockedTipBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  lockedTipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
