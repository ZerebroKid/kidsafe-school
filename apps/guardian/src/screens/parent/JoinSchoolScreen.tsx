import React, {useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {callFn} from '@zerebro/shared-firebase';
import {signOut} from '@zerebro/shared-firebase/auth';
import {useParentTheme} from '../../state/themeStore';
import {ParentBackground} from './components/ParentBackground';
import {ParentHeader} from './components/ParentHeader';
import {parentRadius, parentSpacing} from './theme/parentTheme';

export function JoinSchoolScreen({onBack}: {onBack?: () => void}) {
  const navigation = useNavigation();
  const {theme, isDark} = useParentTheme();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBack = onBack ?? (() => navigation.goBack());

  async function onSubmit() {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (trimmedCode.length === 0) {
      Alert.alert('Missing code', 'Enter the school code your principal shared.');
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert('Missing name', 'Enter your full name.');
      return;
    }
    try {
      setLoading(true);
      await callFn<
        {inviteCode: string; displayName: string},
        {schoolId: string; alreadyJoined: boolean}
      >('joinSchoolAsParent', {
        inviteCode: trimmedCode,
        displayName: trimmedName,
      });
    } catch (err) {
      Alert.alert(
        'Could not join',
        (err as {message?: string} | null)?.message ??
          'Check the code and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ParentBackground>
      <ParentHeader
        title="Join School"
        subtitle="Connect with your child's school"
        onBack={handleBack}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.cardTitle, {color: theme.text}]}>
            School Connection Code
          </Text>
          <Text style={[styles.cardSub, {color: theme.textMuted}]}>
            Enter the 8-character school code your principal shared with you.
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, {color: theme.textMuted}]}>
              SCHOOL CODE
            </Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={t => setCode(t.toUpperCase())}
              placeholder="ABCD1234"
              placeholderTextColor={theme.textSubtle}
              maxLength={12}
              style={[
                styles.codeInput,
                {
                  color: theme.text,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#FFFFFF',
                  borderColor: theme.cardBorder,
                },
              ]}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, {color: theme.textMuted}]}>
              YOUR FULL NAME
            </Text>
            <TextInput
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Priya Sharma"
              placeholderTextColor={theme.textSubtle}
              style={[
                styles.nameInput,
                {
                  color: theme.text,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#FFFFFF',
                  borderColor: theme.cardBorder,
                },
              ]}
            />
          </View>

          <Pressable
            disabled={loading}
            style={[
              styles.submitBtn,
              {backgroundColor: theme.primary},
              loading && styles.submitBtnDisabled,
            ]}
            onPress={onSubmit}>
            <Text style={styles.submitBtnText}>
              {loading ? 'Joining school...' : 'Join School'}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={handleBack} style={styles.linkBtn}>
          <Text style={[styles.linkText, {color: theme.textMuted}]}>
            Back to options
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            signOut().catch(err => console.warn('signOut failed', err));
          }}
          style={styles.linkBtn}>
          <Text style={[styles.linkText, {color: theme.danger}]}>
            Sign out
          </Text>
        </Pressable>

        <View style={{height: 40}} />
      </ScrollView>
    </ParentBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: parentSpacing.lg,
    paddingTop: parentSpacing.xs,
    gap: parentSpacing.md,
  },
  card: {
    padding: 18,
    borderRadius: parentRadius.xl,
    borderWidth: 1,
    gap: parentSpacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 19,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  codeInput: {
    fontSize: 20,
    letterSpacing: 3,
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    fontWeight: '700',
  },
  nameInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
