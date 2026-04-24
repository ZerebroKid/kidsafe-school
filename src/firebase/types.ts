import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type Role = 'parent' | 'child';

export interface UserDoc {
  role: Role;
  name: string;
  email: string;
  photoURL?: string | null;
  fcmToken?: string | null;
  createdAt: FirebaseFirestoreTypes.FieldValue | number;
  // Parent only: rotatable 6-digit code the child enters to link.
  pairingCode?: string;
  pairingCodeExpiresAt?: number;
  // Child only: uid of the linked parent. Set during pairing.
  parentUid?: string;
}

export interface LockState {
  locked: boolean;
  /** Optional unix-ms deadline after which the lock is automatically released. */
  until?: number | null;
}

export interface ScreenTime {
  limitMins: number;
  usedTodayMins: number;
  resetAt: number;
}

export interface Geo {
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: number;
}

export interface Geofence {
  centerLat: number;
  centerLng: number;
  radiusM: number;
  active: boolean;
}

export interface ChildDoc {
  status: 'online' | 'offline';
  lastSeenAt: FirebaseFirestoreTypes.FieldValue | number;
  lockState: LockState;
  screenTime?: ScreenTime;
  currentLocation?: Geo;
  geofence?: Geofence;
  deviceAdminActive?: boolean;
  lastGeofenceEvent?: {
    transition: 'enter' | 'exit' | 'dwell';
    lat: number;
    lng: number;
    timestamp: number;
  };
}

export interface AppEntry {
  packageName: string;
  appName: string;
  icon?: string;
  isBlocked: boolean;
  installedAt?: FirebaseFirestoreTypes.FieldValue | number;
}

export interface ContactEntry {
  id: string;
  name: string;
  phone: string;
  normalizedPhone?: string;
}
