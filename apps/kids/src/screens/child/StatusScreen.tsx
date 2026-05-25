import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {colors, radius, spacing} from '../../theme';
import {useAuthStore} from '../../state/authStore';
import {subscribeChildDoc} from '@zerebro/shared-firebase/firestore';
import {signOut} from '@zerebro/shared-firebase/auth';
import type {ChildDoc} from '@zerebro/shared-types';

export function StatusScreen() {
  const uid = useAuthStore(s => s.firebaseUid);
  const [doc, setDoc] = useState<ChildDoc | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeChildDoc(uid, setDoc);
  }, [uid]);

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.emoji}>🛡️</Text>
        <Text style={styles.title}>KidSafe is active</Text>
        <Text style={styles.subtitle}>Your parent can see this phone.</Text>

        <View style={styles.card}>
          <Row label="Link status" value="Linked to parent" ok />
          <Row
            label="Lock"
            value={doc?.lockState?.locked ? 'Locked' : 'Unlocked'}
            ok={!doc?.lockState?.locked}
          />
          <Row
            label="Today's screen time"
            value={
              doc?.screenTime
                ? `${doc.screenTime.usedTodayMins} / ${doc.screenTime.limitMins || '∞'} min`
                : 'No limit set'
            }
            ok
          />
          <Row
            label="Geofence"
            value={doc?.geofence?.active ? 'Active' : 'Off'}
            ok
          />
        </View>

        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}

function Row({label, value, ok}: {label: string; value: string; ok?: boolean}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, ok ? {color: colors.success} : {color: colors.warning}]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 84,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    color: colors.textMuted,
  },
  rowValue: {
    fontWeight: '600',
  },
});
