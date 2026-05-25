import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {colors, radius, spacing} from '../../theme';
import {ChildMode} from '../../modules/native';
import {
  setChildModeActive as fsSetChildModeActive,
  setLock,
  sharedProfileChildUid,
  subscribeChildDoc,
  subscribeLinkedChildren,
} from '../../firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import type {ChildDoc, UserDoc} from '../../firebase/types';
import type {ParentStackParamList} from '../../navigation/types';

type ChildRow = UserDoc & {uid: string; doc: ChildDoc | null};

export function ChildrenListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParentStackParamList>>();
  const parentUid = useAuthStore(s => s.firebaseUid);
  const userDoc = useAuthStore(s => s.userDoc);
  const sharedProfile = userDoc?.sharedProfile;
  const isShared = userDoc?.deviceMode === 'shared';

  const [rows, setRows] = useState<ChildRow[]>([]);
  const [sharedDoc, setSharedDoc] = useState<ChildDoc | null>(null);
  const [starting, setStarting] = useState(false);

  // Two-device linked children — unchanged.
  useEffect(() => {
    if (!parentUid || isShared) {return;}
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
  }, [parentUid, isShared]);

  // Shared-profile doc — only subscribed when shared mode is on. The "child" here is the
  // parent's own profile at `children/{parentUid}_shared`.
  useEffect(() => {
    if (!isShared || !sharedProfile?.childUid) {return;}
    return subscribeChildDoc(sharedProfile.childUid, setSharedDoc);
  }, [isShared, sharedProfile?.childUid]);

  const sharedRow = useMemo<ChildRow | null>(() => {
    if (!isShared || !sharedProfile || !parentUid) {return null;}
    // Synthesize a "UserDoc" for display only — the shared profile has no users-collection
    // entry, since the parent's own auth user owns the data via the `parentOwns(...)` rule.
    return {
      uid: sharedProfile.childUid,
      role: 'child',
      name: sharedProfile.childName,
      email: '',
      createdAt: sharedProfile.createdAt,
      doc: sharedDoc,
    };
  }, [isShared, sharedProfile, sharedDoc, parentUid]);

  async function toggleLock(row: ChildRow, value: boolean) {
    await setLock(row.uid, value);
  }

  async function startChildMode() {
    if (!parentUid) {return;}
    const childUid = sharedProfile?.childUid ?? sharedProfileChildUid(parentUid);
    try {
      setStarting(true);
      // Flip native FIRST so the very next accessibility event enforces blocking.
      // Firestore mirror is best-effort for cross-instance visibility.
      await ChildMode.setActive(true, childUid);
      try {
        await fsSetChildModeActive(parentUid, true);
      } catch (e) {
        console.warn('Firestore childMode mirror failed', e);
      }
      // RootNavigator's `useChildModeActive()` will pick up the native flag on its next
      // poll (\u22642s) and swap us into the kiosk. No manual navigation needed.
    } catch (e) {
      Alert.alert('Could not start Child Mode', (e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <Screen
      title={isShared ? 'Shared phone setup' : 'Your children'}
      subtitle={
        isShared
          ? "Hand the phone to your child once you start Child Mode. Only the apps you've allowed will be usable until you exit."
          : 'Tap a child for detailed controls.'
      }>
      <ScrollView contentContainerStyle={{gap: spacing.md, paddingBottom: spacing.xl}}>
        {sharedRow ? (
          <View style={styles.sharedSection}>
            <Pressable
              onPress={() =>
                navigation.navigate('ChildDetails', {
                  childUid: sharedRow.uid,
                  childName: sharedRow.name,
                })
              }
              style={({pressed}) => [styles.card, pressed && {opacity: 0.85}]}>
              <View style={{flex: 1}}>
                <Text style={styles.name}>{sharedRow.name}</Text>
                <Text style={styles.meta}>
                  Shared phone profile{'  \u00b7  '}
                  {sharedDoc?.lockState?.locked ? 'Locked' : 'Unlocked'}
                </Text>
              </View>
              <Switch
                value={sharedDoc?.lockState?.locked ?? false}
                onValueChange={v => toggleLock(sharedRow, v)}
                trackColor={{true: colors.primary, false: colors.surfaceAlt}}
                thumbColor={colors.text}
              />
            </Pressable>
            <Button
              title={starting ? 'Starting\u2026' : '\u25b6  Start Child Mode'}
              onPress={startChildMode}
              loading={starting}
            />
            <Text style={styles.startHint}>
              Child Mode locks the phone to your allowed apps. Exit any time by entering your
              parent PIN.
            </Text>
          </View>
        ) : null}

        {!isShared && rows.length === 0 ? <EmptyState /> : null}

        {!isShared
          ? rows.map(item => (
              <Pressable
                key={item.uid}
                onPress={() =>
                  navigation.navigate('ChildDetails', {childUid: item.uid, childName: item.name})
                }
                style={({pressed}) => [styles.card, pressed && {opacity: 0.85}]}>
                <View style={{flex: 1}}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.doc?.status === 'online' ? '\u25cf Online' : '\u25cb Offline'}
                    {'  \u00b7  '}
                    {item.doc?.lockState?.locked ? 'Locked' : 'Unlocked'}
                  </Text>
                </View>
                <Switch
                  value={item.doc?.lockState?.locked ?? false}
                  onValueChange={v => toggleLock(item, v)}
                  trackColor={{true: colors.primary, false: colors.surfaceAlt}}
                  thumbColor={colors.text}
                />
              </Pressable>
            ))
          : null}
      </ScrollView>
    </Screen>
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
  sharedSection: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  startHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
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
