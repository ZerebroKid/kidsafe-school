import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {colors, radius, spacing} from '../../theme';
import {setSchedule, subscribeChildApps, subscribeChildDoc} from '@zerebro/shared-firebase/firestore';
import type {AppEntry, ChildDoc, Schedule} from '@zerebro/shared-types';

interface Props {
  childUid: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  daysOfWeek: [1, 2, 3, 4, 5],
  startMinutes: 9 * 60,
  endMinutes: 15 * 60,
  allowedPackages: [],
};

const TIME_STEP_MINUTES = 5;
const MINUTES_PER_DAY = 24 * 60;

function formatTime(minutes: number): string {
  const safe = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = Math.floor(safe / 60);
  const mm = safe % 60;
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

function normalizeToStep(minutes: number): number {
  const safe = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.floor(safe / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
}

const TIME_OPTIONS = Array.from(
  {length: MINUTES_PER_DAY / TIME_STEP_MINUTES},
  (_, index) => {
    const minutes = index * TIME_STEP_MINUTES;
    return {minutes, label: formatTime(minutes)};
  },
);

export function ScheduleTab({childUid}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [draft, setDraft] = useState<Schedule>(DEFAULT_SCHEDULE);

  useEffect(() => {
    const unsub = subscribeChildDoc(childUid, (doc: ChildDoc | null) => {
      if (doc?.schedule) {
        setDraft({
          enabled: !!doc.schedule.enabled,
          daysOfWeek: doc.schedule.daysOfWeek ?? [],
          startMinutes: normalizeToStep(doc.schedule.startMinutes ?? 0),
          endMinutes: normalizeToStep(doc.schedule.endMinutes ?? 0),
          allowedPackages: doc.schedule.allowedPackages ?? [],
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [childUid]);

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
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.title}>Enable schedule</Text>
            <Text style={styles.subtitle}>
              During the window only the apps you tick below stay usable. Everything else is
              blocked.
            </Text>
          </View>
          <Switch
            value={draft.enabled}
            onValueChange={v => setDraft(d => ({...d, enabled: v}))}
            trackColor={{true: colors.primary, false: colors.border}}
            thumbColor="#ffffff"
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
                <Text style={[styles.dayChipLabel, on && styles.dayChipLabelOn]}>
                  {label}
                </Text>
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
        {wrapsMidnight && <Text style={styles.helper}>End time is on the next day.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>
          Allowed apps ({draft.allowedPackages.length})
        </Text>
        <Text style={styles.subtitle}>
          These apps stay open during the window. Phone, Settings and the launcher are always
          available.
        </Text>
      </View>

      {sortedApps.length === 0 ? (
        <Text style={styles.empty}>No apps synced yet from the child's phone.</Text>
      ) : (
        <View style={styles.appList}>
          {sortedApps.map(item => {
            const checked = draft.allowedPackages.includes(item.packageName);
            return (
              <Pressable
                key={item.packageName}
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
                <View style={styles.appText}>
                  <Text style={styles.appName} numberOfLines={1}>
                    {item.appName}
                  </Text>
                  <Text style={styles.appPkg} numberOfLines={1}>
                    {item.packageName}
                  </Text>
                </View>
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  {checked && <Text style={styles.checkboxTick}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
        {saving ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.saveBtnLabel}>Save schedule</Text>
        )}
      </Pressable>
    </View>
  );
}

function TimeField({
  label,
  minutes,
  onChange,
}: {
  label: string;
  minutes: number;
  onChange: (m: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const safeValue = normalizeToStep(minutes);

  return (
    <View style={styles.timeFieldWrap}>
      <Text style={styles.timeFieldLabel}>{label}</Text>
      <Pressable style={styles.timeFieldButton} onPress={() => setOpen(true)}>
        <Text style={styles.timeFieldButtonText}>{formatTime(safeValue)}</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select {label.toLowerCase()} time</Text>
            <ScrollView contentContainerStyle={styles.modalList}>
              {TIME_OPTIONS.map(option => {
                const active = option.minutes === safeValue;
                return (
                  <Pressable
                    key={`${label}-${option.minutes}`}
                    style={[styles.timeOption, active && styles.timeOptionActive]}
                    onPress={() => {
                      onChange(option.minutes);
                      setOpen(false);
                    }}>
                    <Text style={[styles.timeOptionLabel, active && styles.timeOptionLabelActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.modalCloseButton} onPress={() => setOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  rowText: {flex: 1},
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
  timeFieldWrap: {flex: 1},
  timeFieldLabel: {color: colors.textMuted, fontSize: 12, marginBottom: 4},
  timeFieldButton: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  timeFieldButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dash: {color: colors.textMuted, paddingHorizontal: spacing.xs, paddingBottom: spacing.md},
  helper: {color: colors.warning, fontSize: 12, marginTop: spacing.sm},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxHeight: '70%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  modalList: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  timeOption: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  timeOptionActive: {
    backgroundColor: colors.primary,
  },
  timeOptionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  timeOptionLabelActive: {
    color: colors.primaryText,
  },
  modalCloseButton: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  modalCloseText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  appList: {gap: spacing.sm},
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appRowOn: {borderColor: colors.primary},
  appText: {flex: 1},
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
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnDisabled: {opacity: 0.6},
  saveBtnLabel: {color: colors.primaryText, fontSize: 16, fontWeight: '700'},
});
