/**
 * TopicScreen — Class 6–12 Interactive Topic Learn Screen (Grade 7+).
 *
 * Connected 7-Section Journey:
 *  1. Explanation & Examples
 *  2. Watch & Learn (Video explanation)
 *  3. Practice (Worked problems with steps & common mistakes)
 *  4. Curiosity (Why / What if brainstorming)
 *  5. Real-Life Connections
 *  6. Common Mistakes & Misconceptions
 *  7. Experiment & Hands-on Activity
 *
 * Follows Phase 4 Design ("Choose Your World" / ZerebroKid Learning & Quiz).
 */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
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
  sectionsForCollapsibleList,
  sectionsFromLegacyFields,
  useTopicContent,
  type BrainstormingItem,
  type MisconceptionItem,
  type RealLifeConnectionItem,
  type ActivityItem,
  type WorkedProblem,
} from '../../firebase/study';
import {AIDoubtModal} from './components/AIDoubtModal';
import {TopicMarkdownContent} from './components/TopicMarkdownContent';
import {VideoPlayer} from './components/VideoPlayer';
import {CollapsibleSectionList} from './components/CollapsibleSectionList';
import {fonts, radius, spacing} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import type {StudyStackParamList} from '../../navigation/types';

import {useTopicProgressStore} from '../../state/topicProgressStore';

type Props = NativeStackScreenProps<StudyStackParamList, 'TopicLearn'>;

interface SectionMeta {
  num: number;
  title: string;
  shortTitle: string;
  sub: string;
}

const SECTIONS_META: SectionMeta[] = [
  {num: 1, title: 'Explanation', shortTitle: '1. Explanation', sub: 'The concept in simple words'},
  {num: 2, title: 'Watch & Learn', shortTitle: '2. Watch & Learn', sub: 'Video explanation'},
  {num: 3, title: 'Practice', shortTitle: '3. Practice', sub: 'Try it yourself'},
  {num: 4, title: 'Curiosity', shortTitle: '4. Curiosity', sub: 'Why does this work?'},
  {num: 5, title: 'Real-Life', shortTitle: '5. Real-Life', sub: 'Real-world connections'},
  {num: 6, title: 'Common Mistakes', shortTitle: '6. Mistakes', sub: 'Spot them before exams'},
  {num: 7, title: 'Experiment', shortTitle: '7. Experiment', sub: 'Hands-on activity'},
];

