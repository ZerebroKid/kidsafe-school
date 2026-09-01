/**
 * HomeScreen612 — Class 6–12 Home Tab.
 *
 * Design: "Choose Your World" · V1 / F1 / Q1 / Classic Home Screen.
 * Calm, mission-first UI driven by themeId.
 */

import React, {useLayoutEffect, useRef, useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';

import {
  useChildClassId,
  useChapterMetaMap,
  useTodayAssignments,
} from '../../firebase/study';
import {useAuthStore} from '../../state/authStore';
import {useChildProfile} from '../../context/ChildProfileContext';
import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {Main612TabParamList} from '../../navigation/types';
import {OnboardingRewardsPopup} from './onboarding612/OnboardingRewardsPopup';
import {OnboardingTuitionPopup} from './onboarding612/OnboardingTuitionPopup';
import {ChooseWorldScreen} from '../theme/ChooseWorldScreen';

type Props = BottomTabScreenProps<Main612TabParamList, 'HomeTab612'>;

export function HomeScreen612({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const {childName} = useChildProfile();
  const {theme} = useTheme();

  const classState = useChildClassId(uid);
  const assignmentsState = useTodayAssignments(classState.data?.classId ?? null);
  const assignments = assignmentsState.data ?? [];
  useChapterMetaMap(assignmentsState.data);

  const activeMission = assignments[0];
  const [isCompleted, setIsCompleted] = useState(false);
  const [popupStage, setPopupStage] = useState<'choose_world' | 'popup' | 'done'>('choose_world');

  const {width} = useWindowDimensions();
  const carouselRef = useRef<ScrollView>(null);
  const [activeDotIndex, setActiveDotIndex] = useState(0);

  useLayoutEffect(() => {
    if (popupStage !== 'done') {
      navigation.setOptions({tabBarStyle: {display: 'none'}});
    } else {
      navigation.setOptions({tabBarStyle: undefined});
    }
  }, [popupStage, navigation]);

  const handleFinishPopups = () => {
    setPopupStage('done');
  };

  const handleNextPage = () => {
    if (activeDotIndex === 0) {
      carouselRef.current?.scrollTo({x: width, animated: true});
      setActiveDotIndex(1);
    } else {
      handleFinishPopups();
    }
  };

  const onStartMission = () => {
    if (activeMission) {
      navigation.navigate('StudyTab', {
        screen: 'TopicDetail',
        params: {
          assignmentId: activeMission.id,
          curriculumId: activeMission.curriculumId,
          chapterId: activeMission.chapterId,
          topicId: activeMission.topicId,
          topicName: activeMission.topicName,
          subjectName: activeMission.subjectName,
        },
      } as any);
    } else {
      navigation.navigate('StudyTab', {screen: 'SubjectList'} as any);
    }
  };

  const onStartQuiz = () => {
    if (activeMission) {
      navigation.navigate('StudyTab', {
        screen: 'Quiz',
        params: {
          assignmentId: activeMission.id,
          curriculumId: activeMission.curriculumId,
          chapterId: activeMission.chapterId,
          topicId: activeMission.topicId,
          topicName: activeMission.topicName,
        },
      } as any);
    } else {
      navigation.navigate('StudyTab', {screen: 'SubjectList'} as any);
    }
  };

  const onClaimRewards = () => {
    navigation.navigate('RewardsTab');
  };

  const nameToDisplay = childName || 'Aryan';

  if (popupStage === 'choose_world') {
    return (
      <ChooseWorldScreen
        isFirstLaunch
        onComplete={() => setPopupStage('popup')}
      />
    );
  }

  if (popupStage === 'popup') {
    return (
      <View style={{flex: 1, backgroundColor: theme.colors.bg}}>
        <ScrollView
          ref={carouselRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setActiveDotIndex(index);
          }}
          scrollEventThrottle={16}
          style={{flex: 1}}>
          <View style={{width, flex: 1}}>
            <OnboardingRewardsPopup
              onContinue={handleNextPage}
              onDismiss={handleFinishPopups}
              dotIndex={activeDotIndex}
            />
          </View>
          <View style={{width, flex: 1}}>
            <OnboardingTuitionPopup
              onContinue={handleFinishPopups}
              onDismiss={handleFinishPopups}
              dotIndex={activeDotIndex}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  const {colors, images} = theme;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <SafeAreaView edges={['top']} style={[styles.safeTop, {backgroundColor: colors.bg}]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatarBox, {backgroundColor: colors.primary}]}>
            <Text style={[styles.avatarText, {color: colors.onPrimary}]}>
              {nameToDisplay.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, {color: colors.text}]}>
              {isCompleted ? `Well done, ${nameToDisplay}` : `Hi ${nameToDisplay}`}
            </Text>
            <Text style={[styles.headerSub, {color: colors.mutedText}]}>
              {isCompleted
                ? "Today's topic and quiz are complete"
                : "Let's complete today's topic and earn rewards"}
            </Text>
          </View>
          <View style={styles.bellWrap}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
              <Path d="M10 19a2 2 0 0 0 4 0" />
            </Svg>
            {!isCompleted && (
              <View
                style={[
                  styles.bellBadgeDot,
                  {backgroundColor: colors.accent, borderColor: colors.bg},
                ]}
              />
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>

        {/* Demo State Toggle (keeps prototype interactive) */}
        <Pressable
          style={[styles.demoTogglePill, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}
          onPress={() => setIsCompleted(prev => !prev)}>
          <Text style={[styles.demoToggleText, {color: colors.textAccentMuted}]}>
            Mode: {isCompleted ? 'Completed' : 'In Progress'} (Tap to toggle)
          </Text>
        </Pressable>

        {/* ----------------- IN-PROGRESS STATE ----------------- */}
        {!isCompleted ? (
          <>
            {/* Card 1: Today's Mission (Hero Banner) */}
            <View
              style={[
                styles.missionHeroCard,
                colors.isDark
                  ? {backgroundColor: colors.surface, borderColor: colors.border}
                  : {backgroundColor: colors.primary, borderColor: colors.primary},
              ]}>
              <View style={styles.missionHeroTextWrap}>
                <Text style={[styles.missionHeroTitle, {color: '#FFFFFF'}]}>
                  Today's Mission
                </Text>
                <Text style={[styles.missionHeroSub, {color: colors.isDark ? colors.mutedText : 'rgba(255,255,255,0.82)'}]}>
                  Finish your topic, take the quiz and claim your reward
                </Text>
              </View>
              <View style={styles.imageRelative}>
                <Image
                  source={images.homeHero}
                  style={[styles.missionHeroImg, !colors.isDark && {height: 150}]}
                  resizeMode="cover"
                />
                {colors.isDark && (
                  <View
                    style={[
                      styles.scrimBottom,
                      {backgroundColor: 'rgba(20,14,40,0.6)'},
                    ]}
                  />
                )}
              </View>
              <View style={styles.missionHeroBtnWrap}>
                <Pressable
                  style={({pressed}) => [
                    styles.missionStartBtn,
                    colors.isDark
                      ? {backgroundColor: colors.primary}
                      : {backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)'},
                    pressed && styles.btnPressed,
                  ]}
                  onPress={onStartMission}>
                  <Text style={[styles.missionStartBtnText, {color: '#FFFFFF'}]}>
                    Start Mission
                  </Text>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M5 12h14M13 6l6 6-6 6" />
                  </Svg>
                </Pressable>
              </View>
            </View>

            {/* Card 2: Today's Topic */}
            <View
              style={[
                styles.topicCard,
                {backgroundColor: colors.surface, borderColor: colors.border},
              ]}>
              <View style={styles.topicTopRow}>
                <Text style={[styles.topicOverline, {color: colors.primary}]}>
                  TODAY'S TOPIC
                </Text>
                <Pressable
                  style={[styles.continuePill, {backgroundColor: colors.primary}]}
                  onPress={onStartMission}>
                  <Text style={[styles.continuePillText, {color: colors.onPrimary}]}>
                    Continue
                  </Text>
                </Pressable>
              </View>
              <View style={styles.topicMainRow}>
                <View style={styles.topicTitleWrap}>
                  <Text style={[styles.topicTitle, {color: colors.text}]}>
                    {activeMission?.topicName || 'Word Problems on Linear Equations'}
                  </Text>
                  <Text style={[styles.topicSub, {color: colors.mutedText}]}>
                    {activeMission?.subjectName || 'Ch 2'} · Linear Equations in One Variable
                  </Text>
                </View>
                {/* 25% Ring */}
                <View style={styles.ringWrap}>
                  <Svg width={64} height={64} viewBox="0 0 80 80">
                    <Circle cx={40} cy={40} r={34} fill="none" stroke={colors.surfaceAlt} strokeWidth={9} />
                    <Circle
                      cx={40}
                      cy={40}
                      r={34}
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth={9}
                      strokeLinecap="round"
                      strokeDasharray={213.63}
                      strokeDashoffset={160.22}
                      transform="rotate(-90 40 40)"
                    />
                  </Svg>
                  <Text style={[styles.ringText, {color: colors.text}]}>25%</Text>
                </View>
              </View>
              {/* Progress bar */}
              <View style={[styles.trackBar, {backgroundColor: colors.surfaceAlt}]}>
                <View style={[styles.fillBar, {width: '25%', backgroundColor: colors.primary}]} />
              </View>
              <View style={styles.timeRow}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Circle cx={12} cy={12} r={8} />
                  <Path d="M12 8v4.6l3 1.8" />
                </Svg>
                <Text style={[styles.timeText, {color: colors.mutedText}]}>About 18 min · due 11:59 PM</Text>
              </View>
            </View>

            {/* Card 3: Today's Quiz */}
            <Pressable
              style={[
                styles.quizCard,
                {backgroundColor: colors.surface, borderColor: colors.border},
              ]}
              onPress={onStartQuiz}>
              <View style={styles.quizTextWrap}>
                <View style={styles.quizTitleRow}>
                  <Text style={[styles.quizTitle, {color: colors.text}]}>Today's Quiz</Text>
                  <View style={styles.takeQuizLink}>
                    <Text style={[styles.takeQuizText, {color: colors.navInactive}]}>Take Quiz</Text>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.navInactive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M9 5l7 7-7 7" />
                    </Svg>
                  </View>
                </View>
                <Text style={[styles.quizSub, {color: colors.mutedText}]}>5 questions · unlocks after the topic</Text>
              </View>
              <Image
                source={images.quizThumb}
                style={styles.quizImg}
                resizeMode="cover"
              />
            </Pressable>

            {/* Card 4: Claim Your Reward (Dashed locked card) */}
            <View
              style={[
                styles.claimDashedCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderDashed,
                },
              ]}>
              <View style={styles.quizTextWrap}>
                <View style={styles.quizTitleRow}>
                  <Text style={[styles.quizTitle, {color: colors.text}]}>Claim Your Reward</Text>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.navInactive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Rect x={4} y={10} width={16} height={11} rx={2} />
                    <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </Svg>
                </View>
                <Text style={[styles.quizSub, {color: colors.mutedText}]}>Complete the topic & quiz to unlock</Text>
              </View>
              <Image
                source={images.claimReward}
                style={styles.giftImg}
                resizeMode="cover"
              />
            </View>

            {/* Section: Your subjects (exact from HTML spec lines 211–246) */}
            <View style={styles.sectionCol}>
              <Text style={[styles.sectionHeading, {color: colors.text}]}>Your subjects</Text>

              {/* Mathematics Card */}
              <Pressable
                style={[styles.subjectHeroCard, {borderColor: colors.border}]}
                onPress={() => navigation.navigate('StudyTab', {screen: 'SubjectList'} as any)}>
                <Image source={images.subjectMaths} style={styles.subjectHeroImg} resizeMode="cover" />
                <View style={[styles.subjectOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.65)' : 'rgba(0,0,0,0.4)'}]} />
                <View style={styles.subjectContentRow}>
                  <Text style={[styles.subjectHeroTitle, {color: '#FFFFFF'}]}>Mathematics</Text>
                  <View style={styles.subjectProgressRow}>
                    <View style={styles.subjectTrack}>
                      <View style={[styles.subjectFill, {width: '43%', backgroundColor: colors.primary}]} />
                    </View>
                    <Text style={[styles.subjectPctText, {color: colors.textAccentMuted}]}>43%</Text>
                  </View>
                </View>
              </Pressable>

              {/* Science Card */}
              <Pressable
                style={[styles.subjectHeroCard, {borderColor: colors.border}]}
                onPress={() => navigation.navigate('StudyTab', {screen: 'SubjectList'} as any)}>
                <Image source={images.subjectScience} style={styles.subjectHeroImg} resizeMode="cover" />
                <View style={[styles.subjectOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.65)' : 'rgba(0,0,0,0.4)'}]} />
                <View style={styles.subjectContentRow}>
                  <Text style={[styles.subjectHeroTitle, {color: '#FFFFFF'}]}>Science</Text>
                  <View style={styles.subjectProgressRow}>
                    <View style={styles.subjectTrack}>
                      <View style={[styles.subjectFill, {width: '70%', backgroundColor: colors.success}]} />
                    </View>
                    <Text style={[styles.subjectPctText, {color: colors.success}]}>70%</Text>
                  </View>
                </View>
              </Pressable>

              {/* English Card */}
              <Pressable
                style={[styles.subjectHeroCard, {borderColor: colors.border}]}
                onPress={() => navigation.navigate('StudyTab', {screen: 'SubjectList'} as any)}>
                <Image source={images.subjectEnglish} style={styles.subjectHeroImg} resizeMode="cover" />
                <View style={[styles.subjectOverlay, {backgroundColor: colors.isDark ? 'rgba(10,7,22,0.65)' : 'rgba(0,0,0,0.4)'}]} />
                <View style={styles.subjectContentRow}>
                  <Text style={[styles.subjectHeroTitle, {color: '#FFFFFF'}]}>English</Text>
                  <View style={styles.subjectProgressRow}>
                    <View style={styles.subjectTrack}>
                      <View style={[styles.subjectFill, {width: '25%', backgroundColor: colors.accent}]} />
                    </View>
                    <Text style={[styles.subjectPctText, {color: colors.accent}]}>25%</Text>
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Section: Rewards you can get (exact from HTML spec lines 342-366) */}
            <View style={styles.sectionCol}>
              <Text style={[styles.sectionHeading, {color: colors.text}]}>Rewards you can get</Text>

              {/* Games */}
              <Pressable
                style={[
                  colors.isDark ? styles.rewardHeroCard : styles.rewardClassicCard,
                  colors.isDark ? {borderColor: colors.border} : {backgroundColor: colors.primary},
                ]}
                onPress={onClaimRewards}>
                {colors.isDark ? (
                  <>
                    <Image source={images.rewardGames} style={styles.rewardHeroImg} resizeMode="cover" />
                    <View style={[styles.rewardOverlay, {backgroundColor: 'rgba(10,7,22,0.7)'}]} />
                    <View style={styles.rewardTextContent}>
                      <Text style={[styles.rewardTitle, {color: '#FFFFFF'}]}>Games</Text>
                      <Text style={[styles.rewardSub, {color: colors.textSecondary}]}>
                        Exciting games are waiting for you
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.rewardClassicTextWrap}>
                      <Text style={[styles.rewardClassicTitle, {color: '#FFFFFF'}]}>Games</Text>
                      <Text style={[styles.rewardClassicSub, {color: 'rgba(255,255,255,0.8)'}]}>
                        Exciting games are waiting for you
                      </Text>
                    </View>
                    <Image source={require('../../assets/home-games.png')} style={styles.rewardClassicImgGames} resizeMode="cover" />
                  </>
                )}
              </Pressable>

              {/* Videos */}
              <Pressable
                style={[
                  colors.isDark ? styles.rewardHeroCard : styles.rewardClassicCard,
                  colors.isDark ? {borderColor: colors.border} : {backgroundColor: '#E4EDFF'},
                ]}
                onPress={onClaimRewards}>
                {colors.isDark ? (
                  <>
                    <Image source={images.rewardVideos} style={styles.rewardHeroImg} resizeMode="cover" />
                    <View style={[styles.rewardOverlay, {backgroundColor: 'rgba(10,7,22,0.7)'}]} />
                    <View style={styles.rewardTextContent}>
                      <Text style={[styles.rewardTitle, {color: '#FFFFFF'}]}>Videos</Text>
                      <Text style={[styles.rewardSub, {color: colors.textSecondary}]}>
                        Watch unlimited funny videos
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.rewardClassicTextWrap}>
                      <Text style={[styles.rewardClassicTitle, {color: '#14142B'}]}>Videos</Text>
                      <Text style={[styles.rewardClassicSub, {color: '#1B4FD1'}]}>
                        Watch unlimited funny videos
                      </Text>
                    </View>
                    <Image source={require('../../assets/home-videos.png')} style={styles.rewardClassicImg} resizeMode="cover" />
                  </>
                )}
              </Pressable>

              {/* Offers */}
              <Pressable
                style={[
                  colors.isDark ? styles.rewardHeroCard : styles.rewardClassicCard,
                  colors.isDark ? {borderColor: colors.border} : {backgroundColor: '#FFF3DC'},
                ]}
                onPress={onClaimRewards}>
                {colors.isDark ? (
                  <>
                    <Image source={images.rewardOffers} style={styles.rewardHeroImg} resizeMode="cover" />
                    <View style={[styles.rewardOverlay, {backgroundColor: 'rgba(10,7,22,0.7)'}]} />
                    <View style={styles.rewardTextContent}>
                      <Text style={[styles.rewardTitle, {color: '#FFFFFF'}]}>Offers</Text>
                      <Text style={[styles.rewardSub, {color: colors.textSecondary}]}>
                        Food & products at special discounts
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.rewardClassicTextWrap}>
                      <Text style={[styles.rewardClassicTitle, {color: '#14142B'}]}>Offers</Text>
                      <Text style={[styles.rewardClassicSub, {color: '#8A5A00'}]}>
                        Food & products at special discounts
                      </Text>
                    </View>
                    <Image source={require('../../assets/home-offers.png')} style={styles.rewardClassicImg} resizeMode="cover" />
                  </>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          /* ----------------- COMPLETED STATE ----------------- */
          <>
            {/* Mission Complete Card */}
            <View
              style={[
                styles.missionDoneCard,
                {backgroundColor: colors.surface, borderColor: colors.border},
              ]}>
              <View style={styles.ringDoneWrap}>
                <Svg width={88} height={88} viewBox="0 0 80 80">
                  <Circle cx={40} cy={40} r={34} fill="none" stroke={colors.surfaceAlt} strokeWidth={9} />
                  <Circle
                    cx={40}
                    cy={40}
                    r={34}
                    fill="none"
                    stroke={colors.success}
                    strokeWidth={9}
                    strokeLinecap="round"
                    strokeDasharray={213.63}
                    strokeDashoffset={0}
                    transform="rotate(-90 40 40)"
                  />
                </Svg>
                <View style={styles.checkDoneIcon}>
                  <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M4 12.5l5 5L20 6.5" />
                  </Svg>
                </View>
              </View>
              <Text style={[styles.missionDoneTitle, {color: colors.text}]}>Mission complete</Text>
              <View style={styles.resultSentRow}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M4 12.5l5 5L20 6.5" />
                </Svg>
                <Text style={[styles.resultSentText, {color: colors.success}]}>
                  Result sent to your parent & teacher
                </Text>
              </View>
            </View>

            {/* Your reward is ready Unlocked Card */}
            <View
              style={[
                styles.claimUnlockedCard,
                colors.isDark
                  ? {backgroundColor: colors.surface, borderColor: colors.border}
                  : {backgroundColor: colors.primary, borderColor: colors.primary},
              ]}>
              <View style={styles.quizTextWrap}>
                <Text style={[styles.claimUnlockedTitle, {color: '#FFFFFF'}]}>
                  Your reward is ready
                </Text>
                <Text style={[styles.claimUnlockedSub, {color: colors.isDark ? colors.mutedText : 'rgba(255,255,255,0.82)'}]}>
                  Games, videos and offers are open for today
                </Text>
              </View>
              <Image
                source={images.claimReward}
                style={styles.giftImg}
                resizeMode="cover"
              />
            </View>

            {/* Claim Rewards Button */}
            <Pressable
              style={({pressed}) => [
                styles.claimBtnDark,
                colors.isDark
                  ? {backgroundColor: colors.primary}
                  : {backgroundColor: '#14142B'},
                pressed && styles.btnPressed,
              ]}
              onPress={onClaimRewards}>
              <Text style={[styles.claimBtnText, {color: '#FFFFFF'}]}>
                Claim rewards
              </Text>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12h14M13 6l6 6-6 6" />
              </Svg>
            </Pressable>

            {/* Unlocked Today Section */}
            <View style={styles.sectionCol}>
              <Text style={[styles.sectionHeading, {color: colors.text}]}>Unlocked today</Text>

              {/* Games */}
              <Pressable
                style={[
                  colors.isDark ? styles.rewardHeroCard : styles.rewardClassicCard,
                  colors.isDark ? {borderColor: colors.border} : {backgroundColor: colors.primary},
                ]}
                onPress={onClaimRewards}>
                {colors.isDark ? (
                  <>
                    <Image source={images.rewardGames} style={styles.rewardHeroImg} resizeMode="cover" />
                    <View style={[styles.rewardOverlay, {backgroundColor: 'rgba(10,7,22,0.7)'}]} />
                    <View style={styles.rewardTextContent}>
                      <Text style={[styles.rewardTitle, {color: '#FFFFFF'}]}>Games</Text>
                      <View style={styles.openNowRow}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <Rect x={4} y={10} width={16} height={11} rx={2} />
                          <Path d="M8 10V7a4 4 0 0 1 7.6-1.6" />
                        </Svg>
                        <Text style={[styles.openNowText, {color: colors.success}]}>Open now</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.rewardClassicTextWrap}>
                      <Text style={[styles.rewardClassicTitle, {color: '#FFFFFF'}]}>Games</Text>
                      <View style={styles.openNowRow}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <Rect x={4} y={10} width={16} height={11} rx={2} />
                          <Path d="M8 10V7a4 4 0 0 1 7.6-1.6" />
                        </Svg>
                        <Text style={[styles.openNowText, {color: 'rgba(255,255,255,0.9)'}]}>Open now</Text>
                      </View>
                    </View>
                    <Image source={require('../../assets/home-games.png')} style={styles.rewardClassicImgGames} resizeMode="cover" />
                  </>
                )}
              </Pressable>

              {/* Videos */}
              <Pressable
                style={[
                  colors.isDark ? styles.rewardHeroCard : styles.rewardClassicCard,
                  colors.isDark ? {borderColor: colors.border} : {backgroundColor: '#E4EDFF'},
                ]}
                onPress={onClaimRewards}>
                {colors.isDark ? (
                  <>
                    <Image source={images.rewardVideos} style={styles.rewardHeroImg} resizeMode="cover" />
                    <View style={[styles.rewardOverlay, {backgroundColor: 'rgba(10,7,22,0.7)'}]} />
                    <View style={styles.rewardTextContent}>
                      <Text style={[styles.rewardTitle, {color: '#FFFFFF'}]}>Videos</Text>
                      <View style={styles.openNowRow}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <Rect x={4} y={10} width={16} height={11} rx={2} />
                          <Path d="M8 10V7a4 4 0 0 1 7.6-1.6" />
                        </Svg>
                        <Text style={[styles.openNowText, {color: colors.success}]}>Open now</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.rewardClassicTextWrap}>
                      <Text style={[styles.rewardClassicTitle, {color: '#14142B'}]}>Videos</Text>
                      <Text style={[styles.openNowText, {color: '#1B4FD1'}]}>Open now</Text>
                    </View>
                    <Image source={require('../../assets/home-videos.png')} style={styles.rewardClassicImg} resizeMode="cover" />
                  </>
                )}
              </Pressable>

              {/* Offers */}
              <Pressable
                style={[
                  colors.isDark ? styles.rewardHeroCard : styles.rewardClassicCard,
                  colors.isDark ? {borderColor: colors.border} : {backgroundColor: '#FFF3DC'},
                ]}
                onPress={onClaimRewards}>
                {colors.isDark ? (
                  <>
                    <Image source={images.rewardOffers} style={styles.rewardHeroImg} resizeMode="cover" />
                    <View style={[styles.rewardOverlay, {backgroundColor: 'rgba(10,7,22,0.7)'}]} />
                    <View style={styles.rewardTextContent}>
                      <Text style={[styles.rewardTitle, {color: '#FFFFFF'}]}>Offers</Text>
                      <Text style={[styles.openNowText, {color: colors.primary}]}>₹150 deals open</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.rewardClassicTextWrap}>
                      <Text style={[styles.rewardClassicTitle, {color: '#14142B'}]}>Offers</Text>
                      <Text style={[styles.openNowText, {color: '#8A5A00'}]}>₹150 deals open</Text>
                    </View>
                    <Image source={require('../../assets/home-offers.png')} style={styles.rewardClassicImg} resizeMode="cover" />
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
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
    gap: spacing.md12,
    paddingHorizontal: spacing.pagePad,
    paddingTop: 16,
    paddingBottom: 16,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: '700',
  },
  headerTextWrap: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  headerSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  bellWrap: {
    position: 'relative',
  },
  bellBadgeDot: {
    position: 'absolute',
    right: 1,
    top: 1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 2,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing.pagePad,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 16,
  },
  demoTogglePill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginVertical: 2,
  },
  demoToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  missionHeroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  missionHeroTextWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 4,
  },
  missionHeroTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  missionHeroSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  imageRelative: {
    position: 'relative',
  },
  missionHeroImg: {
    width: '100%',
    height: 158,
  },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  missionHeroBtnWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  missionStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.pill,
  },
  missionStartBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
  topicCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  topicTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicOverline: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  continuePill: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continuePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: '700',
  },
  topicMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  topicTitleWrap: {
    flex: 1,
    gap: 3,
  },
  topicTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  topicSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  ringWrap: {
    width: 64,
    height: 64,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  trackBar: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fillBar: {
    height: 8,
    borderRadius: radius.pill,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  quizTextWrap: {
    flex: 1,
    gap: 3,
  },
  quizTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quizTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  takeQuizLink: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  takeQuizText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
  },
  quizSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  quizImg: {
    width: 76,
    height: 54,
    borderRadius: 12,
  },
  claimDashedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  giftImg: {
    width: 76,
    height: 60,
    borderRadius: 12,
  },

  // Subjects Section
  sectionCol: {
    gap: 12,
    paddingTop: 4,
  },
  sectionHeading: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
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
  subjectOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  subjectContentRow: {
    paddingHorizontal: 16,
    gap: 6,
  },
  subjectHeroTitle: {
    fontFamily: fonts.heading,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
  },
  subjectProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  subjectTrack: {
    width: 118,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  subjectFill: {
    height: 7,
  },
  subjectPctText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },

  // Rewards Section
  rewardHeroCard: {
    height: 92,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  rewardHeroImg: {
    width: '100%',
    height: 92,
    position: 'absolute',
  },
  rewardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  rewardTextContent: {
    paddingHorizontal: 16,
    gap: 2,
  },
  rewardTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: '700',
  },
  rewardSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
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

  // Completed state
  missionDoneCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: spacing.pagePad,
    borderRadius: 24,
    borderWidth: 1,
  },
  ringDoneWrap: {
    width: 88,
    height: 88,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDoneIcon: {
    position: 'absolute',
  },
  missionDoneTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  resultSentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultSentText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  claimUnlockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  claimUnlockedTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  claimUnlockedSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  claimBtnDark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.pill,
  },
  claimBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },

  // Classic specific rewards cards
  rewardClassicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  rewardClassicTextWrap: {
    flex: 1,
    gap: 2,
  },
  rewardClassicTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: '700',
  },
  rewardClassicSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },
  rewardClassicImgGames: {
    width: 118,
    height: 70,
    borderRadius: 14,
  },
  rewardClassicImg: {
    width: 104,
    height: 66,
    borderRadius: 14,
  },
});
