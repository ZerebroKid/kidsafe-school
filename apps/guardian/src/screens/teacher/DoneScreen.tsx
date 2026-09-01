import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherDone'>;

export function DoneScreen({route, navigation}: Props) {
  const {kind, classId, className, summary} = route.params;

  const isQuiz = kind === 'quiz';
  const title = isQuiz
    ? `Quiz is live for ${className}`
    : `Assigned to Class ${className}`;

  return (
    <CosmicBackground>
      <View style={styles.container}>
        {/* Glow checkmark circle */}
        <View style={styles.glowCircleOuter}>
          <View style={styles.glowCircleInner}>
            <Text style={styles.checkGlyph}>✓</Text>
          </View>
        </View>

        {/* Title and Summary */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.summary}>{summary}</Text>

        {/* Action buttons */}
        <View style={styles.actionsWrap}>
          {classId ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() =>
                navigation.replace('TeacherClassReport', {
                  classId,
                  className,
                })
              }>
              <Text style={styles.primaryBtnText}>Track in class report</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('TeacherTabs')}>
            <Text style={styles.secondaryBtnText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: cosmicSpacing.xl,
    gap: 16,
  },
  glowCircleOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: cosmicColors.cyan,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 8,
  },
  glowCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: cosmicColors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    color: '#0B0620',
    fontSize: 30,
    fontWeight: '900',
  },
  title: {
    color: cosmicColors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  summary: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 290,
  },
  actionsWrap: {
    width: '100%',
    gap: 12,
    marginTop: 18,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: cosmicColors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: cosmicColors.purple,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
