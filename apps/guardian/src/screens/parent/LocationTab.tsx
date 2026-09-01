import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, Share, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker} from 'react-native-maps';

import {useParentTheme} from '../../state/themeStore';
import {parentRadius, parentSpacing} from './theme/parentTheme';
import {subscribeChildDoc} from '@zerebro/shared-firebase/firestore';
import type {
  ChildDoc,
  LocationDiagnostics,
  LocationDiagnosticsReason,
} from '@zerebro/shared-types';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const VERY_STALE_THRESHOLD_MS = 30 * 60 * 1000;
const DIAG_FRESHNESS_THRESHOLD_MS = 10 * 60 * 1000;

export function LocationTab({childUid}: {childUid: string}) {
  const {theme, isDark} = useParentTheme();
  const [doc, setDoc] = useState<ChildDoc | null>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    return subscribeChildDoc(childUid, snap => {
      setDoc(snap);
      setDocLoaded(true);
    });
  }, [childUid]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loc = doc?.currentLocation;

  const diagBanner = useMemo(
    () => resolveDiagBanner(doc?.locationDiagnostics, now),
    [doc?.locationDiagnostics, now],
  );

  const stale = useMemo(() => {
    if (!loc) {return null;}
    const ageMs = now - loc.updatedAt;
    if (ageMs < STALE_THRESHOLD_MS) {return null;}
    return {
      ageMs,
      veryStale: ageMs >= VERY_STALE_THRESHOLD_MS,
      label: formatAge(ageMs),
    };
  }, [loc, now]);

  const lastKnownLabel = loc ? formatAge(now - loc.updatedAt) : undefined;
  const markerIsStale = !!diagBanner?.severe;

  if (!docLoaded) {
    return (
      <View
        style={[
          styles.empty,
          {backgroundColor: isDark ? 'transparent' : theme.bg},
        ]}>
        <Text style={[styles.emptyText, {color: theme.textMuted}]}>
          Loading child status…
        </Text>
      </View>
    );
  }

  if (!loc) {
    return (
      <View
        style={[
          styles.empty,
          {backgroundColor: isDark ? 'transparent' : theme.bg},
        ]}>
        {diagBanner && (
          <View style={styles.emptyDiagWrap}>
            <DiagBanner diag={diagBanner} />
          </View>
        )}
        <Text style={[styles.emptyTitle, {color: theme.text}]}>
          No location yet
        </Text>
        <Text style={[styles.emptyText, {color: theme.textMuted}]}>
          Make sure your child has the app open and has granted location permission.
        </Text>
        <Text style={[styles.emptyHint, {color: theme.textSubtle}]}>
          On Xiaomi / Vivo / Oppo / Transsion phones the kid also needs to enable Autostart
          and set battery usage to "No restrictions" for KidSafe.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: loc.lat,
          longitude: loc.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}>
        <Marker
          coordinate={{latitude: loc.lat, longitude: loc.lng}}
          title={markerIsStale ? `Last known location` : 'Child is here'}
          description={
            markerIsStale
              ? `${lastKnownLabel} ago · not live`
              : new Date(loc.updatedAt).toLocaleTimeString()
          }
          pinColor={theme.primary}
          opacity={markerIsStale ? 0.3 : 1}
        />
      </MapView>

      {diagBanner ? (
        <DiagBanner diag={diagBanner} lastKnownLabel={lastKnownLabel} />
      ) : stale ? (
        <View
          style={[
            styles.staleBanner,
            stale.veryStale && styles.staleBannerSevere,
          ]}
          pointerEvents="none">
          <Text style={styles.staleBannerText}>
            {stale.veryStale
              ? `Last seen ${stale.label} ago — child phone may be offline or KidSafe was force-stopped.`
              : `Last seen ${stale.label} ago — waiting for a fresh fix.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface DiagBannerData {
  reason: LocationDiagnosticsReason;
  hint: string;
  severe: boolean;
  shareMessage: string;
}

function DiagBanner({
  diag,
  lastKnownLabel,
}: {
  diag: DiagBannerData;
  lastKnownLabel?: string;
}) {
  const onShare = async () => {
    try {
      await Share.share({
        message: diag.shareMessage,
      });
    } catch {}
  };
  const showLastKnown = diag.severe && !!lastKnownLabel;
  return (
    <View
      style={[styles.diagBanner, diag.severe && styles.diagBannerSevere]}
      pointerEvents="box-none">
      <Text style={styles.diagBannerText}>{diag.hint}</Text>
      {showLastKnown && (
        <Text style={styles.diagBannerSubtext}>
          {`Pin on the map is the last known location · ${lastKnownLabel} ago · not live`}
        </Text>
      )}
      <Pressable
        onPress={onShare}
        style={({pressed}) => [
          styles.diagShareBtn,
          pressed && styles.diagShareBtnPressed,
        ]}>
        <Text style={styles.diagShareBtnLabel}>Share instructions</Text>
      </Pressable>
    </View>
  );
}

function resolveDiagBanner(
  diag: LocationDiagnostics | undefined,
  now: number,
): DiagBannerData | null {
  if (!diag) {return null;}
  if (now - diag.evaluatedAt > DIAG_FRESHNESS_THRESHOLD_MS) {return null;}
  if (diag.ok) {return null;}
  const reason = diag.reason;
  if (!reason) {return null;}
  return {
    reason,
    hint: diag.hint ?? defaultHintFor(reason),
    severe: severeReason(reason),
    shareMessage: shareMessageFor(reason, diag.hint),
  };
}

function severeReason(reason: LocationDiagnosticsReason): boolean {
  switch (reason) {
    case 'fine_permission_missing':
    case 'system_location_off':
    case 'fg_service_not_running':
    case 'firestore_write_failing':
      return true;
    case 'background_permission_missing':
    case 'play_services_unavailable':
    case 'first_fix_timeout':
      return false;
  }
}

function defaultHintFor(reason: LocationDiagnosticsReason): string {
  switch (reason) {
    case 'fine_permission_missing':
      return 'Location permission is OFF for KidSafe on your kid\'s phone.';
    case 'background_permission_missing':
      return 'Background location is not granted — location may pause when the phone is locked.';
    case 'system_location_off':
      return 'GPS / Location is turned off on the phone.';
    case 'play_services_unavailable':
      return 'Google Play Services is missing. Location updates with lower accuracy.';
    case 'fg_service_not_running':
      return 'KidSafe is not running in the background.';
    case 'first_fix_timeout':
      return 'KidSafe is running but no location fix yet.';
    case 'firestore_write_failing':
      return "KidSafe can't reach Firebase from the kid's phone.";
  }
}

function shareMessageFor(
  reason: LocationDiagnosticsReason,
  hint: string | undefined,
): string {
  const lines = ['Hey! KidSafe needs a quick fix on your phone.', ''];
  if (hint) {lines.push(hint, '');}
  switch (reason) {
    case 'fine_permission_missing':
      lines.push(
        'Steps:',
        '1. Open Settings → Apps → KidSafe',
        '2. Tap Permissions → Location',
        '3. Pick "Allow all the time"',
      );
      break;
    case 'background_permission_missing':
      lines.push(
        'Steps:',
        '1. Open Settings → Apps → KidSafe',
        '2. Tap Permissions → Location',
        '3. Change "While using the app" to "Allow all the time"',
      );
      break;
    case 'system_location_off':
      lines.push(
        'Steps:',
        '1. Swipe down the notification shade',
        '2. Tap the Location tile to turn it ON',
        '3. Or open Settings → Location → toggle it on',
      );
      break;
    case 'fg_service_not_running':
      lines.push(
        'Steps:',
        '1. Open Settings → Apps → KidSafe → Battery',
        '2. Pick "Unrestricted" / "Allow background activity"',
        '3. Then open KidSafe once to restart it',
        '',
        'On Realme / Oppo / Vivo phones, also enable Autostart:',
        '4. Settings → Battery → Background app management → KidSafe → Allow',
      );
      break;
    case 'play_services_unavailable':
      lines.push(
        'Steps:',
        '1. Open Play Store → My Apps',
        '2. Update Google Play Services to the latest version',
        '3. Restart the phone',
      );
      break;
    case 'first_fix_timeout':
      lines.push(
        'Steps:',
        '1. Step outside or move near a window',
        '2. Open Settings → Location → make sure GPS is set to High Accuracy',
        '3. Open KidSafe once to refresh',
      );
      break;
    case 'firestore_write_failing':
      lines.push(
        'Steps:',
        '1. Make sure your phone has WiFi or mobile data',
        '2. Open KidSafe once to retry the sync',
      );
      break;
  }
  return lines.join('\n');
}

function formatAge(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) {return `${mins} min`;}
  const hours = Math.floor(mins / 60);
  if (hours < 24) {return `${hours}h ${mins % 60}m`;}
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: parentSpacing.lg,
    gap: parentSpacing.sm,
  },
  emptyTitle: {
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyHint: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: parentSpacing.sm,
    fontStyle: 'italic',
  },
  emptyDiagWrap: {
    width: '100%',
    marginBottom: parentSpacing.lg,
  },
  staleBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#facc15',
    paddingVertical: parentSpacing.sm,
    paddingHorizontal: parentSpacing.md,
    elevation: 4,
  },
  staleBannerSevere: {
    backgroundColor: '#f87171',
  },
  staleBannerText: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  diagBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#facc15',
    paddingVertical: parentSpacing.md,
    paddingHorizontal: parentSpacing.md,
    elevation: 6,
    gap: parentSpacing.sm,
  },
  diagBannerSevere: {
    backgroundColor: '#f87171',
  },
  diagBannerText: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  diagBannerSubtext: {
    color: '#1f2937',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
    opacity: 0.8,
  },
  diagShareBtn: {
    alignSelf: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: parentSpacing.md,
    paddingVertical: 8,
    borderRadius: parentRadius.pill,
  },
  diagShareBtnPressed: {
    opacity: 0.85,
  },
  diagShareBtnLabel: {
    color: '#fafafa',
    fontSize: 12,
    fontWeight: '700',
  },
});
