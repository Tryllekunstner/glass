import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type DeviceType = 'desktop' | 'mobile';
export type Platform = 'win' | 'mac' | 'linux' | 'ios' | 'android';

export interface DeviceDTO {
  id: string;                 // deviceId (client-stable)
  type: DeviceType;
  platform: Platform;
  appVersion: string;         // semver
  displayName?: string;
}

export interface DeviceRecord {
  id: string;
  uid: string;
  type: DeviceType;
  platform: Platform;
  appVersion: string;
  lastSeenAt: Timestamp | Date | string;
  status: 'online' | 'offline' | 'blocked';
  displayName?: string;
}

/**
 * Reference to devices/{deviceId}
 */
function deviceDocRef(deviceId: string) {
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized (adminDb is null)');
  }
  return adminDb.collection('devices').doc(deviceId);
}

/**
 * Register or update a device for a user. Sets lastSeenAt to server time.
 */
export async function registerDevice(uid: string, dto: DeviceDTO): Promise<DeviceRecord> {
  const ref = deviceDocRef(dto.id);

  const payload = {
    id: dto.id,
    uid,
    type: dto.type,
    platform: dto.platform,
    appVersion: dto.appVersion,
    displayName: dto.displayName ?? null,
    status: 'online' as const,
    lastSeenAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload, { merge: true });

  // Re-read to return resolved timestamps
  const snap = await ref.get();
  const data = snap.data() || payload;

  return {
    id: data.id,
    uid: data.uid,
    type: data.type,
    platform: data.platform,
    appVersion: data.appVersion,
    displayName: data.displayName ?? undefined,
    status: (data.status as DeviceRecord['status']) ?? 'online',
    lastSeenAt: (data.lastSeenAt as Timestamp | Date | string) ?? new Date(),
  };
}

/**
 * Touch device heartbeat: update lastSeenAt and optionally status/appVersion.
 */
export async function touchDevice(deviceId: string, updates?: Partial<Pick<DeviceRecord, 'status' | 'appVersion' | 'displayName'>>) {
  const ref = deviceDocRef(deviceId);
  const setData: Record<string, any> = {
    lastSeenAt: FieldValue.serverTimestamp(),
  };
  if (updates?.status) setData.status = updates.status;
  if (updates?.appVersion) setData.appVersion = updates.appVersion;
  if (updates?.displayName !== undefined) setData.displayName = updates.displayName;

  await ref.set(setData, { merge: true });
}

/**
 * Get devices owned by a user.
 */
export async function listDevicesByUser(uid: string): Promise<DeviceRecord[]> {
  if (!adminDb) throw new Error('Firebase Admin not initialized (adminDb is null)');

  const snap = await adminDb
    .collection('devices')
    .where('uid', '==', uid)
    .orderBy('lastSeenAt', 'desc')
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id,
      uid: data.uid,
      type: data.type,
      platform: data.platform,
      appVersion: data.appVersion,
      displayName: data.displayName ?? undefined,
      status: (data.status as DeviceRecord['status']) ?? 'online',
      lastSeenAt: (data.lastSeenAt as Timestamp | Date | string) ?? new Date(),
    };
  });
}
