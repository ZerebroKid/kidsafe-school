import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {spacing} from '../../../theme';

const HANDLE = '@zerebro.dost';
const AUDIO_LABEL = 'Original audio';
const AVATAR = require('../../../assets/zumi/zumi_idle.png');

interface Props {
  title: string;
}

export function ReelOverlay({title}: Props) {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.bottom}>
        <View style={styles.handleRow}>
          <Image source={AVATAR} style={styles.avatar} />
          <Text style={styles.handle}>{HANDLE}</Text>
        </View>
        <Text style={styles.caption} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.audioRow}>
          <Text style={styles.note}>{'\u266A'}</Text>
          <Text style={styles.audioText} numberOfLines={1}>
            {AUDIO_LABEL}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  bottom: {
    padding: spacing.lg,
    paddingBottom: spacing.xl + 16,
    gap: spacing.sm,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  handle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  caption: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  note: {
    color: '#ffffff',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  audioText: {
    color: '#ffffff',
    fontSize: 13,
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
});
