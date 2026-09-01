/**
 * ProfileScreen612 — Class 6–12 Profile View.
 *
 * Design: "Choose Your World" · Profile (overview & the parent's weekly report).
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
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';

import {useAuthStore} from '../../state/authStore';
import {useChildClassId, useChildGrade} from '../../firebase/study';
import {useChildProfile} from '../../context/ChildProfileContext';
import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {Main612TabParamList} from '../../navigation/types';

type Props = BottomTabScreenProps<Main612TabParamList, 'ProfileTab'>;

export function ProfileScreen612({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const userDoc = useAuthStore(s => s.userDoc);
  const {childName, childGrade} = useChildProfile();
  const classState = useChildClassId(uid);
  const liveGradeState = useChildGrade(classState.data);
  const {theme} = useTheme();
  const {colors} = theme;

  const [activeTab, setActiveTab] = useState<'Overview' | 'Statistics' | 'Certificates'>('Overview');

  const nameToDisplay = userDoc?.displayName || childName || 'Aryan Verma';
  const gradeNum = liveGradeState.data ?? childGrade ?? 8;
  const gradeToDisplay = `Class ${gradeNum}`;
  const schoolId = classState.data?.schoolId;
  const schoolToDisplay = schoolId ? `School: ${schoolId}` : 'Saharanpur Public School';

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.bg}
      />
      {/* Header Banner */}
      <View style={[styles.headerBanner, {backgroundColor: colors.isDark ? colors.surfaceAlt : colors.primary}]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={() => navigation.navigate('Settings' as any)}
              style={styles.settingsIconBtn}
              hitSlop={12}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={3.2} />
                <Path d="M12 3v3M12 18v3M4.5 7.5l2.6 1.5M16.9 15l2.6 1.5M4.5 16.5l2.6-1.5M16.9 9l2.6-1.5" />
              </Svg>
            </Pressable>
          </View>

          <View style={styles.profileHeroCol}>
            <View style={[styles.avatarBig, {backgroundColor: colors.isDark ? colors.primary : '#FFFFFF'}]}>
              <Text style={[styles.avatarBigText, {color: colors.isDark ? colors.onPrimary : colors.primary}]}>
                {nameToDisplay.charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={[styles.profileName, {color: '#FFFFFF'}]}>{nameToDisplay}</Text>
            <Text style={[styles.profileMeta, {color: colors.isDark ? colors.textSecondary : 'rgba(255,255,255,0.85)'}]}>{gradeToDisplay} · {schoolToDisplay}</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Tabs Row */}
      <View style={[styles.tabsRow, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
        {(['Overview', 'Statistics', 'Certificates'] as const).map(tab => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[
                styles.tabItem,
                isActive && [styles.tabItemActive, {borderBottomColor: colors.primary}],
              ]}
              onPress={() => setActiveTab(tab)}>
              <Text
                style={[
                  styles.tabText,
                  isActive
                    ? [styles.tabTextActive, {color: colors.primary}]
                    : {color: colors.mutedText},
                ]}>
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Top Metrics Cards Row */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <Text style={[styles.metricValue, {color: colors.text}]}>32</Text>
            <Text style={[styles.metricLabel, {color: colors.mutedText}]}>Topics completed</Text>
          </View>
          <View style={[styles.metricCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <Text style={[styles.metricValue, {color: colors.success}]}>86%</Text>
            <Text style={[styles.metricLabel, {color: colors.mutedText}]}>Average quiz score</Text>
          </View>
        </View>

        {/* Study Time Bar Chart */}
        <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.cardOverline, {color: colors.textSecondary}]}>STUDY TIME THIS WEEK</Text>
            <Text style={[styles.chartTotalTime, {color: colors.primary}]}>5h 20m</Text>
          </View>

          <View style={styles.barsContainer}>
            <View style={styles.barCol}><View style={[styles.barItem, {height: 44, backgroundColor: colors.cardInner}]} /><Text style={[styles.barDayText, {color: colors.mutedText}]}>M</Text></View>
            <View style={styles.barCol}><View style={[styles.barItem, {height: 66, backgroundColor: colors.cardInner}]} /><Text style={[styles.barDayText, {color: colors.mutedText}]}>T</Text></View>
            <View style={styles.barCol}><View style={[styles.barItem, {height: 30, backgroundColor: colors.cardInner}]} /><Text style={[styles.barDayText, {color: colors.mutedText}]}>W</Text></View>
            <View style={styles.barCol}><View style={[styles.barItemActive, {height: 78, backgroundColor: colors.primary}]} /><Text style={[styles.barDayTextActive, {color: colors.primary}]}>T</Text></View>
            <View style={styles.barCol}><View style={[styles.barItem, {height: 52, backgroundColor: colors.cardInner}]} /><Text style={[styles.barDayText, {color: colors.mutedText}]}>F</Text></View>
            <View style={styles.barCol}><View style={[styles.barItem, {height: 22, backgroundColor: colors.cardInner}]} /><Text style={[styles.barDayText, {color: colors.mutedText}]}>S</Text></View>
            <View style={styles.barCol}><View style={[styles.barItemDim, {height: 14, backgroundColor: colors.surfaceAlt}]} /><Text style={[styles.barDayText, {color: colors.mutedText}]}>S</Text></View>
          </View>
        </View>

        {/* Weekly Report Card (What Parent Receives) */}
        <View style={[styles.reportCardBordered, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <View style={styles.reportHeaderRow}>
            <View style={[styles.reportIconChip, {backgroundColor: colors.badgeBg}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 4h11l3 3v13H5z" />
                <Path d="M9 9h6M9 13h6M9 17h4" />
              </Svg>
            </View>
            <View style={styles.reportTitleCol}>
              <Text style={[styles.reportTitle, {color: colors.text}]}>This week's report card</Text>
              <Text style={[styles.reportSub, {color: colors.mutedText}]}>Exactly what your parent receives</Text>
            </View>
          </View>

          <View style={styles.reportStatsCol}>
            <View style={styles.reportStatRow}>
              <Text style={[styles.reportStatLabel, {color: colors.mutedText}]}>Missions completed</Text>
              <Text style={[styles.reportStatValue, {color: colors.text}]}>5 of 6</Text>
            </View>
            <View style={styles.reportStatRow}>
              <Text style={[styles.reportStatLabel, {color: colors.mutedText}]}>Average quiz score</Text>
              <Text style={[styles.reportStatValue, {color: colors.success}]}>86%</Text>
            </View>
            <View style={styles.reportStatRow}>
              <Text style={[styles.reportStatLabel, {color: colors.mutedText}]}>Focus time</Text>
              <Text style={[styles.reportStatValue, {color: colors.text}]}>4h 10m</Text>
            </View>
            <View style={styles.reportStatRow}>
              <Text style={[styles.reportStatLabel, {color: colors.mutedText}]}>Needs attention</Text>
              <Text style={[styles.reportStatValue, {color: colors.accent}]}>Brackets in equations</Text>
            </View>
          </View>

          <View style={[styles.reportFooterNote, {backgroundColor: colors.surfaceAlt}]}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={9} />
              <Path d="M12 16v-4M12 8h.01" />
            </Svg>
            <Text style={[styles.reportFooterText, {color: colors.textSecondary}]}>
              Sent every Sunday evening. You always see it first.
            </Text>
          </View>
        </View>

        {/* Linked Accounts */}
        <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[styles.cardOverline, {color: colors.textSecondary}]}>LINKED ACCOUNTS</Text>

          <View style={styles.linkedRow}>
            <View style={[styles.linkedIconBox, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={8} r={4} />
                <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
              </Svg>
            </View>
            <View style={styles.linkedTextCol}>
              <Text style={[styles.linkedTitle, {color: colors.text}]}>Parent · Sunita Verma</Text>
              <Text style={[styles.linkedStatus, {color: colors.success}]}>Connected</Text>
            </View>
          </View>

          <View style={styles.linkedRow}>
            <View style={[styles.linkedIconBox, {backgroundColor: colors.badgeBg}]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 21V10l8-5 8 5v11" />
                <Path d="M4 21h16" />
              </Svg>
            </View>
            <View style={styles.linkedTextCol}>
              <Text style={[styles.linkedTitle, {color: colors.text}]}>Class 8-B · Neha Sharma</Text>
              <Text style={[styles.linkedStatus, {color: colors.textAccentMuted}]}>Assigns your topics</Text>
            </View>
          </View>
        </View>

        {/* Quick Links / Appearance */}
        <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[styles.cardOverline, {color: colors.textSecondary}]}>APPEARANCE & THEME</Text>

          <Pressable
            style={styles.toolRow}
            onPress={() => navigation.navigate('ChooseWorld' as any)}>
            <View style={styles.toolLeft}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={9} />
                <Path d="M12 3a9 9 0 0 0 0 18v-18z" />
              </Svg>
              <Text style={[styles.toolTitle, {color: colors.text}]}>Choose Your World</Text>
            </View>
            <Text style={[styles.toolValue, {color: colors.textAccentMuted}]}>{theme.name}</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
          </Pressable>

          <Pressable
            style={styles.toolRow}
            onPress={() => navigation.navigate('Settings' as any)}>
            <View style={styles.toolLeft}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={3.2} />
                <Path d="M12 3v3M12 18v3M4.5 7.5l2.6 1.5M16.9 15l2.6 1.5M4.5 16.5l2.6-1.5M16.9 9l2.6-1.5" />
              </Svg>
              <Text style={[styles.toolTitle, {color: colors.text}]}>Settings & Language</Text>
            </View>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
          </Pressable>
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
    paddingBottom: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: spacing.sm,
  },
  settingsIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroCol: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  avatarBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBigText: {
    fontFamily: fonts.heading,
    fontSize: 28,
    fontWeight: '800',
  },
  profileName: {
    fontFamily: fonts.heading,
    fontSize: 22,
    fontWeight: '700',
  },
  profileMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {},
  tabText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  tabTextActive: {
    fontWeight: '700',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  metricValue: {
    fontFamily: fonts.mono,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
  },
  metricLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
  },

  // Card Surfaces
  cardSurface: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  cardOverline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartTotalTime: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 90,
    paddingTop: 8,
  },
  barCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  barItem: {
    width: 22,
    borderRadius: 6,
  },
  barItemActive: {
    width: 22,
    borderRadius: 6,
  },
  barItemDim: {
    width: 22,
    borderRadius: 6,
  },
  barDayText: {
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  barDayTextActive: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },

  // Weekly Report
  reportCardBordered: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportIconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitleCol: {
    flex: 1,
    gap: 2,
  },
  reportTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  reportSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  reportStatsCol: {
    gap: 8,
    paddingTop: 4,
  },
  reportStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportStatLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  reportStatValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  reportFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  reportFooterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },

  // Linked accounts
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkedIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedTextCol: {
    flex: 1,
    gap: 2,
  },
  linkedTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '600',
  },
  linkedStatus: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
  },

  // Tools
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  toolLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toolTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
  },
  toolValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
  },
});