export function TopicScreen({route, navigation}: Props) {
  const {
    assignmentId,
    curriculumId,
    chapterId,
    topicId,
    topicName,
    sectionNum,
  } = route.params;
  const {theme} = useTheme();
  const {colors} = theme;

  const scrollRef = useRef<ScrollView>(null);
  const tabsScrollRef = useRef<ScrollView>(null);

  const initialSec = sectionNum ? Math.max(1, Math.min(7, sectionNum)) : 1;
  const [activeSectionNum, setActiveSectionNum] = useState<number>(initialSec);

  const {markSectionCompleted, isSectionCompleted} = useTopicProgressStore();
  const topicKey = topicId || assignmentId;

  const {data: topic, loading, error} = useTopicContent(
    curriculumId,
    chapterId,
    topicId,
  );

  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [expandedCuriosity, setExpandedCuriosity] = useState<Record<number, boolean>>({});
  const [expandedProblems, setExpandedProblems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (route.params.sectionNum) {
      const validSec = Math.max(1, Math.min(7, route.params.sectionNum));
      setActiveSectionNum(validSec);
    }
  }, [route.params.sectionNum]);

  const selectSection = (num: number) => {
    setActiveSectionNum(num);
    scrollRef.current?.scrollTo({y: 0, animated: true});
  };

  const toggleCuriosity = (index: number) => {
    setExpandedCuriosity(prev => ({...prev, [index]: !prev[index]}));
  };

  const toggleProblem = (problemId: string) => {
    setExpandedProblems(prev => ({...prev, [problemId]: !prev[problemId]}));
  };

  const hasExplanation = Boolean(topic?.explanation?.trim() || (topic?.examples && topic.examples.length > 0));
  const hasVideo = Boolean(topic?.videoUrl?.trim());
  const hasBrainstorming = Boolean(topic?.brainstorming && topic.brainstorming.length > 0);
  const hasRealLife = Boolean(topic?.realLifeConnections && topic.realLifeConnections.length > 0);
  const hasMisconceptions = Boolean(topic?.misconceptions && topic.misconceptions.length > 0);
  const hasActivities = Boolean(topic?.activities && topic.activities.length > 0);
  const hasWorkedProblems = Boolean(topic?.workedProblems && topic.workedProblems.length > 0);

  const hasAnyTypedLayer =
    hasExplanation ||
    hasVideo ||
    hasBrainstorming ||
    hasRealLife ||
    hasMisconceptions ||
    hasActivities ||
    hasWorkedProblems;

  const fallbackSections = useMemo(() => {
    if (!topic) return [];
    if (topic.sections && topic.sections.length > 0) {
      return sectionsForCollapsibleList(topic.sections);
    }
    if (!hasAnyTypedLayer) {
      return sectionsFromLegacyFields(topic);
    }
    return [];
  }, [topic, hasAnyTypedLayer]);

  const onStartQuiz = () => {
    navigation.navigate('Quiz', {
      assignmentId,
      curriculumId,
      chapterId,
      topicId,
      topicName: topic?.topicName || topicName,
    });
  };

  const onMarkUnderstood = () => {
    markSectionCompleted(topicKey, activeSectionNum);
    navigation.goBack();
  };

  // 1. Loading State
  if (loading) {
    return (
      <View style={[styles.centered, {backgroundColor: colors.bg}]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, {color: colors.mutedText}]}>
          Loading topic content…
        </Text>
      </View>
    );
  }

  // 2. Error State / Not Found
  if (error || !topic) {
    return (
      <View style={[styles.centered, {backgroundColor: colors.bg}]}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={[styles.errorTitle, {color: '#EF4444'}]}>
          Unable to load topic
        </Text>
        <Text style={[styles.errorBody, {color: colors.mutedText}]}>
          {error || 'This topic could not be found. Please check your assignments.'}
        </Text>
        <Pressable
          style={[styles.outlineBtn, {borderColor: colors.border, backgroundColor: colors.surface}]}
          onPress={() => navigation.goBack()}>
          <Text style={[styles.outlineBtnText, {color: colors.text}]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // 3. Draft Status
  if (topic.status === 'draft') {
    return (
      <View style={[styles.centered, {backgroundColor: colors.bg}]}>
        <Text style={styles.errorEmoji}>📝</Text>
        <Text style={[styles.errorTitle, {color: colors.text}]}>
          Topic not ready
        </Text>
        <Text style={[styles.errorBody, {color: colors.mutedText}]}>
          This lesson is currently being prepared and is not published yet.
        </Text>
        <Pressable
          style={[styles.outlineBtn, {borderColor: colors.border, backgroundColor: colors.surface}]}
          onPress={() => navigation.goBack()}>
          <Text style={[styles.outlineBtnText, {color: colors.text}]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const displayTitle = topic.topicName || topicName;
  const displayChapter = topic.chapterName
    ? (topic.chapterNo ? `Ch ${topic.chapterNo} · ${topic.chapterName}` : topic.chapterName)
    : null;

  const currentSectionMeta = SECTIONS_META[activeSectionNum - 1] || SECTIONS_META[0];
  const nextSectionMeta = activeSectionNum < 7 ? SECTIONS_META[activeSectionNum] : null;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      {/* Top App Bar with Progress & Section Navigator */}
      <SafeAreaView edges={['top']} style={[styles.appBarSafe, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
        <View style={styles.appBarRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 5l-7 7 7 7" />
            </Svg>
          </Pressable>

          <View style={[styles.sectionPill, {backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder}]}>
            <Text style={[styles.sectionPillText, {color: colors.textAccentMuted}]} numberOfLines={1}>
              Section {activeSectionNum} · {currentSectionMeta.title}
            </Text>
          </View>

          <View style={styles.counterWrap}>
            <Text style={[styles.counterText, {color: colors.textSecondary}]}>
              {activeSectionNum} / 7
            </Text>
          </View>

          <Pressable
            style={[styles.askAiPillBtn, {backgroundColor: colors.badgeBg, borderColor: colors.primary}]}
            onPress={() => setShowAiModal(true)}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5a4 4 0 0 0-4 4 3 3 0 0 0 0 6 3.5 3.5 0 0 0 4 3.4z" />
              <Path d="M12 5a4 4 0 0 1 4 4 3 3 0 0 1 0 6 3.5 3.5 0 0 1-4 3.4z" />
            </Svg>
            <Text style={[styles.askAiPillText, {color: colors.primary}]}>Ask AI</Text>
          </Pressable>
        </View>

        {/* Progress Bar (0 to 100%) */}
        <View style={[styles.progressBarTrack, {backgroundColor: colors.surfaceAlt}]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${(activeSectionNum / 7) * 100}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        {/* Horizontal Section Stepper Tabs (Commented out per user request)
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}>
          {SECTIONS_META.map(sec => {
            const isSelected = sec.num === activeSectionNum;
            return (
              <Pressable
                key={sec.num}
                style={[
                  styles.tabChip,
                  isSelected
                    ? {backgroundColor: colors.primary, borderColor: colors.primary}
                    : {backgroundColor: colors.surfaceAlt, borderColor: colors.border},
                ]}
                onPress={() => selectSection(sec.num)}>
                <Text
                  style={[
                    styles.tabChipText,
                    {color: isSelected ? colors.onPrimary : colors.textSecondary},
                  ]}>
                  {sec.shortTitle}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        */}
      </SafeAreaView>

      {/* Main Learning Scroll for Active Section */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Topic Title Header */}
        <View style={styles.topicHeaderWrap}>
          <Text style={[styles.topicHeading, {color: colors.text}]}>
            {displayTitle}
          </Text>
          <Text style={[styles.topicSubheading, {color: colors.textSecondary}]}>
            {displayChapter || (topic.subject ? `${topic.subject} · Class ${topic.grade || '7+'}` : 'Study Mission')}
          </Text>
        </View>

        {/* ================= 1. EXPLANATION & EXAMPLES ================= */}
        {activeSectionNum === 1 && (
          <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardBadge, {backgroundColor: colors.badgeBg}]}>
                <Text style={[styles.cardBadgeText, {color: colors.textAccentMuted}]}>1 · EXPLANATION</Text>
              </View>
            </View>

            {hasExplanation ? (
              <>
                {topic.explanation ? (
                  <TopicMarkdownContent style={{color: colors.text}}>
                    {topic.explanation}
                  </TopicMarkdownContent>
                ) : null}

                {topic.examples && topic.examples.length > 0 ? (
                  <View style={styles.examplesWrap}>
                    <Text style={[styles.subSectionTitle, {color: colors.primary}]}>
                      Examples
                    </Text>
                    {topic.examples.map((example, idx) => (
                      <View
                        key={idx}
                        style={[styles.exampleItemCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
                        <View style={[styles.exampleNumberBadge, {backgroundColor: colors.badgeBg}]}>
                          <Text style={[styles.exampleNumberText, {color: colors.primary}]}>
                            #{idx + 1}
                          </Text>
                        </View>
                        <View style={styles.exampleContentCol}>
                          <TopicMarkdownContent style={{color: colors.text}}>
                            {example}
                          </TopicMarkdownContent>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : fallbackSections.length > 0 ? (
              <CollapsibleSectionList sections={[fallbackSections[0]]} />
            ) : (
              <View style={styles.emptySectionBox}>
                <Text style={[styles.emptySectionText, {color: colors.mutedText}]}>
                  Read through the concept above to build a strong foundation before watching the video.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ================= 2. VIDEO LAYER (WATCH & LEARN) ================= */}
        {activeSectionNum === 2 && (
          <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardBadge, {backgroundColor: colors.badgeBg}]}>
                <Text style={[styles.cardBadgeText, {color: colors.textAccentMuted}]}>2 · WATCH & LEARN</Text>
              </View>
            </View>

            {hasVideo ? (
              <>
                <Text style={[styles.videoIntroText, {color: colors.mutedText}]}>
                  Watch this video to understand the concept step by step.
                </Text>
                <VideoPlayer url={topic.videoUrl!} title={displayTitle} />

                {/* Ask AI moment card */}
                <Pressable
                  style={[styles.askAiMomentCard, {backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder}]}
                  onPress={() => setShowAiModal(true)}>
                  <View style={[styles.askAiIconCircle, {backgroundColor: colors.primary}]}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M12 5a4 4 0 0 0-4 4 3 3 0 0 0 0 6 3.5 3.5 0 0 0 4 3.4z" />
                      <Path d="M12 5a4 4 0 0 1 4 4 3 3 0 0 1 0 6 3.5 3.5 0 0 1-4 3.4z" />
                    </Svg>
                  </View>
                  <View style={{flex: 1, gap: 2}}>
                    <Text style={[styles.askAiMomentTitle, {color: colors.text}]}>
                      Have a doubt while watching?
                    </Text>
                    <Text style={[styles.askAiMomentSub, {color: colors.textSecondary}]}>
                      Ask AI anything about this lesson instantly.
                    </Text>
                  </View>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M9 5l7 7-7 7" />
                  </Svg>
                </Pressable>
              </>
            ) : fallbackSections.length > 1 && fallbackSections[1]?.videoUrl ? (
              <VideoPlayer url={fallbackSections[1].videoUrl} title={displayTitle} />
            ) : (
              <View style={styles.emptySectionBox}>
                <Text style={styles.emptyIcon}>🎥</Text>
                <Text style={[styles.emptySectionTitle, {color: colors.text}]}>
                  Video Walkthrough
                </Text>
                <Text style={[styles.emptySectionText, {color: colors.mutedText}]}>
                  Follow the interactive steps and explanations to continue mastering this topic.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ================= 3. WORKED PROBLEMS / PRACTICE ================= */}
        {activeSectionNum === 3 && (
          <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardBadge, {backgroundColor: colors.badgeBg}]}>
                <Text style={[styles.cardBadgeText, {color: colors.textAccentMuted}]}>3 · PRACTICE & WORKED PROBLEMS</Text>
              </View>
            </View>

            {hasWorkedProblems ? (
              <View style={styles.problemsList}>
                {topic.workedProblems!.map((prob: WorkedProblem, idx: number) => {
                  const isExpanded = expandedProblems[prob.problemId || String(idx)] ?? true;
                  return (
                    <View
                      key={prob.problemId || idx}
                      style={[styles.problemCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
                      <Pressable
                        style={styles.problemHeader}
                        onPress={() => toggleProblem(prob.problemId || String(idx))}>
                        <View style={[styles.problemNumBadge, {backgroundColor: colors.badgeBg}]}>
                          <Text style={[styles.problemNumText, {color: colors.primary}]}>P{idx + 1}</Text>
                        </View>
                        <Text style={[styles.problemQuestion, {color: colors.text}]}>
                          {prob.question}
                        </Text>
                        <Text style={[styles.chevronText, {color: colors.mutedText}]}>
                          {isExpanded ? '▲' : '▼'}
                        </Text>
                      </Pressable>

                      {isExpanded ? (
                        <View style={[styles.problemBody, {borderTopColor: colors.border}]}>
                          {prob.conceptsUsed && prob.conceptsUsed.length > 0 ? (
                            <View style={styles.problemConceptRow}>
                              <Text style={[styles.problemConceptLabel, {color: colors.textAccentMuted}]}>Concept:</Text>
                              <Text style={[styles.problemConceptValue, {color: colors.textSecondary}]}>
                                {prob.conceptsUsed.join(', ')}
                              </Text>
                            </View>
                          ) : null}

                          {prob.steps && prob.steps.length > 0 ? (
                            <View style={styles.problemStepsCol}>
                              <Text style={[styles.problemSectionLabel, {color: colors.textAccentMuted}]}>STEPS</Text>
                              {prob.steps.map((step, sIdx) => (
                                <View key={sIdx} style={styles.stepItemRow}>
                                  <Text style={[styles.stepDot, {color: colors.primary}]}>{sIdx + 1}.</Text>
                                  <Text style={[styles.stepItemText, {color: colors.text}]}>{step}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}

                          {prob.answer ? (
                            <View style={[styles.problemAnswerBox, {backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder}]}>
                              <Text style={[styles.answerBoxLabel, {color: colors.primary}]}>Answer</Text>
                              <Text style={[styles.answerBoxText, {color: colors.text}]}>{prob.answer}</Text>
                            </View>
                          ) : null}

                          {prob.commonMistake ? (
                            <View style={styles.mistakeCallout}>
                              <Text style={[styles.mistakeCalloutLabel, {color: '#EF4444'}]}>Common Mistake:</Text>
                              <Text style={[styles.mistakeCalloutText, {color: colors.mutedText}]}>{prob.commonMistake}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : fallbackSections.length > 2 ? (
              <CollapsibleSectionList sections={[fallbackSections[2]]} />
            ) : (
              <View style={styles.emptySectionBox}>
                <Text style={styles.emptyIcon}>✏️</Text>
                <Text style={[styles.emptySectionTitle, {color: colors.text}]}>
                  Practice Session
                </Text>
                <Text style={[styles.emptySectionText, {color: colors.mutedText}]}>
                  Practice questions prepare you for test readiness. Continue to curiosity questions and quiz.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ================= 4. CURIOSITY LAYER / BRAINSTORMING ================= */}
        {activeSectionNum === 4 && (
          <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardBadge, {backgroundColor: colors.badgeBg}]}>
                <Text style={[styles.cardBadgeText, {color: colors.textAccentMuted}]}>4 · CURIOSITY & BRAINSTORMING</Text>
              </View>
            </View>
            <Text style={[styles.cardDescSub, {color: colors.mutedText}]}>
              Think through these curiosity questions to deepen your understanding:
            </Text>

            {hasBrainstorming ? (
              <View style={styles.accordionList}>
                {topic.brainstorming!.map((item: BrainstormingItem, idx: number) => {
                  const isExpanded = expandedCuriosity[idx] ?? true;
                  return (
                    <View
                      key={idx}
                      style={[styles.accordionCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
                      <Pressable
                        style={styles.accordionHeader}
                        onPress={() => toggleCuriosity(idx)}>
                        <View style={[styles.curiosityQBadge, {backgroundColor: colors.badgeBg}]}>
                          <Text style={[styles.curiosityQText, {color: colors.primary}]}>Q{idx + 1}</Text>
                        </View>
                        <Text style={[styles.accordionQuestion, {color: colors.text}]}>
                          {item.question}
                        </Text>
                        <Text style={[styles.chevronText, {color: colors.mutedText}]}>
                          {isExpanded ? '▲' : '▼'}
                        </Text>
                      </Pressable>

                      {isExpanded ? (
                        <View style={[styles.accordionBody, {borderTopColor: colors.border}]}>
                          <Text style={[styles.answerLabelText, {color: colors.success}]}>Answer</Text>
                          <TopicMarkdownContent style={{color: colors.text}}>
                            {item.answer}
                          </TopicMarkdownContent>
                          {item.videoUrl ? (
                            <View style={styles.subVideoWrap}>
                              <VideoPlayer url={item.videoUrl} title={item.question} />
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : fallbackSections.length > 3 ? (
              <CollapsibleSectionList sections={[fallbackSections[3]]} />
            ) : (
              <View style={styles.emptySectionBox}>
                <Text style={styles.emptyIcon}>💡</Text>
                <Text style={[styles.emptySectionTitle, {color: colors.text}]}>
                  Deep Dive & Curiosity
                </Text>
                <Text style={[styles.emptySectionText, {color: colors.mutedText}]}>
                  Think about why formulas work and what happens in edge cases.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ================= 5. REAL-LIFE CONNECTIONS ================= */}
        {activeSectionNum === 5 && (
          <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardBadge, {backgroundColor: colors.badgeBg}]}>
                <Text style={[styles.cardBadgeText, {color: colors.textAccentMuted}]}>5 · REAL-LIFE CONNECTIONS</Text>
              </View>
            </View>

            {hasRealLife ? (
              <View style={styles.realLifeList}>
                {topic.realLifeConnections!.map((item: RealLifeConnectionItem, idx: number) => (
                  <View
                    key={idx}
                    style={[styles.realLifeCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
                    <View style={styles.realLifeTitleRow}>
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                        <Circle cx={12} cy={12} r={8} />
                        <Path d="M4 12h16" />
                        <Path d="M12 4c2.6 3.2 2.6 12.8 0 16-2.6-3.2-2.6-12.8 0-16z" />
                      </Svg>
                      <Text style={[styles.realLifeTitle, {color: colors.text}]}>
                        {item.title}
                      </Text>
                    </View>
                    <TopicMarkdownContent style={{color: colors.textSecondary}}>
                      {item.description}
                    </TopicMarkdownContent>
                    {item.videoUrl ? (
                      <View style={styles.subVideoWrap}>
                        <VideoPlayer url={item.videoUrl} title={item.title} />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : fallbackSections.length > 4 ? (
              <CollapsibleSectionList sections={[fallbackSections[4]]} />
            ) : (
              <View style={styles.emptySectionBox}>
                <Text style={styles.emptyIcon}>🌍</Text>
                <Text style={[styles.emptySectionTitle, {color: colors.text}]}>
                  Real-World Applications
                </Text>
                <Text style={[styles.emptySectionText, {color: colors.mutedText}]}>
                  Discover where this concept is used in everyday life, science, and technology.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ================= 6. MISCONCEPTIONS & COMMON MISTAKES ================= */}
        {activeSectionNum === 6 && (
          <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardBadge, {backgroundColor: colors.badgeBg}]}>
                <Text style={[styles.cardBadgeText, {color: colors.textAccentMuted}]}>6 · COMMON MISTAKES & MISCONCEPTIONS</Text>
              </View>
            </View>

            {hasMisconceptions ? (
              <View style={styles.misconceptionsList}>
                {topic.misconceptions!.map((item: MisconceptionItem, idx: number) => (
                  <View
                    key={idx}
                    style={[styles.misconceptionCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
                    {/* Wrong */}
                    <View style={styles.wrongBox}>
                      <Text style={[styles.wrongLabel, {color: '#EF4444'}]}>✗ Wrong Approach</Text>
                      <TopicMarkdownContent style={{color: colors.mutedText}}>
                        {item.wrong}
                      </TopicMarkdownContent>
                    </View>

                    <View style={[styles.misconceptionDivider, {backgroundColor: colors.border}]} />

                    {/* Correct */}
                    <View style={styles.correctBox}>
                      <Text style={[styles.correctLabel, {color: colors.success}]}>✓ Correct Understanding</Text>
                      <TopicMarkdownContent style={{color: colors.text}}>
                        {item.correct}
                      </TopicMarkdownContent>
                    </View>
                  </View>
                ))}
              </View>
            ) : fallbackSections.length > 5 ? (
              <CollapsibleSectionList sections={[fallbackSections[5]]} />
            ) : (
              <View style={styles.emptySectionBox}>
                <Text style={styles.emptyIcon}>⚠️</Text>
                <Text style={[styles.emptySectionTitle, {color: colors.text}]}>
                  Exam Tips & Mistakes
                </Text>
                <Text style={[styles.emptySectionText, {color: colors.mutedText}]}>
                  Keep an eye out for common calculation traps and sign mistakes before taking the quiz.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ================= 7. ACTIVITIES & EXPERIMENTS ================= */}
        {activeSectionNum === 7 && (
          <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardBadge, {backgroundColor: colors.badgeBg}]}>
                <Text style={[styles.cardBadgeText, {color: colors.textAccentMuted}]}>7 · EXPERIMENT & ACTIVITIES</Text>
              </View>
            </View>

            {hasActivities ? (
              <View style={styles.activitiesList}>
                {topic.activities!.map((item: ActivityItem, idx: number) => (
                  <View
                    key={idx}
                    style={[styles.activityCard, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
                    <View style={styles.activityTitleRow}>
                      <View style={[styles.activityNumBadge, {backgroundColor: colors.badgeBg}]}>
                        <Text style={[styles.activityNumText, {color: colors.primary}]}>#{idx + 1}</Text>
                      </View>
                      <Text style={[styles.activityTitle, {color: colors.text}]}>
                        {item.title}
                      </Text>
                    </View>
                    <TopicMarkdownContent style={{color: colors.text}}>
                      {item.instructions}
                    </TopicMarkdownContent>
                    {item.videoUrl ? (
                      <View style={styles.subVideoWrap}>
                        <VideoPlayer url={item.videoUrl} title={item.title} />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : fallbackSections.length > 6 ? (
              <CollapsibleSectionList sections={[fallbackSections[6]]} />
            ) : (
              <View style={styles.emptySectionBox}>
                <Text style={styles.emptyIcon}>🔬</Text>
                <Text style={[styles.emptySectionTitle, {color: colors.text}]}>
                  Hands-on Activity
                </Text>
                <Text style={[styles.emptySectionText, {color: colors.mutedText}]}>
                  Try applying this concept on paper or with simple materials around you. You are now ready for the Quiz!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Spacing for bottom bar */}
        <View style={{height: 140}} />
      </ScrollView>

      {/* Floating AI Doubt Button */}
      <Pressable
        style={[styles.fabAi, {backgroundColor: colors.primary}]}
        onPress={() => setShowAiModal(true)}>
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 5a4 4 0 0 0-4 4 3 3 0 0 0 0 6 3.5 3.5 0 0 0 4 3.4z" />
          <Path d="M12 5a4 4 0 0 1 4 4 3 3 0 0 1 0 6 3.5 3.5 0 0 1-4 3.4z" />
        </Svg>
      </Pressable>

      {/* Sticky Bottom Bar with Contextual Next Action */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomSafeArea, {backgroundColor: colors.navBg}]}>
        <View style={[styles.bottomBar, {backgroundColor: colors.navBg, borderTopColor: colors.border}]}>
          <View style={styles.bottomBarInfoRow}>
            <Text style={[styles.bottomBarNextLabel, {color: colors.textSecondary}]}>
              {activeSectionNum < 7 && nextSectionMeta
                ? `Next up · Section ${nextSectionMeta.num} — ${nextSectionMeta.title}`
                : 'Last section · the quiz unlocks after this'}
            </Text>
          </View>

          <Pressable
            style={({pressed}) => [
              styles.actionBtn,
              {backgroundColor: colors.primary},
              pressed && styles.btnPressed,
            ]}
            onPress={onMarkUnderstood}>
            <Text style={[styles.actionBtnText, {color: colors.onPrimary}]}>
              {activeSectionNum === 2
                ? 'Mark as watched'
                : 'Mark as understood'}
            </Text>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 12.5l5 5L20 6.5" />
            </Svg>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* AI Doubt Modal */}
      <AIDoubtModal
        visible={showAiModal}
        onClose={() => setShowAiModal(false)}
        topicTitle={displayTitle}
        sectionTitle={`Section ${activeSectionNum} · ${currentSectionMeta.title}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.pagePad,
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  errorEmoji: {
    fontSize: 44,
  },
  errorTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  outlineBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },

  // Top App Bar
  appBarSafe: {
    borderBottomWidth: 1,
  },
  appBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.pagePad,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionPill: {
    flex: 1,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  sectionPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  counterWrap: {
    paddingHorizontal: 4,
  },
  counterText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  askAiPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  askAiPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: '700',
  },

  // Progress bar
  progressBarTrack: {
    height: 4,
    width: '100%',
  },
  progressBarFill: {
    height: 4,
  },

  // Tabs scroll
  tabsScrollContent: {
    paddingHorizontal: spacing.pagePad,
    paddingVertical: 8,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: '600',
  },

  // Main scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePad,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  topicHeaderWrap: {
    gap: 4,
    paddingBottom: 4,
  },
  topicHeading: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  topicSubheading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
  },

  // Card Surfaces
  cardSurface: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardDescSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },

  // Empty section state
  emptySectionBox: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptySectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySectionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },

  // Examples
  examplesWrap: {
    gap: 10,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  subSectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  exampleItemCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  exampleNumberBadge: {
    width: 32,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleNumberText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  exampleContentCol: {
    flex: 1,
  },

  // Video
  videoIntroText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  askAiMomentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  askAiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askAiMomentTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  askAiMomentSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },

  // Accordion (Curiosity)
  accordionList: {
    gap: 10,
  },
  accordionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  curiosityQBadge: {
    width: 28,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curiosityQText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  accordionQuestion: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  chevronText: {
    fontSize: 11,
    marginTop: 4,
  },
  accordionBody: {
    borderTopWidth: 1,
    padding: 14,
    gap: 8,
  },
  answerLabelText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  subVideoWrap: {
    marginTop: 6,
  },

  // Real life
  realLifeList: {
    gap: 10,
  },
  realLifeCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  realLifeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  realLifeTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '700',
  },

  // Misconceptions
  misconceptionsList: {
    gap: 12,
  },
  misconceptionCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  wrongBox: {
    gap: 4,
  },
  wrongLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  misconceptionDivider: {
    height: 1,
  },
  correctBox: {
    gap: 4,
  },
  correctLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Activities
  activitiesList: {
    gap: 10,
  },
  activityCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityNumBadge: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityNumText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  activityTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '700',
  },

  // Practice problems
  problemsList: {
    gap: 10,
  },
  problemCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  problemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  problemNumBadge: {
    width: 28,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  problemNumText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  problemQuestion: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  problemBody: {
    borderTopWidth: 1,
    padding: 14,
    gap: 10,
  },
  problemConceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  problemConceptLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  problemConceptValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  problemStepsCol: {
    gap: 6,
  },
  problemSectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  stepDot: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  stepItemText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
  problemAnswerBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  answerBoxLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  answerBoxText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  mistakeCallout: {
    gap: 2,
  },
  mistakeCalloutLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '700',
  },
  mistakeCalloutText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },

  // Floating AI Doubt Button
  fabAi: {
    position: 'absolute',
    right: 20,
    bottom: 96,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  // Bottom Sticky Bar
  bottomSafeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.pagePad,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  bottomBarInfoRow: {
    alignItems: 'center',
  },
  bottomBarNextLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
  },
  actionBtn: {
    height: 54,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
});
