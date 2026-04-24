import React, {useEffect, useState} from 'react';
import {FlatList, Linking, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../theme';
import {subscribeChildContacts} from '../../firebase/firestore';
import type {ContactEntry} from '../../firebase/types';

export function ContactsTab({childUid}: {childUid: string}) {
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  useEffect(() => subscribeChildContacts(childUid, setContacts), [childUid]);

  function call(phone: string) {
    Linking.openURL(`tel:${encodeURIComponent(phone)}`);
  }

  function sms(phone: string) {
    Linking.openURL(`sms:${encodeURIComponent(phone)}`);
  }

  return (
    <FlatList
      style={{backgroundColor: colors.bg}}
      contentContainerStyle={{padding: spacing.md}}
      ItemSeparatorComponent={() => <View style={{height: spacing.sm}} />}
      data={contacts}
      keyExtractor={c => c.id}
      ListEmptyComponent={
        <Text style={styles.empty}>No contacts synced yet.</Text>
      }
      renderItem={({item}) => (
        <View style={styles.row}>
          <View style={{flex: 1}}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.phone}>{item.phone}</Text>
          </View>
          <Pressable style={styles.actionBtn} onPress={() => call(item.phone)}>
            <Text style={styles.actionTxt}>Call</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => sms(item.phone)}>
            <Text style={styles.actionTxt}>SMS</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  name: {color: colors.text, fontSize: 15, fontWeight: '600'},
  phone: {color: colors.textMuted, fontSize: 13, marginTop: 2},
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  actionTxt: {color: colors.primaryText, fontWeight: '700', fontSize: 13},
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
});
