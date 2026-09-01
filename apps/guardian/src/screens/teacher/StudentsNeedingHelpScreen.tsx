import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

type Props = NativeStackScreenProps<
  TeacherStackParamList,
  'TeacherStudentsNeedingHelp'
>;

const HELP_STUDENTS = [
  {ini: 'AK', name: 'Aarav Kapoor', roll: '04', cls: '8A', note: 'Word problems', score: '35%'},
  {ini: 'MS', name: 'Meera Sharma', roll: '11', cls: '8A', note: 'Variables both sides', score: '38%'},
  {ini: 'KG', name: 'Kabir Gupta', roll: '02', cls: '8B', note: 'Square roots', score: '39%'},
  {ini: 'NM', name: 'Nitya Menon', roll: '03', cls: '7C', note: 'Integers', score: '28%'},
  {ini: 'AY', name: 'Arjun Yadav', roll: '08', cls: '7C', note: 'Dividing integers', score: '33%'},
  {ini: 'RB', name: 'Riya Bose', roll: '15', cls: '7C', note: 'Fractions ok', score: '48%'},
];

export function StudentsNeedingHelpScreen({navigation}: Props) {
  return (
    <CosmicBackground>
      <CosmicHeader
        title="Students needing help"
        subtitle={`${HELP_STUDENTS.length} students across all classes`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <View style={styles.list}>
          {HELP_STUDENTS.map(s => (
            <Pressable
              key={s.name + s.cls}
              style={styles.card}
              onPress={() =>
                navigation.navigate('TeacherStudentDetail', {
                  studentName: s.name,
                  rollNo: s.roll,
                  className: s.cls,
                  score: Number.parseInt(s.score, 10) || 35,
                })
              }>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{s.ini}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.sub}>
                  Class {s.cls} · {s.note}
                </Text>
              </View>
              <Text style={styles.score}>{s.score}</Text>
            </Pressable>
          ))}
        </View>
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
  },
  list: {
    gap: 10,
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: cosmicColors.pinkBg,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: cosmicColors.pinkLight,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    flex: 1,
  },
  name: {
    color: cosmicColors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  sub: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  score: {
    color: cosmicColors.pinkLight,
    fontSize: 15,
    fontWeight: '700',
  },
});
