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

export interface Schedule {
  enabled: boolean;
  /** 0 = Sunday .. 6 = Saturday */
  daysOfWeek: number[];
  /** Minutes since local midnight, 0..1439. */
  startMinutes: number;
  /** Minutes since local midnight, 0..1439. If <= startMinutes the window crosses midnight. */
  endMinutes: number;
  /** Apps that remain usable while the window is active. Everything else gets blocked. */
  allowedPackages: string[];
}

export interface PinResetRequest {
  /** Unix-ms when the parent issued the reset. Mostly informational; presence is what matters. */
  requestedAt: number;
}

export interface ChildDoc {
  status: 'online' | 'offline';
  lastSeenAt: FirebaseFirestoreTypes.FieldValue | number;
  lockState: LockState;
  screenTime?: ScreenTime;
  currentLocation?: Geo;
  geofence?: Geofence;
  schedule?: Schedule;
  deviceAdminActive?: boolean;
  /**
   * Set by the parent when they want to clear the on-device PIN (e.g. parent forgot it). The
   * child sync engine clears the local PIN on next foreground sync and immediately deletes the
   * field so the request is one-shot.
   */
  pinResetRequest?: PinResetRequest;
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
