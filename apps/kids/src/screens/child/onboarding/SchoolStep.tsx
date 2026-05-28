import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';

import {callFn} from '@zerebro/shared-firebase';
import {getUserDoc} from '@zerebro/shared-firebase/auth';

import {Button} from '../../../components/Button';
import {Screen} from '../../../components/Screen';
import {TextInput} from '../../../components/TextInput';
import {useAuthStore} from '../../../state/authStore';
import {colors, spacing} from '../../../theme';

/**
 * P4.4 -- child enters the school code + grade + section to link to their
 * class roster.
 *
 * Mounted by `ChildNavigator` between Pairing and PermissionsOnboarding,
 * only when the child has paired with a parent (`users/{uid}.parentUid` set)
 * but has NOT yet joined a school (`users/{uid}.schoolIds` is empty or
 * missing). Once `joinSchool` succeeds, `schoolIds` gets the schoolId
 * array-unioned in, the next user-doc tick re-evaluates the gate, and
 * the child moves forward to PermissionsOnboarding.
 *
 * UNLIKE Pairing this is a Cloud Function call (not a direct Firestore
 * read) -- the school inviteCode is per-school and rules don't permit a
 * client-side `where('inviteCode','==',X)` lookup (only callables run
 * with Admin SDK can resolve it). The same callable also writes the class
 * roster atomically.
 *
 * No approval gate: if the code is valid and the class exists, the role
 * is granted instantly. Wrong code / missing class -> inline alert.
 */
export function SchoolStep() {
  const uid = useAuthStore(s => s.firebaseUid);
  const setUserDoc = useAuthStore(s => s.setUserDoc);
  const [code, setCode] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!uid) return;
    const trimmedCode = code.trim().toUpperCase();
    const trimmedSection = section.trim().toUpperCase();
    const gradeNum = parseInt(grade.trim(), 10);
    if (trimmedCode.length === 0) {
      Alert.alert('Missing code', "Enter your school code from your parent.");
      return;
    }
    if (!Number.isFinite(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      Alert.alert('Invalid grade', 'Enter your grade (a number between 1 and 12).');
      return;
    }
    if (trimmedSection.length === 0) {
      Alert.alert('Missing section', 'Enter your section (e.g. A, B, C).');
      return;
    }
    try {
      setLoading(true);
      await callFn<
        {inviteCode: string; grade: number; section: string},
        {schoolId: string; classId: string; alreadyJoined: boolean}
      >('joinSchool', {
        inviteCode: trimmedCode,
        grade: gradeNum,
        section: trimmedSection,
      });
      // Pull the freshly-updated user doc so the nav guard re-evaluates
      // with `schoolIds` populated and drops us into PermissionsOnboarding.
      const doc = await getUserDoc(uid);
      setUserDoc(doc);
    } catch (err) {
      Alert.alert(
        'Could not join school',
        (err as {message?: string} | null)?.message ??
          'Check the code, grade, and section with your parent and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title="Join your school"
      subtitle="Type the code your parent gave you, then your grade and section.">
      <TextInput
        label="School code"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={t => setCode(t.toUpperCase())}
        placeholder="ABCD1234"
        maxLength={12}
        style={styles.codeInput}
      />

      <View style={styles.row}>
        <View style={styles.cell}>
          <TextInput
            label="Grade"
            keyboardType="number-pad"
            value={grade}
            onChangeText={setGrade}
            placeholder="8"
            maxLength={2}
            style={styles.numInput}
          />
        </View>
        <View style={styles.cell}>
          <TextInput
            label="Section"
            autoCapitalize="characters"
            value={section}
            onChangeText={t => setSection(t.toUpperCase())}
            placeholder="A"
            maxLength={3}
            style={styles.numInput}
          />
        </View>
      </View>

      <Button title="Join my class" onPress={onSubmit} loading={loading} />

      <Text style={styles.tip}>
        Your school code is the same one your parent used to join. If you
        don&apos;t have it yet, ask your parent.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
  numInput: {
    fontSize: 22,
    textAlign: 'center',
  },
  tip: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
