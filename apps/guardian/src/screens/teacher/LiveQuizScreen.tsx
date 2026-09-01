import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherLiveQuiz'>;

const QUESTION_COUNTS = [5, 10, 15, 20];

export function LiveQuizScreen({route, navigation}: Props) {
  const {
    classId,
    className,
    chapterName = 'Ch 2. Linear Equations',
    roomCode = `${className.replace(/[^a-zA-Z0-9]/g, '')}2X`.toUpperCase(),
  } = route.params;

  const [qCountIdx, setQCountIdx] = useState(1); // Default 10

  function onStartQuiz() {
    const summary = `${QUESTION_COUNTS[qCountIdx]} questions · room code ${roomCode}. Students join from their app.`;
    navigation.navigate('TeacherDone', {
      kind: 'quiz',
      classId,
      className,
      summary,
    });
  }

  return (
    <CosmicBackground>
      <CosmicHeader
        title="Take quiz"
        subtitle={`Class ${className}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {/* Live Quiz Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTag}>LIVE QUIZ</Text>
          <Text style={styles.bannerTitle}>
            Class {className} · {chapterName}
          </Text>
          <Text style={styles.bannerSub}>
            Runs in class · students join with the room code
          </Text>
        </View>

        {/* Questions Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUESTIONS</Text>
          <View style={styles.pillRow}>
            {QUESTION_COUNTS.map((cnt, idx) => {
              const active = qCountIdx === idx;
              return (
                <Pressable
                  key={cnt}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setQCountIdx(idx)}>
                  <Text
                    style={[styles.pillText, active && styles.pillTextActive]}>
                    {cnt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Room Code Card */}
        <View style={styles.codeCard}>
          <View>
            <Text style={styles.codeTitle}>Room code</Text>
            <Text style={styles.codeSub}>Share on the board</Text>
          </View>
          <Text style={styles.codeValue}>{roomCode}</Text>
        </View>

        {/* Start Quiz Button */}
        <Pressable style={styles.startBtn} onPress={onStartQuiz}>
          <Text style={styles.startBtnText}>Start quiz</Text>
        </Pressable>

        <View style={{height: 40}} />
      </ScrollView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: cosmicSpacing.lg,
    paddingTop: cosmicSpacing.xs,
    gap: cosmicSpacing.md,
  },
  banner: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: cosmicColors.cyanBg,
    borderWidth: 1,
    borderColor: cosmicColors.cyanBorder,
  },
  bannerTag: {
    color: cosmicColors.cyanLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  bannerTitle: {
    color: cosmicColors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 7,
  },
  bannerSub: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12.5,
    marginTop: 3,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: cosmicColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginHorizontal: 2,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 9,
  },
  pill: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: cosmicColors.purpleBg,
    borderColor: cosmicColors.purpleBorder,
  },
  pillText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  codeCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeTitle: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  codeSub: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  codeValue: {
    color: cosmicColors.cyanLight,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
  startBtn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: cosmicColors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: cosmicColors.purple,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 4,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
