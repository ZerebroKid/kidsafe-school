import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';

import {
  setLock,
  subscribeChildDoc,
  subscribeLinkedChildren,
} from '@zerebro/shared-firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import {useParentTheme} from '../../state/themeStore';
import {useChildQuizAttemptsAll} from '../../firebase/studyReports';
import type {ChildDoc, UserDoc} from '@zerebro/shared-types';
import type {ParentStackParamList} from '../../navigation/types';
import {CosmicAssets} from '../../assets/cosmic';
import {parentRadius, parentSpacing} from './theme/parentTheme';

type ChildRow = UserDoc & {uid: string; doc: ChildDoc | null};

function getScheduleHint(doc: ChildDoc | null): string {
  if (!doc?.schedule?.enabled) {
    return 'Study time starts in 25 minutes';
  }
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = doc.schedule.startMinutes ?? 0;
  const end = doc.schedule.endMinutes ?? 0;

  if (currentMinutes >= start && currentMinutes < end) {
    const left = end - currentMinutes;
    return `Study time active now · ${left}m remaining`;
  }
  if (currentMinutes < start) {
    const diff = start - currentMinutes;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hrs > 0) {
      return `Study time starts in ${hrs}h ${mins}m`;
    }
    return `Study time starts in ${mins} minutes`;
  }
  return 'Study time completed for today';
}

