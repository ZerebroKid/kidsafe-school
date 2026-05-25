import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, Share, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker} from 'react-native-maps';

import {colors, radius, spacing} from '../../theme';
import {subscribeChildDoc} from '../../firebase/firestore';
import type {
  ChildDoc,
  LocationDiagnostics,
  LocationDiagnosticsReason,
} from '@zerebro/shared-types';

/**
 * Anything older than this means the child phone hasn't pushed a fix in a while. We render
 * the last known marker but float a yellow stale banner at the top of the map so the parent
 * knows it's not live.
 */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Tighter "very stale" threshold. We still show the last known marker (better than nothing)
 * but switch the banner to red and use more urgent copy.
 */
const VERY_STALE_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * `locationDiagnostics.evaluatedAt` older than this means the child engine hasn't written in
 * a while — we don't trust the diagnostic in that case and fall back to the stale-banner UX.
 * Slightly looser than `STALE_THRESHOLD_MS` because the diagnostic heartbeat is only 3 min.
 */
const DIAG_FRESHNESS_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * Live-location only view. The geofence configuration UI used to live below the map but was
 * removed deliberately so this screen has one job: show where the kid is right now. Native
 * geofence enforcement (see `src/services/childSyncEngine.ts` + `GeofenceModule.kt`) is
 * unaffected — any pre-existing `children/{childUid}.geofence.active` doc will keep firing
 * exit alerts on the child device until cleared via Firestore.
 *
 * Two stacked banner states, picked in priority order:
 *   1. **Diagnostics banner** (red/amber) — appears when `locationDiagnostics.ok === false`
 *      AND the diagnostic was evaluated recently. Tells the parent EXACTLY why the marker
 *      is missing or stale (permission off, system location off, FG service killed, etc.)
 *      and offers a "Share instructions" CTA that opens the native share sheet so they can
 *      forward step-by-step copy to the kid via WhatsApp / SMS.
 *   2. **Stale banner** (amber/red) — fallback when there's a `currentLocation` doc but no
 *      diagnostic AND the fix is > 5 min old. Generic "phone may be offline" copy.
 */
