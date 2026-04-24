import React, {useEffect, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import MapView, {Circle, Marker} from 'react-native-maps';

import {Button} from '../../components/Button';
import {TextInput} from '../../components/TextInput';
import {colors, radius, spacing} from '../../theme';
import {setGeofence, subscribeChildDoc} from '../../firebase/firestore';
import type {ChildDoc} from '../../firebase/types';

export function LocationTab({childUid}: {childUid: string}) {
  const [doc, setDoc] = useState<ChildDoc | null>(null);
  const [radiusM, setRadiusM] = useState('150');
  const [center, setCenter] = useState<{lat: number; lng: number} | null>(null);

  useEffect(() => subscribeChildDoc(childUid, setDoc), [childUid]);

  const loc = doc?.currentLocation;

  async function saveFence() {
    if (!center) {
      Alert.alert('Tap the map', 'First tap the map to pick a centre point for the geofence.');
      return;
    }
    const r = Number(radiusM);
    if (!Number.isFinite(r) || r < 50) {
      Alert.alert('Radius too small', 'Use at least 50 metres.');
      return;
    }
    await setGeofence(childUid, {
      centerLat: center.lat,
      centerLng: center.lng,
      radiusM: r,
      active: true,
    });
    Alert.alert('Saved', 'You will get a notification when your child leaves this area.');
  }

  async function clearFence() {
    await setGeofence(childUid, {centerLat: 0, centerLng: 0, radiusM: 0, active: false});
  }

  if (!loc) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No location yet. Make sure your child has the app open and granted location permission.</Text>
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
        }}
        onPress={e =>
          setCenter({
            lat: e.nativeEvent.coordinate.latitude,
            lng: e.nativeEvent.coordinate.longitude,
          })
        }>
        <Marker
          coordinate={{latitude: loc.lat, longitude: loc.lng}}
          title="Child is here"
          description={new Date(loc.updatedAt).toLocaleTimeString()}
          pinColor={colors.primary}
        />
        {doc?.geofence?.active && (
          <Circle
            center={{latitude: doc.geofence.centerLat, longitude: doc.geofence.centerLng}}
            radius={doc.geofence.radiusM}
            fillColor="rgba(56,189,248,0.15)"
            strokeColor={colors.primary}
          />
        )}
        {center && !doc?.geofence?.active && (
          <Circle
            center={{latitude: center.lat, longitude: center.lng}}
            radius={Number(radiusM) || 150}
            fillColor="rgba(74,222,128,0.15)"
            strokeColor={colors.success}
          />
        )}
      </MapView>

      <View style={styles.controls}>
        <Text style={styles.heading}>Geofence</Text>
        <Text style={styles.helper}>Tap the map to pick a centre point, then set a radius.</Text>
        <TextInput
          label="Radius (metres)"
          keyboardType="number-pad"
          value={radiusM}
          onChangeText={setRadiusM}
        />
        <View style={styles.row}>
          <View style={{flex: 1}}>
            <Button title="Save geofence" onPress={saveFence} />
          </View>
          {doc?.geofence?.active && (
            <View style={{flex: 1, marginLeft: spacing.sm}}>
              <Button title="Clear" variant="danger" onPress={clearFence} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controls: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
});
