import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, radius, spacing} from '../../theme';
import type {ParentStackParamList} from '../../navigation/types';
import {setSchedule, subscribeChildApps, subscribeChildDoc} from '../../firebase/firestore';
import type {AppEntry, ChildDoc, Schedule} from '../../firebase/types';

type Props = NativeStackScreenProps<ParentStackParamList, 'Schedule'>;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  startMinutes: 9 * 60,
  endMinutes: 15 * 60,
  allowedPackages: [],
};

export function ScheduleScreen({route}: Props) {
  const {childUid} = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [draft, setDraft] = useState<Schedule>(DEFAULT_SCHEDULE);

  // Load existing schedule once.
  useEffect(() => {
    const unsub = subscribeChildDoc(childUid, (doc: ChildDoc | null) => {
      if (doc?.schedule) {
        setDraft({
          enabled: !!doc.schedule.enabled,
          daysOfWeek: doc.schedule.daysOfWeek ?? [],
          startMinutes: doc.schedule.startMinutes ?? 0,
          endMinutes: doc.schedule.endMinutes ?? 0,
          allowedPackages: doc.schedule.allowedPackages ?? [],
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [childUid]);

  // Live list of installed apps so the parent can pick the allowlist.
  useEffect(() => subscribeChildApps(childUid, setApps), [childUid]);

  const sortedApps = useMemo(
    () => [...apps].sort((a, b) => a.appName.localeCompare(b.appName)),
    [apps],
  );

  function toggleDay(day: number) {
    setDraft(d => {
      const has = d.daysOfWeek.includes(day);
      return {
        ...d,
        daysOfWeek: has ? d.daysOfWeek.filter(x => x !== day) : [...d.daysOfWeek, day].sort(),
      };
    });
  }

  function togglePackage(pkg: string) {
    setDraft(d => {
      const has = d.allowedPackages.includes(pkg);
      return {
        ...d,
        allowedPackages: has
          ? d.allowedPackages.filter(p => p !== pkg)
          : [...d.allowedPackages, pkg],
      };
    });
  }

  async function handleSave() {
    if (draft.enabled && draft.daysOfWeek.length === 0) {
      Alert.alert('Pick at least one day', 'Choose which days the schedule applies to.');
      return;
    }
    if (draft.enabled && draft.startMinutes === draft.endMinutes) {
      Alert.alert('Invalid window', 'Start and end time cannot be the same.');
      return;
    }
    setSaving(true);
    try {
      await setSchedule(childUid, draft);
      Alert.alert('Saved', 'The schedule was updated.');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const wrapsMidnight = draft.endMinutes <= draft.startMinutes;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        contentContainerStyle={{padding: spacing.md, paddingBottom: spacing.xl}}
        data={sortedApps}
        keyExtractor={a => a.packageName}
        ListHeaderComponent={
          <View>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{flex: 1}}>
                  <Text style={styles.title}>Enable schedule</Text>
                  <Text style={styles.subtitle}>
                    During the window only the apps you tick below stay usable. Everything else
                    is blocked.
                  </Text>
                </View>
                <Switch
                  value={draft.enabled}
                  onValueChange={v => setDraft(d => ({...d, enabled: v}))}
                  trackColor={{true: colors.primary, false: colors.surfaceAlt}}
                  thumbColor={colors.text}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Days</Text>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, idx) => {
                  const on = draft.daysOfWeek.includes(idx);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => toggleDay(idx)}
                      style={[styles.dayChip, on && styles.dayChipOn]}>
                      <Text style={[styles.dayChipLabel, on && styles.dayChipLabelOn]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Time window</Text>
              <View style={styles.timeRow}>
                <TimeField
                  label="Start"
                  minutes={draft.startMinutes}
                  onChange={m => setDraft(d => ({...d, startMinutes: m}))}
                />
                <Text style={styles.dash}>—</Text>
                <TimeField
                  label="End"
                  minutes={draft.endMinutes}
                  onChange={m => setDraft(d => ({...d, endMinutes: m}))}
                />
              </View>
              {wrapsMidnight && (
                <Text style={styles.helper}>End time is on the next day.</Text>
              )}
            </View>

            <View style={[styles.card, {marginBottom: spacing.sm}]}>
              <Text style={styles.sectionLabel}>
                Allowed apps ({draft.allowedPackages.length})
              </Text>
              <Text style={styles.subtitle}>
                These apps stay open during the window. Phone, Settings and the launcher are always
                available.
              </Text>
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{height: spacing.sm}} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No apps synced yet from the child's phone.</Text>
        }
        renderItem={({item}) => {
          const checked = draft.allowedPackages.includes(item.packageName);
          return (
            <Pressable
              onPress={() => togglePackage(item.packageName)}
              style={[styles.appRow, checked && styles.appRowOn]}>
              {item.icon ? (
                <Image source={{uri: item.icon}} style={styles.icon} />
              ) : (
                <View style={[styles.icon, styles.iconFallback]}>
                  <Text style={styles.iconFallbackText}>
                    {item.appName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{flex: 1}}>
                <Text style={styles.appName}>{item.appName}</Text>
                <Text style={styles.appPkg}>{item.packageName}</Text>
              </View>
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, saving && {opacity: 0.6}]}>
            {saving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.saveBtnLabel}>Save schedule</Text>
            )}
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Inline HH / MM editor — keeps the bundle free of @react-native-community/datetimepicker.
// ---------------------------------------------------------------------------

function TimeField({
  label,
  minutes,
  onChange,
}: {
  label: string;
  minutes: number;
  onChange: (m: number) => void;
}) {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;

  function setHour(text: string) {
    const n = parseInt(text.replace(/\D/g, ''), 10);
    const safe = Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : 0;
    onChange(safe * 60 + mm);
  }
  function setMinute(text: string) {
    const n = parseInt(text.replace(/\D/g, ''), 10);
    const safe = Number.isFinite(n) ? Math.min(59, Math.max(0, n)) : 0;
    onChange(hh * 60 + safe);
  }

  return (
    <View style={timeStyles.wrap}>
      <Text style={timeStyles.label}>{label}</Text>
      <View style={timeStyles.fields}>
        <TextInput
          style={timeStyles.input}
          keyboardType="number-pad"
          maxLength={2}
          value={hh.toString().padStart(2, '0')}
          onChangeText={setHour}
          selectTextOnFocus
        />
        <Text style={timeStyles.colon}>:</Text>
        <TextInput
          style={timeStyles.input}
          keyboardType="number-pad"
          maxLength={2}
          value={mm.toString().padStart(2, '0')}
          onChangeText={setMinute}
          selectTextOnFocus
        />
      </View>
    </View>
  );
}

const timeStyles = StyleSheet.create({
  wrap: {flex: 1},
  label: {color: colors.textMuted, fontSize: 12, marginBottom: 4},
  fields: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  input: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    width: 44,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  colon: {color: colors.text, fontSize: 22, fontWeight: '700'},
});

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  title: {color: colors.text, fontSize: 16, fontWeight: '700'},
  subtitle: {color: colors.textMuted, fontSize: 13, marginTop: 4},
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  dayRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 4},
  dayChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dayChipOn: {backgroundColor: colors.primary},
  dayChipLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '600'},
  dayChipLabelOn: {color: colors.primaryText},
  timeRow: {flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm},
  dash: {color: colors.textMuted, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm},
  helper: {color: colors.warning, fontSize: 12, marginTop: spacing.sm},
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  appRowOn: {borderColor: colors.primary},
  icon: {width: 36, height: 36, borderRadius: 8},
  iconFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {color: colors.text, fontSize: 16, fontWeight: '700'},
  appName: {color: colors.text, fontSize: 14, fontWeight: '600'},
  appPkg: {color: colors.textMuted, fontSize: 11, marginTop: 2},
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {backgroundColor: colors.primary, borderColor: colors.primary},
  checkboxTick: {color: colors.primaryText, fontWeight: '700'},
  empty: {color: colors.textMuted, textAlign: 'center', padding: spacing.lg},
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveBtnLabel: {color: colors.primaryText, fontSize: 16, fontWeight: '700'},
});