export function ChildrenListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParentStackParamList>>();
  const parentUid = useAuthStore(s => s.firebaseUid);
  const {theme, isDark} = useParentTheme();

  const [rows, setRows] = useState<ChildRow[]>([]);
  const [selectedChildUid, setSelectedChildUid] = useState<string | null>(null);
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!parentUid) return;
    const subs: Array<() => void> = [];
    const unsub = subscribeLinkedChildren(parentUid, list => {
      setRows(list.map(u => ({...u, doc: null})));
      subs.forEach(u => u());
      subs.length = 0;
      list.forEach(u => {
        const us = subscribeChildDoc(u.uid, doc => {
          setRows(prev => prev.map(r => (r.uid === u.uid ? {...r, doc} : r)));
        });
        subs.push(us);
      });
    });
    return () => {
      unsub();
      subs.forEach(u => u());
    };
  }, [parentUid]);

  // Active chosen child
  const activeChild = useMemo(() => {
    if (selectedChildUid) {
      const found = rows.find(r => r.uid === selectedChildUid);
      if (found) return found;
    }
    return rows[0] ?? null;
  }, [rows, selectedChildUid]);

  const activeName =
    activeChild?.name ?? activeChild?.displayName ?? 'Aalya';
  const isOnline = activeChild?.doc?.status === 'online';
  const isLocked = activeChild?.doc?.lockState?.locked ?? false;
  const currentApp = activeChild?.doc?.currentApp?.packageName ?? 'Photos';

  // Dynamic live quiz attempts for active child
  const attemptsState = useChildQuizAttemptsAll(activeChild?.uid ?? null);
  const attempts = attemptsState.data ?? [];
  const latestQuiz = attempts[0];
  const quizPercent = latestQuiz
    ? Math.round(latestQuiz.bestPercentage)
    : 85;

  const handleToggleLock = async () => {
    if (!activeChild) return;
    try {
      setLocking(true);
      await setLock(activeChild.uid, !isLocked);
    } catch (e: any) {
      Alert.alert('Lock Error', e?.message || 'Failed to update lock state.');
    } finally {
      setLocking(false);
    }
  };

  const handleLocate = () => {
    if (!activeChild) {
      navigation.navigate('Settings');
      return;
    }
    navigation.navigate('Location', {childUid: activeChild.uid, childName: activeName});
  };

  const handleOpenControls = (initialTab?: string) => {
    if (!activeChild) {
      navigation.navigate('Settings');
      return;
    }
    if (initialTab === 'schedule') {
      navigation.navigate('Schedule', {childUid: activeChild.uid, childName: activeName});
    } else if (initialTab === 'apps') {
      navigation.navigate('Apps', {childUid: activeChild.uid, childName: activeName});
    } else if (initialTab === 'location') {
      navigation.navigate('Location', {childUid: activeChild.uid, childName: activeName});
    } else if (initialTab === 'study') {
      navigation.navigate('Study', {childUid: activeChild.uid, childName: activeName});
    } else if (initialTab === 'reels') {
      navigation.navigate('ReelsInsights', {childUid: activeChild.uid, childName: activeName});
    } else if (initialTab === 'pin') {
      navigation.navigate('Pin', {childUid: activeChild.uid, childName: activeName});
    } else {
      navigation.navigate('Controls', {childUid: activeChild.uid, childName: activeName});
    }
  };

  return (
    <View style={[styles.root, {backgroundColor: theme.bg}]}>
      <StatusBar
        barStyle={theme.statusBar}
        backgroundColor="transparent"
        translucent
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* ================= HERO ARTWORK ================= */}
        <View style={styles.heroContainer}>
          <Image
            source={isDark ? CosmicAssets.hero : CosmicAssets.heroMotherChild}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {/* Gradient Scrim */}
          <View
            style={[
              styles.heroScrim,
              {
                backgroundColor: isDark
                  ? 'rgba(7,11,43,0.35)'
                  : 'rgba(255,247,249,0.08)',
              },
            ]}
          />
          <View
            style={[
              styles.heroGradientBottom,
              {
                backgroundColor: isDark
                  ? 'transparent'
                  : 'transparent',
              },
            ]}
          />

          {/* Top Status & Notification Button */}
          <SafeAreaView edges={['top']} style={styles.heroTopBar}>
            <View style={styles.timePlaceholder} />
            <Pressable
              style={[
                styles.bellButton,
                {
                  backgroundColor: isDark
                    ? 'rgba(11,16,56,0.7)'
                    : 'rgba(255,255,255,0.85)',
                  borderColor: theme.primaryBorder,
                },
              ]}
              onPress={() => Alert.alert('Notifications', 'All systems operational. No unread alerts.')}>
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke={isDark ? '#E4DEFF' : theme.text}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round">
                <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <Path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </Svg>
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>1</Text>
              </View>
            </Pressable>
          </SafeAreaView>
        </View>

        {/* ================= BODY CONTENT ================= */}
        <View style={styles.bodyContent}>
          {/* 1. IDENTITY CARD */}
          <Pressable
            style={[
              styles.identityCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}
            onPress={() => setShowChildPicker(true)}>
            <View style={[styles.avatarGlow, !isDark && {backgroundColor: '#F7C9D5'}]}>
              <Image
                source={isDark ? CosmicAssets.avatarChild : CosmicAssets.avatarAalya}
                style={[styles.avatarImg, {borderColor: theme.surface}]}
              />
            </View>
            <View style={styles.identityTextCol}>
              <View style={styles.identityNameRow}>
                <Text style={[styles.identityName, {color: theme.text}]}>
                  {activeName}
                </Text>
                <Text style={[styles.dropdownArrow, {color: theme.textSubtle}]}>▾</Text>
              </View>
              <View style={styles.statusPillRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isOnline
                        ? theme.successGreen
                        : theme.textSubtle,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: isOnline
                        ? theme.successGreen
                        : theme.textSubtle,
                    },
                  ]}>
                  {isOnline ? 'Online · at home' : 'Phone offline · last seen 3h ago'}
                </Text>
              </View>
            </View>
            <Text style={[styles.chevronRight, {color: theme.textSubtle}]}>›</Text>
          </Pressable>

          {/* 2. ALERT BANNER (Shows when device offline or needs attention) */}
          {!isOnline && (
            <View style={[styles.alertCard, {backgroundColor: 'rgba(74,44,20,0.5)', borderColor: 'rgba(255,200,87,0.34)'}]}>
              <View style={styles.alertHeaderRow}>
                <View style={styles.alertIconBadge}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FFC857" strokeWidth={2.6} strokeLinecap="round">
                    <Path d="M12 7v6" />
                    <Path d="M12 17h.01" />
                  </Svg>
                </View>
                <Text style={styles.alertMainTitle}>Device needs attention</Text>
              </View>
              <View style={[styles.alertInnerBox, {backgroundColor: 'rgba(7,11,43,0.62)', borderColor: 'rgba(139,132,200,0.18)'}]}>
                <Text style={[styles.alertBoxTitle, {color: theme.text}]}>{activeName}'s phone is offline</Text>
                <Text style={[styles.alertBoxSub, {color: theme.textMuted}]}>Location and blocking are paused until it reconnects.</Text>
                <View style={styles.alertButtonsRow}>
                  <Pressable style={styles.alertPrimaryBtn} onPress={() => Alert.alert('Connection', 'Checking child device connection status...')}>
                    <Text style={styles.alertPrimaryBtnText}>Fix connection</Text>
                  </Pressable>
                  <Pressable style={styles.alertSecondaryBtn} onPress={() => Alert.alert('Call', `Calling ${activeName}...`)}>
                    <Text style={styles.alertSecondaryBtnText}>Call {activeName}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* 3. RIGHT NOW CARD */}
          <View
            style={[
              styles.rightNowCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.primaryBorder,
              },
            ]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionOverline, {color: theme.purpleAccent}]}>
                RIGHT NOW
              </Text>
              <View style={styles.liveBadgeRow}>
                <View
                  style={[
                    styles.livePulseDot,
                    {backgroundColor: theme.liveCyan},
                  ]}
                />
                <Text style={[styles.liveText, {color: theme.liveCyan}]}>
                  Live
                </Text>
              </View>
            </View>

            <View style={styles.liveAppRow}>
              <View style={styles.appIconWrapper}>
                <Image
                  source={CosmicAssets.appPhotosSm}
                  style={styles.appIconImg}
                />
              </View>
              <View style={styles.liveAppTextCol}>
                <Text style={[styles.watchingTitle, {color: theme.text}]}>
                  Watching {currentApp.includes('.') ? currentApp.split('.').pop() : currentApp}
                </Text>
                <View style={styles.appTagsRow}>
                  <View
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: isLocked
                          ? theme.dangerBg
                          : theme.successGreenBg,
                        borderColor: isLocked
                          ? theme.dangerBorder
                          : theme.successGreenBorder,
                      },
                    ]}>
                    <Svg
                      width={11}
                      height={11}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isLocked ? theme.danger : theme.successGreen}
                      strokeWidth={2.6}
                      strokeLinecap="round">
                      <Rect x={4} y={10} width={16} height={11} rx={2.5} />
                      <Path d="M8 10V7a4 4 0 0 1 8 0" />
                    </Svg>
                    <Text
                      style={[
                        styles.tagText,
                        {
                          color: isLocked
                            ? theme.danger
                            : theme.successGreen,
                        },
                      ]}>
                      {isLocked ? 'Locked' : 'Unlocked'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: theme.liveCyanBg,
                        borderColor: theme.liveCyanBorder,
                      },
                    ]}>
                    <View
                      style={[
                        styles.miniCyanDot,
                        {backgroundColor: theme.liveCyan},
                      ]}
                    />
                    <Text
                      style={[styles.tagText, {color: theme.liveCyan}]}>
                      At home
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.scheduleHintText, {color: theme.textMuted}]}>
              {getScheduleHint(activeChild?.doc ?? null)}
            </Text>

            <View style={styles.actionButtonsRow}>
              <Pressable
                style={[styles.primaryActionBtn, {backgroundColor: theme.primary}]}
                disabled={locking}
                onPress={handleToggleLock}>
                {locking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>
                    {isLocked ? 'Unlock phone' : 'Lock phone now'}
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor: theme.trackBg,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={handleLocate}>
                <Text style={[styles.secondaryActionBtnText, {color: theme.text}]}>
                  Locate
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 4. TODAY'S LEARNING */}
          <View
            style={[
              styles.cardSurface,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionOverline, {color: theme.purpleAccent}]}>
                TODAY'S LEARNING
              </Text>
              <Pressable onPress={() => handleOpenControls('study')}>
                <Text style={[styles.detailsLink, {color: theme.purpleAccent}]}>
                  Details
                </Text>
              </Pressable>
            </View>

            <View style={styles.learningGaugeRow}>
              {/* Radial Donut Gauge */}
              <View style={styles.gaugeContainer}>
                <Svg width={96} height={96} viewBox="0 0 80 80">
                  <Circle
                    cx={40}
                    cy={40}
                    r={34}
                    fill="none"
                    stroke={theme.trackBg}
                    strokeWidth={8}
                  />
                  <Circle
                    cx={40}
                    cy={40}
                    r={34}
                    fill="none"
                    stroke={theme.liveCyan}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={213.63}
                    strokeDashoffset={213.63 * (1 - quizPercent / 100)}
                    transform="rotate(-90 40 40)"
                  />
                </Svg>
                <View style={styles.gaugeCenterTextWrap}>
                  <Text style={[styles.gaugeScoreText, {color: theme.text}]}>
                    {quizPercent}%
                  </Text>
                  <Text style={[styles.gaugeScoreLabel, {color: theme.textSubtle}]}>
                    QUIZ
                  </Text>
                </View>
              </View>

              {/* Subject status list */}
              <View style={styles.subjectListCol}>
                <View style={styles.subjectRow}>
                  <View
                    style={[
                      styles.subjectDot,
                      {backgroundColor: theme.successGreen},
                    ]}
                  />
                  <Text style={[styles.subjectName, {color: theme.text}]}>Science</Text>
                  <Text style={[styles.subjectStatus, {color: theme.successGreen}]}>
                    done
                  </Text>
                </View>
                <View style={styles.subjectRow}>
                  <View
                    style={[
                      styles.subjectDot,
                      {backgroundColor: theme.successGreen},
                    ]}
                  />
                  <Text style={[styles.subjectName, {color: theme.text}]}>Maths</Text>
                  <Text style={[styles.subjectStatus, {color: theme.successGreen}]}>
                    done
                  </Text>
                </View>
                <View style={styles.subjectRow}>
                  <View
                    style={[
                      styles.subjectDotHollow,
                      {borderColor: theme.textSubtle},
                    ]}
                  />
                  <Text style={[styles.subjectName, {color: theme.textSubtle}]}>English</Text>
                  <Text style={[styles.subjectStatus, {color: theme.textSubtle}]}>
                    left
                  </Text>
                </View>
              </View>
            </View>

            {/* Taught → Homework → Quiz Journey Path */}
            <View style={[styles.journeyPathWrap, {borderTopColor: theme.cardBorderSubtle}]}>
              <View style={styles.journeyStepsRow}>
                {/* Step 1: Taught */}
                <View style={styles.journeyNodeCol}>
                  <Image source={CosmicAssets.icoSchool} style={styles.journeyIcon} resizeMode="contain" />
                  <Text style={[styles.journeyNodeTitle, {color: theme.text}]}>Taught</Text>
                  <Text style={[styles.journeyNodeSub, {color: theme.textSubtle}]}>Photosynthesis</Text>
                </View>

                {/* Connector 1 */}
                <View style={[styles.journeyLine, {backgroundColor: theme.successGreen}]} />

                {/* Step 2: Homework */}
                <View style={styles.journeyNodeCol}>
                  <Image source={CosmicAssets.icoHomework} style={styles.journeyIcon} resizeMode="contain" />
                  <Text style={[styles.journeyNodeTitle, {color: theme.text}]}>Homework</Text>
                  <Text style={[styles.journeyNodeSub, {color: theme.successGreen}]}>Done</Text>
                </View>

                {/* Connector 2 */}
                <View style={[styles.journeyLine, {backgroundColor: theme.liveCyan}]} />

                {/* Step 3: Quiz */}
                <View style={styles.journeyNodeCol}>
                  <Image source={CosmicAssets.badgeStar} style={styles.journeyBadgeIcon} resizeMode="contain" />
                  <Text style={[styles.journeyNodeTitle, {color: theme.text}]}>Quiz</Text>
                  <Text style={[styles.journeyNodeSub, {color: theme.liveCyan}]}>{quizPercent}%</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 5. TODAY'S ACTIVITY */}
          <View
            style={[
              styles.cardSurface,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionOverline, {color: theme.purpleAccent}]}>
                TODAY'S ACTIVITY
              </Text>
              <Pressable
                onPress={() =>
                  activeChild
                    ? navigation.navigate('Reports', {
                        childUid: activeChild.uid,
                        childName: activeName,
                      })
                    : navigation.navigate('Reports')
                }>
                <Text style={[styles.detailsLink, {color: theme.purpleAccent}]}>
                  View breakdown
                </Text>
              </Pressable>
            </View>

            {/* Screen time summary row */}
            <View style={styles.activitySummaryRow}>
              <Text style={[styles.totalTimeBig, {color: theme.text}]}>2h 14m</Text>
              <Text style={[styles.totalTimeLabel, {color: theme.textMuted}]}>screen time today</Text>
            </View>

            {/* Multi-segment time bar */}
            <View style={[styles.activityTrackBar, {backgroundColor: theme.trackBg}]}>
              <View style={[styles.trackSeg1, {backgroundColor: '#FF2E93'}]} />
              <View style={[styles.trackSeg2, {backgroundColor: theme.liveCyan}]} />
              <View style={[styles.trackSeg3, {backgroundColor: theme.successGreen}]} />
            </View>

            {/* Apps mini list */}
            <View style={styles.activityAppsList}>
              <View style={styles.appUsageItem}>
                <Image source={CosmicAssets.aYoutube} style={styles.miniAppIcon} resizeMode="contain" />
                <Text style={[styles.appUsageName, {color: theme.text}]}>YouTube</Text>
                <Text style={[styles.appUsageTime, {color: theme.textMuted}]}>38m</Text>
              </View>
              <View style={styles.appUsageItem}>
                <Image source={CosmicAssets.aQuiz} style={styles.miniAppIcon} resizeMode="contain" />
                <Text style={[styles.appUsageName, {color: theme.text}]}>Quiz & Study</Text>
                <Text style={[styles.appUsageTime, {color: theme.textMuted}]}>24m</Text>
              </View>
              <View style={styles.appUsageItem}>
                <Image source={CosmicAssets.aPhotos} style={styles.miniAppIcon} resizeMode="contain" />
                <Text style={[styles.appUsageName, {color: theme.text}]}>Photos</Text>
                <Text style={[styles.appUsageTime, {color: theme.textMuted}]}>18m</Text>
              </View>
            </View>
          </View>

          {/* 6. QUICK CONTROLS 2x2 GRID */}
          <View
            style={[
              styles.cardSurface,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionOverline, {color: theme.purpleAccent}]}>
                QUICK CONTROLS
              </Text>
              <Pressable
                onPress={() =>
                  activeChild
                    ? navigation.navigate('Controls', {
                        childUid: activeChild.uid,
                        childName: activeName,
                      })
                    : navigation.navigate('Controls')
                }>
                <Text style={[styles.detailsLink, {color: theme.purpleAccent}]}>
                  Manage all
                </Text>
              </Pressable>
            </View>

            <View style={styles.quickGrid}>
              {/* Schedule */}
              <Pressable
                style={[
                  styles.quickTile,
                  {
                    backgroundColor: theme.cardBgSubtle,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => handleOpenControls('schedule')}>
                <Image
                  source={CosmicAssets.tSchedule}
                  style={styles.quickTileImg}
                  resizeMode="cover"
                />
                <Text style={[styles.quickTileTitle, {color: theme.text}]}>
                  Schedule
                </Text>
                <Text style={[styles.quickTileSub, {color: theme.textSubtle}]}>
                  3–6 PM · lock mode
                </Text>
              </Pressable>

              {/* Location */}
              <Pressable
                style={[
                  styles.quickTile,
                  {
                    backgroundColor: theme.cardBgSubtle,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => handleOpenControls('location')}>
                <Image
                  source={CosmicAssets.tLocation}
                  style={styles.quickTileImg}
                  resizeMode="cover"
                />
                <Text style={[styles.quickTileTitle, {color: theme.text}]}>
                  Location
                </Text>
                <Text style={[styles.quickTileSub, {color: isOnline ? theme.liveCyan : '#FFC857'}]}>
                  {isOnline ? 'At home · 2 min ago' : 'Paused — offline'}
                </Text>
              </Pressable>

              {/* Study */}
              <Pressable
                style={[
                  styles.quickTile,
                  {
                    backgroundColor: theme.cardBgSubtle,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => handleOpenControls('study')}>
                <Image
                  source={CosmicAssets.tStudy}
                  style={styles.quickTileImg}
                  resizeMode="cover"
                />
                <Text style={[styles.quickTileTitle, {color: theme.text}]}>
                  Study
                </Text>
                <Text style={[styles.quickTileSub, {color: theme.textSubtle}]}>
                  3 of 4 days
                </Text>
              </Pressable>

              {/* Apps */}
              <Pressable
                style={[
                  styles.quickTile,
                  {
                    backgroundColor: theme.cardBgSubtle,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => handleOpenControls('apps')}>
                <Image
                  source={CosmicAssets.tApps}
                  style={styles.quickTileImg}
                  resizeMode="cover"
                />
                <Text style={[styles.quickTileTitle, {color: theme.text}]}>
                  Apps
                </Text>
                <Text style={[styles.quickTileSub, {color: theme.textSubtle}]}>
                  6 blocked
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ================= CHILD SWITCHER MODAL (H2) ================= */}
      <Modal
        visible={showChildPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChildPicker(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowChildPicker(false)}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
              },
            ]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, {color: theme.text}]}>
              Select Child
            </Text>
            <Text style={[styles.modalSub, {color: theme.textMuted}]}>
              Switch dashboard context to another paired child
            </Text>

            <ScrollView style={styles.childListScroll}>
              {rows.map(c => {
                const isSelected =
                  c.uid === (activeChild?.uid ?? rows[0]?.uid);
                const cOnline = c.doc?.status === 'online';
                const cName = c.name ?? c.displayName ?? 'Child';
                return (
                  <Pressable
                    key={c.uid}
                    style={[
                      styles.childOptionRow,
                      {
                        backgroundColor: isSelected
                          ? theme.cardBg
                          : theme.surfaceAlt,
                        borderColor: isSelected
                          ? theme.primary
                          : theme.cardBorderSubtle,
                      },
                    ]}
                    onPress={() => {
                      setSelectedChildUid(c.uid);
                      setShowChildPicker(false);
                    }}>
                    <Image
                      source={CosmicAssets.avatarChild}
                      style={styles.childModalAvatar}
                    />
                    <View style={styles.childOptionTextCol}>
                      <Text style={[styles.childOptionName, {color: theme.text}]}>
                        {cName}
                      </Text>
                      <Text style={[styles.childOptionStatus, {color: cOnline ? theme.successGreen : theme.textSubtle}]}>
                        {cOnline ? 'Online · at home' : 'Offline'}
                      </Text>
                    </View>
                    {isSelected && (
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth={2.5} strokeLinecap="round">
                        <Path d="M20 6L9 17l-5-5" />
                      </Svg>
                    )}
                  </Pressable>
                );
              })}

              <Pressable
                style={[styles.addChildBtn, {borderColor: theme.cardBorder}]}
                onPress={() => {
                  setShowChildPicker(false);
                  navigation.navigate('Settings');
                }}>
                <Text style={[styles.addChildBtnText, {color: theme.purpleAccent}]}>
                  + Pair another child device
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  heroContainer: {
    position: 'relative',
    width: '100%',
    height: 220,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  timePlaceholder: {
    flex: 1,
  },
  heroClockText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#E95CFF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  bodyContent: {
    paddingHorizontal: 18,
    marginTop: -40,
    gap: 14,
  },

  // Identity Card
  identityCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  avatarGlow: {
    padding: 2,
    borderRadius: 999,
    backgroundColor: '#A855F7',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  identityTextCol: {
    flex: 1,
  },
  identityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  identityName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  dropdownArrow: {
    fontSize: 12,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chevronRight: {
    fontSize: 20,
    fontWeight: '400',
  },

  // Alert Card
  alertCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    gap: 12,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,200,87,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertMainTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFD98A',
  },
  alertInnerBox: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  alertBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertBoxSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  alertButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  alertPrimaryBtn: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#6D3FE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  alertSecondaryBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(139,132,200,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertSecondaryBtnText: {
    color: '#E4DEFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Right Now Card
  rightNowCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionOverline: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
  },
  liveAppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  appIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  appIconImg: {
    width: '100%',
    height: '100%',
  },
  liveAppTextCol: {
    flex: 1,
    gap: 6,
  },
  watchingTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  appTagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  miniCyanDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  scheduleHintText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 2,
  },
  primaryActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Surface Card Shared
  cardSurface: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    gap: 14,
  },
  detailsLink: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Today's Learning
  learningGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  gaugeContainer: {
    width: 96,
    height: 96,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCenterTextWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScoreText: {
    fontSize: 20,
    fontWeight: '800',
  },
  gaugeScoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  subjectListCol: {
    flex: 1,
    gap: 10,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectDotHollow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  subjectName: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  subjectStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  journeyPathWrap: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 4,
  },
  journeyStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  journeyNodeCol: {
    alignItems: 'center',
    width: 76,
    gap: 6,
  },
  journeyIcon: {
    width: 38,
    height: 32,
  },
  journeyBadgeIcon: {
    width: 34,
    height: 34,
  },
  journeyNodeTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  journeyNodeSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  journeyLine: {
    flex: 1,
    height: 2,
    marginTop: -24,
    borderRadius: 999,
  },

  // Today's Activity
  activitySummaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  totalTimeBig: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  totalTimeLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  activityTrackBar: {
    height: 8,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  trackSeg1: {
    width: '45%',
    height: '100%',
  },
  trackSeg2: {
    width: '30%',
    height: '100%',
  },
  trackSeg3: {
    width: '25%',
    height: '100%',
  },
  activityAppsList: {
    gap: 10,
    paddingTop: 4,
  },
  appUsageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniAppIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  appUsageName: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  appUsageTime: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Quick Controls Grid
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
  },
  quickTile: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
    gap: 4,
  },
  quickTileImg: {
    width: '100%',
    height: 76,
    borderRadius: 14,
  },
  quickTileTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  quickTileSub: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 22,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  childListScroll: {
    marginVertical: 8,
  },
  childOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12,
  },
  childModalAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  childOptionTextCol: {
    flex: 1,
    gap: 2,
  },
  childOptionName: {
    fontSize: 16,
    fontWeight: '700',
  },
  childOptionStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  addChildBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addChildBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
