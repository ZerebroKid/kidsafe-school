import React, {useState} from 'react';
import {ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View} from 'react-native';

import {useParentTheme} from '../../state/themeStore';
import {parentRadius, parentSpacing} from './theme/parentTheme';
import {requestPinReset} from '@zerebro/shared-firebase/firestore';
import {CosmicAssets} from '../../assets/cosmic';

interface Props {
  childUid: string;
  childName: string;
}

export function PinTab({childUid, childName}: Props) {
  const {theme, isDark} = useParentTheme();
  const [resetting, setResetting] = useState(false);

  function confirmResetPin() {
    Alert.alert(
      'Reset parent PIN?',
      `${childName}'s phone will be asked to set a new PIN the next time the app is opened. Use this only if you forgot the PIN.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset PIN',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await requestPinReset(childUid);
              Alert.alert(
                'PIN reset requested',
                "When the child's phone next syncs, the existing PIN will be cleared and they'll be prompted to set a new one.",
              );
            } catch (e: any) {
              Alert.alert('Could not request reset', e?.message ?? 'Unknown error');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={CosmicAssets.tSecurity}
        style={styles.heroBannerImg}
        resizeMode="cover"
      />
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(23, 19, 79, 0.88)'
              : theme.cardBg,
            borderColor: theme.cardBorder,
            borderLeftColor: theme.warning,
          },
        ]}>
        <Text style={[styles.title, {color: theme.text}]}>
          Reset child PIN
        </Text>
        <Text style={[styles.subtitle, {color: theme.textMuted}]}>
          The parent PIN protects sensitive actions on the child's phone (changing system
          settings, uninstalling KidSafe, etc.). Use this only if you forgot the PIN — your
          child will be prompted to set a new one the next time they open KidSafe.
        </Text>
      </View>

      <Pressable
        onPress={confirmResetPin}
        disabled={resetting}
        style={[
          styles.resetBtn,
          {backgroundColor: theme.danger},
          resetting && styles.resetBtnDisabled,
        ]}>
        {resetting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.resetBtnLabel}>Reset PIN</Text>
        )}
      </Pressable>

      <Text style={[styles.footnote, {color: theme.textSubtle}]}>
        The reset takes effect the next time the child's phone syncs (usually within a few
        seconds while online).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: parentSpacing.md,
    gap: parentSpacing.md,
  },
  heroBannerImg: {
    width: '100%',
    height: 140,
    borderRadius: 22,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(53,217,255,0.24)',
  },
  card: {
    borderRadius: parentRadius.lg,
    padding: parentSpacing.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    gap: parentSpacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  resetBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  resetBtnDisabled: {
    opacity: 0.6,
  },
  resetBtnLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
