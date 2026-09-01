import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {cosmicColors, cosmicRadius, cosmicSpacing} from '../theme';

interface CosmicHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function CosmicHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightAction,
}: CosmicHeaderProps) {
  return (
    <View style={styles.header}>
      {showBack && onBack ? (
        <Pressable
          hitSlop={10}
          onPress={onBack}
          style={({pressed}) => [
            styles.backBtn,
            pressed && styles.backBtnPressed,
          ]}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ? <View style={styles.rightWrap}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: cosmicSpacing.lg,
    paddingTop: cosmicSpacing.md,
    paddingBottom: cosmicSpacing.sm,
    gap: cosmicSpacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderColor: cosmicColors.purple,
  },
  backIcon: {
    color: cosmicColors.text,
    fontSize: 22,
    fontWeight: '400',
    marginTop: -2,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: cosmicColors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  rightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
