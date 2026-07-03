import React, {useEffect, useMemo, useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput as RNTextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import Svg, {Path, Rect, Circle, Line} from 'react-native-svg';

import {ensurePhoneUserDoc} from '@zerebro/shared-firebase/auth';

import {GradientBackground} from '../../components/GradientBackground';
import {colors, radius, softShadow, spacing} from '../../theme';
import {stashConfirmation, takeConfirmation} from './phoneConfirmationStore';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneConfirm'>;

function GraduationCapIcon({size = 20, color = colors.primaryText}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 10l10-5 10 5-10 5-10-5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 10v6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function LockIcon({size = 20, color = colors.textMuted}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke={color} strokeWidth={1.8} />
      <Path d="M7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShieldCheckIcon({size = 20, color = colors.primaryText}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function InfoIcon({size = 14, color = colors.textMuted}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} />
      <Line x1="12" y1="16" x2="12" y2="12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="12" y1="8" x2="12.01" y2="8" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function PhoneConfirmScreen({route, navigation}: Props) {
  const {verificationId, phone} = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const confirmation = useMemo(
    () => takeConfirmation(verificationId),
    [verificationId],
  );

  useEffect(() => {
    if (!confirmation) {
      Alert.alert(
        'Session expired',
        'Please request a new code.',
        [{text: 'OK', onPress: () => navigation.replace('PhoneLogin')}],
        {cancelable: false},
      );
    }
  }, [confirmation, navigation]);

  async function onConfirm() {
    if (!confirmation) return;
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from the SMS.');
      return;
    }
    try {
      setLoading(true);
      const cred = await confirmation.confirm(code.trim());
      if (cred?.user?.uid) {
        const phoneFromToken = cred.user.phoneNumber ?? phone;
        await ensurePhoneUserDoc(cred.user.uid, phoneFromToken);
      }
    } catch (err) {
      Alert.alert('Confirmation failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    try {
      setResending(true);
      const fresh = await auth().signInWithPhoneNumber(phone, true);
      const freshId = fresh.verificationId ?? `local-${Date.now()}`;
      stashConfirmation(freshId, fresh);
      navigation.setParams({verificationId: freshId});
    } catch (err) {
      Alert.alert('Could not resend', (err as Error).message);
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <GradientBackground />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <View style={styles.content}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <GraduationCapIcon />
              </View>
              <Text style={styles.brandLabel}>Zerebro Connect</Text>
            </View>

            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.subtitle}>
              We texted a 6-digit code to {phone}. Enter it below to continue.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>6-digit code</Text>
              <View style={styles.inputWrap}>
                <View style={styles.inputIcon}>
                  <LockIcon />
                </View>
                <RNTextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  editable={!loading}
                  maxLength={6}
                />
              </View>
              <View style={styles.hintRow}>
                <InfoIcon />
                <Text style={styles.hintText}>
                  Didn't get it?{' '}
                  <Text
                    style={styles.hintLink}
                    onPress={resending ? undefined : onResend}>
                    {resending ? 'Sending…' : 'Send a new code'}
                  </Text>
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              android_ripple={{color: 'rgba(255,255,255,0.12)'}}
              style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}>
              <ShieldCheckIcon />
              <Text style={styles.confirmBtnText}>
                {loading ? 'Verifying…' : 'Verify and continue'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.replace('PhoneLogin')}
              style={styles.changeNumber}>
              <Text style={styles.changeNumberText}>Change number</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to the{' '}
              <Text style={styles.footerLink}>Terms</Text> and{' '}
              <Text style={styles.footerLink}>Privacy Policy</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl + spacing.md,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 3.2,
    color: colors.textMuted,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  fieldGroup: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    color: colors.textMuted,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg - 4,
    height: 56,
    paddingHorizontal: spacing.md,
    ...softShadow,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  hintLink: {
    fontWeight: '700',
    color: colors.text,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg - 4,
    height: 56,
    marginTop: spacing.xl,
    ...softShadow,
    shadowOpacity: 0.18,
    elevation: 3,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  changeNumber: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  changeNumberText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    textDecorationLine: 'underline',
    color: colors.text,
  },
});
