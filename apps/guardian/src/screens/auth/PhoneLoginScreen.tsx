import React, {useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import Svg, {Path, Circle, Line} from 'react-native-svg';

import {stashConfirmation} from './phoneConfirmationStore';
import {GradientBackground} from '../../components/GradientBackground';
import {colors, radius, softShadow, spacing} from '../../theme';
import type {AuthStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

function GraduationCapIcon({size = 20, color = colors.primaryText}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 10l10-5 10 5-10 5-10-5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 10v6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function PhoneIcon({size = 20, color = colors.textMuted}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

function MessageIcon({size = 20, color = colors.primaryText}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PhoneLoginScreen({navigation}: Props) {
  const [phone, setPhone] = useState('+91');
  const [loading, setLoading] = useState(false);

  async function onSendCode() {
    const trimmed = phone.trim();
    if (!/^\+\d{8,15}$/.test(trimmed)) {
      Alert.alert(
        'Invalid number',
        'Enter your full phone number including the country code, e.g. +919812345678.',
      );
      return;
    }
    try {
      setLoading(true);
      const confirmation = await auth().signInWithPhoneNumber(trimmed);
      const verificationId = confirmation.verificationId;
      if (!verificationId) {
        const fallbackId = `local-${Date.now()}`;
        stashConfirmation(fallbackId, confirmation);
        navigation.navigate('PhoneConfirm', {
          verificationId: fallbackId,
          phone: trimmed,
        });
        return;
      }
      stashConfirmation(verificationId, confirmation);
      navigation.navigate('PhoneConfirm', {verificationId, phone: trimmed});
    } catch (err) {
      Alert.alert('Could not send code', (err as Error).message);
    } finally {
      setLoading(false);
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

            <Text style={styles.title}>Sign in with phone</Text>
            <Text style={styles.subtitle}>
              We'll text you a 6-digit code over SMS. Use the same number your
              school knows you by.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone number</Text>
              <View style={styles.inputWrap}>
                <View style={styles.inputIcon}>
                  <PhoneIcon />
                </View>
                <RNTextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
              {/* <View style={styles.hintRow}>
                <InfoIcon />
                <Text style={styles.hintText}>Standard SMS rates may apply.</Text>
              </View> */}
            </View>

            <Pressable
              onPress={onSendCode}
              disabled={loading}
              android_ripple={{color: 'rgba(255,255,255,0.12)'}}
              style={[styles.sendBtn, loading && styles.sendBtnDisabled]}>
              <MessageIcon />
              <Text style={styles.sendBtnText}>
                {loading ? 'Sending…' : 'Send code'}
              </Text>
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
  sendBtn: {
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
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
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
