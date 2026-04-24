import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {colors, radius, spacing} from '../../theme';
import type {ParentStackParamList} from '../../navigation/types';
import {AppsTab} from './AppsTab';
import {LocationTab} from './LocationTab';
import {ContactsTab} from './ContactsTab';
import {SafeAreaView} from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<ParentStackParamList, 'ChildDetails'>;

type Tab = 'apps' | 'location' | 'contacts';

export function ChildDetailsScreen({route}: Props) {
  const {childUid} = route.params;
  const [tab, setTab] = useState<Tab>('apps');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.tabbar}>
        <TabButton label="Apps" active={tab === 'apps'} onPress={() => setTab('apps')} />
        <TabButton label="Location" active={tab === 'location'} onPress={() => setTab('location')} />
        <TabButton label="Contacts" active={tab === 'contacts'} onPress={() => setTab('contacts')} />
      </View>
      <View style={{flex: 1}}>
        {tab === 'apps' && <AppsTab childUid={childUid} />}
        {tab === 'location' && <LocationTab childUid={childUid} />}
        {tab === 'contacts' && <ContactsTab childUid={childUid} />}
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  tabbar: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  tabActive: {backgroundColor: colors.primary},
  tabLabel: {color: colors.textMuted, fontWeight: '600'},
  tabLabelActive: {color: colors.primaryText},
});
