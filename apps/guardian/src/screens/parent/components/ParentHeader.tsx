import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useParentTheme} from '../../../state/themeStore';
import {parentRadius, parentSpacing} from '../theme/parentTheme';

interface ParentHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function ParentHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightAction,
}: ParentHeaderProps) {
  const {theme, isDark} = useParentTheme();

  return (
    <View style={styles.header}>
      {showBack && onBack ? (
        <Pressable
          hitSlop={10}
          onPress={onBack}
          style={({pressed}) => [
            styles.backBtn,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : theme.cardBorder,
            },
            pressed && {opacity: 0.7},
          ]}>
          <Text style={[styles.backIcon, {color: theme.text}]}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={[styles.title, {color: theme.text}]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, {color: theme.textMuted}]}
            numberOfLines={1}>
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
    paddingHorizontal: parentSpacing.lg,
    paddingTop: parentSpacing.sm,
    paddingBottom: parentSpacing.sm,
    gap: parentSpacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '500',
    marginTop: -2,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