export function LocationTab({childUid}: {childUid: string}) {
  const [doc, setDoc] = useState<ChildDoc | null>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    return subscribeChildDoc(childUid, snap => {
      setDoc(snap);
      setDocLoaded(true);
      // Diagnostic: pair this with the `KidSafe.LocationWriter write ok` line on the child
      // phone — they should be within a few seconds of each other. If they aren't, either
      // the child isn't writing (check logcat) or the parent isn't receiving (check rules
      // / Firebase Console).
      console.log('[KidSafe][Parent][Location] snapshot', {
        childUid,
        hasLoc: !!snap?.currentLocation,
        updatedAt: snap?.currentLocation?.updatedAt ?? null,
        ageMs: snap?.currentLocation?.updatedAt
          ? Date.now() - snap.currentLocation.updatedAt
          : null,
        diag: snap?.locationDiagnostics
          ? {
              ok: snap.locationDiagnostics.ok,
              reason: snap.locationDiagnostics.reason,
              ageMs: Date.now() - snap.locationDiagnostics.evaluatedAt,
            }
          : null,
      });
    });
  }, [childUid]);

  // Tick `now` every 30s so the stale banner copy updates without needing a Firestore write
  // to repaint. Avoids the "5 min ago" frozen text when no new fix has come in.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loc = doc?.currentLocation;

  // Resolve the diagnostics-banner state. Only honored when the diagnostic itself is
  // recent — otherwise we trust the stale-banner heuristic instead, since a 2-hour-old
  // "ok=true" diagnostic from the child engine doesn't mean things are actually OK now.
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

  // Must run on every render (before any early return) — Rules of Hooks. `formatAge` is cheap
  // so we avoid a conditional useMemo that only ran when `loc` existed (that caused
  // "Rendered more hooks than during the previous render" when Firestore delivered location
  // after the loading empty state).
  const lastKnownLabel = loc ? formatAge(now - loc.updatedAt) : undefined;
  const markerIsStale = !!diagBanner?.severe;

  // Empty state #1: child doc hasn't loaded yet (Firestore listener still establishing).
  // Distinct from "no location yet" so we don't show a misleading "make sure your child
  // has the app open" message during the normal cold-start of the parent UI.
  if (!docLoaded) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading child status…</Text>
      </View>
    );
  }

  // Empty state #2: doc exists but no location has ever been written. We STILL render the
  // diagnostics banner here if available — that's the most actionable signal we have when
  // the kid's phone is fresh-installed and hasn't even published a fix yet.
  if (!loc) {
    return (
      <View style={styles.empty}>
        {diagBanner && (
          <View style={styles.emptyDiagWrap}>
            <DiagBanner diag={diagBanner} />
          </View>
        )}
        <Text style={styles.emptyTitle}>No location yet</Text>
        <Text style={styles.emptyText}>
          Make sure your child has the app open and has granted location permission.
        </Text>
        <Text style={styles.emptyHint}>
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
          pinColor={colors.primary}
          opacity={markerIsStale ? 0.3 : 1}
        />
      </MapView>

      {/*
        Banner priority:
          - `diagBanner` (specific reason from child) wins over `stale` (generic "no fix
            recently"), because the diagnostic gives the parent an actionable next step.
          - If diagBanner is null but stale is set, fall back to the legacy stale message.
          - If both are null, the map is full-screen as designed.
      */}
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

/**
 * Self-contained diagnostics banner. Uses `position: absolute` so the parent can keep
 * panning / zooming the map underneath. Accepts touches on the "Share" pill (the rest of
 * the banner forwards taps via the wrapper `pointerEvents="box-none"`).
 *
 * `lastKnownLabel` is the formatted age of the existing `currentLocation` marker (e.g.
 * "2 h"). We only show the "Last known location · X ago · not live" subline when:
 *   - the diagnostic is severe (the marker IS necessarily stale in that case), AND
 *   - we actually have a last-known fix to point at.
 * Empty-state callers pass `undefined` so the banner collapses to just the hint + share btn.
 */
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
    } catch {
      // Best-effort: the native share sheet rejects without an error code on cancel.
    }
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

/**
 * Builds the banner state from the raw Firestore diagnostic. Returns `null` for:
 *   - missing diagnostic
 *   - diagnostic older than [DIAG_FRESHNESS_THRESHOLD_MS] (we don't trust stale signals)
 *   - `ok === true` (nothing to surface)
 *
 * Otherwise picks the matching `severe` flag (red vs amber) and a sharable message tailored
 * to the reason.
 */
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

/**
 * "Red" reasons are user-action-required-now (permission denied, system location off, FG
 * service killed). "Amber" reasons are degraded-but-still-working (background permission
 * missing — FG service can keep things going while phone is unlocked; play services missing
 * — LocationManager fallback still updates with lower accuracy).
 */
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

/** Fallback copy when the child engine didn't include a hint (older builds). */
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

/**
 * Sharable step-by-step instructions for the kid. The parent opens the native share sheet
 * and forwards via WhatsApp / SMS / Discord / whatever the family uses. Includes the
 * specific reason in the first line so a child reading on a tiny preview understands at a
 * glance.
 */
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

/**
 * Compact "X min ago" / "X h ago" formatter. We avoid pulling in a heavy date library for one
 * banner — the precision needs are coarse (we already rounded with the staleness thresholds).
 */
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
    padding: spacing.lg,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  // Wraps DiagBanner inside the centered empty-state so it doesn't try to absolutely position
  // itself outside a map container.
  emptyDiagWrap: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  // Absolute-positioned overlay anchored to the top of the map. We pair the amber background
  // with `pointerEvents="none"` so the banner never swallows a map gesture — the parent can
  // still pan/zoom behind it. `elevation` keeps the banner above the map's native compass and
  // Google logo on Android.
  staleBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#facc15', // amber-400
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    elevation: 4,
  },
  staleBannerSevere: {
    backgroundColor: '#f87171', // red-400 for "very stale"
  },
  staleBannerText: {
    color: '#1f2937', // gray-800; readable on both yellow and red
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Diagnostics banner. Slightly taller than the stale banner because it has an action
  // button. We use `pointerEvents="box-none"` on the wrapper so taps pass through to the map
  // EXCEPT on the Share button.
  diagBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#facc15',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    elevation: 6,
    gap: spacing.sm,
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
  // Smaller, lower-emphasis row that explains the dimmed marker beneath the main hint.
  // We deliberately keep it inside the banner (rather than next to the marker on the map)
  // so the banner stays the single source of truth for "what state is the kid in".
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
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
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
