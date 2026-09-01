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

import {useParentTheme} from '../../state/themeStore';
import {parentRadius, parentSpacing} from './theme/parentTheme';
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

import {CosmicAssets} from '../../assets/cosmic';

export function ScheduleTab({childUid}: Props) {
  const {theme, isDark} = useParentTheme();
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
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const wrapsMidnight = draft.endMinutes <= draft.startMinutes;

  return (
    <View style={styles.container}>
      <Image
        source={CosmicAssets.tSchedule}
        style={styles.heroBannerImg}
        resizeMode="cover"
      />
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(23, 19, 79, 0.88)'
              : theme.cardBg,
            borderColor: theme.cardBorder,
          },
        ]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.title, {color: theme.text}]}>
              Enable schedule
            </Text>
            <Text style={[styles.subtitle, {color: theme.textMuted}]}>
              During the window only the apps you tick below stay usable. Everything else is
              blocked.
            </Text>
          </View>
          <Switch
            value={draft.enabled}
            onValueChange={v => setDraft(d => ({...d, enabled: v}))}
            trackColor={{
              true: theme.primary,
              false: isDark ? 'rgba(255, 255, 255, 0.2)' : '#EADFDA',
            }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(23, 19, 79, 0.88)'
              : theme.cardBg,
            borderColor: theme.cardBorder,
          },
        ]}>
        <Text style={[styles.sectionLabel, {color: theme.text}]}>Days</Text>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, idx) => {
            const on = draft.daysOfWeek.includes(idx);
            return (
              <Pressable
                key={label}
                onPress={() => toggleDay(idx)}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: on
                      ? theme.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#FFFFFF',
                    borderColor: on ? theme.primary : theme.cardBorder,
                  },
                ]}>
                <Text
                  style={[
                    styles.dayChipLabel,
                    {
                      color: on
                        ? '#FFFFFF'
                        : isDark
                        ? theme.textMuted
                        : theme.text,
                    },
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(23, 19, 79, 0.88)'
              : theme.cardBg,
            borderColor: theme.cardBorder,
          },
        ]}>
        <Text style={[styles.sectionLabel, {color: theme.text}]}>
          Time window
        </Text>
        <View style={styles.timeRow}>
          <TimeField
            label="Start"
            minutes={draft.startMinutes}
            onChange={m => setDraft(d => ({...d, startMinutes: m}))}
          />
          <Text style={[styles.dash, {color: theme.textMuted}]}>—</Text>
          <TimeField
            label="End"
            minutes={draft.endMinutes}
            onChange={m => setDraft(d => ({...d, endMinutes: m}))}
          />
        </View>
        {wrapsMidnight && (
          <Text style={[styles.helper, {color: theme.warning}]}>
            End time is on the next day.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(23, 19, 79, 0.88)'
              : theme.cardBg,
            borderColor: theme.cardBorder,
          },
        ]}>
        <Text style={[styles.sectionLabel, {color: theme.text}]}>
          Allowed apps ({draft.allowedPackages.length})
        </Text>
        <Text style={[styles.subtitle, {color: theme.textMuted}]}>
          These apps stay open during the window. Phone, Settings and the launcher are always
          available.
        </Text>
      </View>

      {sortedApps.length === 0 ? (
        <Text style={[styles.empty, {color: theme.textMuted}]}>
          No apps synced yet from the child's phone.
        </Text>
      ) : (
        <View style={styles.appList}>
          {sortedApps.map(item => {
            const checked = draft.allowedPackages.includes(item.packageName);
            return (
              <Pressable
                key={item.packageName}
                onPress={() => togglePackage(item.packageName)}
                style={[
                  styles.appRow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(23, 19, 79, 0.88)'
                      : theme.cardBg,
                    borderColor: checked ? theme.primary : theme.cardBorder,
                  },
                ]}>
                {item.icon ? (
                  <Image source={{uri: item.icon}} style={styles.icon} />
                ) : (
                  <View
                    style={[
                      styles.icon,
                      styles.iconFallback,
                      {
                        backgroundColor: isDark
                          ? 'rgba(109, 63, 231, 0.25)'
                          : '#EFE7F8',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.iconFallbackText,
                        {color: theme.text},
                      ]}>
                      {item.appName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.appText}>
                  <Text
                    style={[styles.appName, {color: theme.text}]}
                    numberOfLines={1}>
                    {item.appName}
                  </Text>
                  <Text
                    style={[styles.appPkg, {color: theme.textMuted}]}
                    numberOfLines={1}>
                    {item.packageName}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: checked
                        ? theme.primary
                        : theme.cardBorderSubtle,
                      backgroundColor: checked
                        ? theme.primary
                        : 'transparent',
                    },
                  ]}>
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
        style={[
          styles.saveBtn,
          {backgroundColor: theme.primary},
          saving && styles.saveBtnDisabled,
        ]}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
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
  const {theme, isDark} = useParentTheme();
  const [open, setOpen] = useState(false);
  const safeValue = normalizeToStep(minutes);

  return (
    <View style={styles.timeFieldWrap}>
      <Text style={[styles.timeFieldLabel, {color: theme.textMuted}]}>
        {label}
      </Text>
      <Pressable
        style={[
          styles.timeFieldButton,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : '#FFFFFF',
            borderColor: theme.cardBorder,
          },
        ]}
        onPress={() => setOpen(true)}>
        <Text style={[styles.timeFieldButtonText, {color: theme.text}]}>
          {formatTime(safeValue)}
        </Text>
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalDismissArea}
            onPress={() => setOpen(false)}
          />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? '#0C1035' : '#FFFFFF',
                borderColor: theme.cardBorder,
              },
            ]}>
            <Text style={[styles.modalTitle, {color: theme.text}]}>
              Select {label.toLowerCase()} time
            </Text>
            <ScrollView contentContainerStyle={styles.modalList}>
              {TIME_OPTIONS.map(option => {
                const active = option.minutes === safeValue;
                return (
                  <Pressable
                    key={`${label}-${option.minutes}`}
                    style={[
                      styles.timeOption,
                      {
                        backgroundColor: active
                          ? theme.primary
                          : isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : '#F2EDEA',
                      },
                    ]}
                    onPress={() => {
                      onChange(option.minutes);
                      setOpen(false);
                    }}>
                    <Text
                      style={[
                        styles.timeOptionLabel,
                        {color: active ? '#FFFFFF' : theme.text},
                      ]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setOpen(false)}>
              <Text style={[styles.modalCloseText, {color: theme.primary}]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: parentSpacing.lg,
    paddingBottom: parentSpacing.lg,
    gap: parentSpacing.md,
  },
  loading: {
    paddingVertical: parentSpacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: parentRadius.lg,
    borderWidth: 1,
    padding: parentSpacing.md,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: parentSpacing.md},
  rowText: {flex: 1},
  title: {fontSize: 16, fontWeight: '700'},
  subtitle: {fontSize: 13, marginTop: 4, lineHeight: 18},
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: parentSpacing.sm,
  },
  dayRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 6},
  dayChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayChipLabel: {fontSize: 12, fontWeight: '700'},
  timeRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  timeFieldWrap: {flex: 1},
  timeFieldLabel: {fontSize: 12, marginBottom: 4},
  timeFieldButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeFieldButtonText: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dash: {paddingHorizontal: 4, paddingBottom: 14, fontSize: 16},
  helper: {fontSize: 12, marginTop: parentSpacing.sm},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: parentSpacing.lg,
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderRadius: parentRadius.xl,
    borderWidth: 1,
    padding: parentSpacing.md,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: parentSpacing.sm,
  },
  modalList: {
    gap: 6,
    paddingBottom: parentSpacing.sm,
  },
  timeOption: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  timeOptionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalCloseButton: {
    marginTop: parentSpacing.sm,
    alignItems: 'center',
    paddingVertical: parentSpacing.sm,
  },
  modalCloseText: {
    fontWeight: '700',
    fontSize: 14,
  },
  appList: {gap: 8},
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: parentRadius.lg,
    padding: parentSpacing.md,
    gap: 12,
    borderWidth: 1,
  },
  appText: {flex: 1},
  icon: {width: 38, height: 38, borderRadius: 10},
  iconFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {fontSize: 16, fontWeight: '700'},
  appName: {fontSize: 14, fontWeight: '600'},
  appPkg: {fontSize: 11, marginTop: 2},
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTick: {color: '#FFFFFF', fontWeight: '800', fontSize: 13},
  empty: {
    textAlign: 'center',
    paddingVertical: parentSpacing.lg,
    fontSize: 13,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: parentSpacing.xs,
  },
  saveBtnDisabled: {opacity: 0.6},
  saveBtnLabel: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},
  heroBannerImg: {
    width: '100%',
    height: 140,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.24)',
  },
});
