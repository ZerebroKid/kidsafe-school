import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';

import {Screen} from '../../components/Screen';
import {colors, radius, softShadow, spacing, tileGradientFor} from '../../theme';
import {
  setLock,
  subscribeChildDoc,
  subscribeLinkedChildren,
} from '@zerebro/shared-firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import type {ChildDoc, UserDoc} from '@zerebro/shared-types';
import type {ParentStackParamList} from '../../navigation/types';

type ChildRow = UserDoc & {uid: string; doc: ChildDoc | null};

/**
 * Two-device parent dashboard home -- linked children list with per-child
 * lock toggle. The v1 shared-mode "Start Child Mode" card + `sharedRow`
 * synthesis was deleted in P1.6.1.
 */
export function ChildrenListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParentStackParamList>>();
  const parentUid = useAuthStore(s => s.firebaseUid);

  const [rows, setRows] = useState<ChildRow[]>([]);

  useEffect(() => {
    if (!parentUid) {return;}
    const subs: Array<() => void> = [];
    const unsub = subscribeLinkedChildren(parentUid, list => {
      setRows(list.map(u => ({...u, doc: null})));
      subs.forEach(u => u());
      subs.length = 0;
      list.forEach(u => {
        const us = subscribeChildDoc(u.uid, doc => {
          setRows(prev => prev.map(r => (r.uid === u.uid ? {...r, doc} : r)));
        });
        subs.push(us);
      });
    });
    return () => {
      unsub();
      subs.forEach(u => u());
    };
  }, [parentUid]);

  async function toggleLock(row: ChildRow, value: boolean) {
    await setLock(row.uid, value);
  }

  return (
    <Screen
      title="Your children"
      subtitle="Tap a child for detailed controls.">
      <ScrollView contentContainerStyle={{gap: spacing.md, paddingBottom: spacing.xl}}>
        {rows.length === 0 ? <EmptyState /> : null}

        {rows.map(item => {
          // P3.2.1 demoted UserDoc.name to optional (phone-OTP signups don't
          // collect it). Fall back to "(unnamed)" so the navigate param + UI
          // both have a real string -- the prop is required at the route side.
          const displayName = item.name ?? item.displayName ?? '(unnamed)';
          return (
          <Pressable
            key={item.uid}
            onPress={() =>
              navigation.navigate('ChildDetails', {childUid: item.uid, childName: displayName})
            }
            style={({pressed}) => [styles.card, pressed && {opacity: 0.85}]}>
            <GradientAvatar
              uid={item.uid}
              letter={displayName.charAt(0).toUpperCase()}
            />
            <View style={{flex: 1, minWidth: 0}}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        item.doc?.status === 'online' ? colors.success : colors.border,
                    },
                  ]}
                />
                <Text style={styles.meta} numberOfLines={1}>
                  {item.doc?.status === 'online' ? 'Online' : 'Offline'}
                  {'  \u00b7  '}
                  {item.doc?.lockState?.locked ? 'Locked' : 'Unlocked'}
                </Text>
              </View>
            </View>
            <Switch
              value={item.doc?.lockState?.locked ?? false}
              onValueChange={v => toggleLock(item, v)}
              trackColor={{true: colors.primary, false: colors.border}}
              thumbColor="#ffffff"
            />
          </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

/** 48px circular gradient avatar with the child's first initial, stable color per uid. */
function GradientAvatar({uid, letter}: {uid: string; letter: string}) {
  const pair = tileGradientFor(uid);
  const id = `avatar-${uid.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={styles.avatar}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={pair.from} />
            <Stop offset="1" stopColor={pair.to} />
          </LinearGradient>
        </Defs>
        <Circle cx="24" cy="24" r="24" fill={`url(#${id})`} />
      </Svg>
      <Text style={styles.avatarLetter}>{letter}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={{fontSize: 48}}>{'\u{1f468}\u200d\u{1f469}\u200d\u{1f467}'}</Text>
      <Text style={styles.emptyTitle}>No children linked yet</Text>
      <Text style={styles.emptyBody}>
        Open the Settings tab to copy your pairing code, then have your child enter it when they
        set up their phone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg - 4,
    padding: spacing.md,
    gap: spacing.md - 4,
    ...softShadow,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    flexShrink: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptyBody: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
