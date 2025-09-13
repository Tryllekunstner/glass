import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type ThemeOption = 'light' | 'dark' | 'system';

export interface AppSettings {
  language: string;
  theme: ThemeOption;
  voiceInputEnabled: boolean;
  telemetryEnabled: boolean;
  preferredAgentId?: string;
  updatedAt: Timestamp | Date | string;
}

export interface AppSettingsPatch {
  language?: string;
  theme?: ThemeOption;
  voiceInputEnabled?: boolean;
  telemetryEnabled?: boolean;
  preferredAgentId?: string;
}

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'app';

const DEFAULT_SETTINGS: Omit<AppSettings, 'updatedAt'> = {
  language: 'en-US',
  theme: 'system',
  voiceInputEnabled: true,
  telemetryEnabled: false,
  preferredAgentId: undefined,
};

/**
 * Return a reference to users/{uid}/settings/app
 */
function settingsDocRef(uid: string) {
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized (adminDb is null)');
  }
  return adminDb
    .collection('users')
    .doc(uid)
    .collection(SETTINGS_COLLECTION)
    .doc(SETTINGS_DOC_ID);
}

/**
 * Get user app settings document (users/{uid}/settings/app)
 * Returns defaults if the document does not exist.
 */
export async function getAppSettings(uid: string): Promise<AppSettings> {
  const ref = settingsDocRef(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    return {
      ...DEFAULT_SETTINGS,
      updatedAt: new Date(0),
    };
  }

  const data = snap.data() || {};
  return {
    language: (data.language as string) ?? DEFAULT_SETTINGS.language,
    theme: (data.theme as ThemeOption) ?? DEFAULT_SETTINGS.theme,
    voiceInputEnabled: (data.voiceInputEnabled as boolean) ?? DEFAULT_SETTINGS.voiceInputEnabled,
    telemetryEnabled: (data.telemetryEnabled as boolean) ?? DEFAULT_SETTINGS.telemetryEnabled,
    preferredAgentId: (data.preferredAgentId as string | undefined) ?? DEFAULT_SETTINGS.preferredAgentId,
    updatedAt: (data.updatedAt as Timestamp | Date | string) ?? new Date(0),
  };
}

/**
 * Merge user app settings with org-level defaults if available (Phase 1: user-only)
 * Placeholder for future org merge; currently returns user settings only.
 */
export async function getMergedSettings(uid: string): Promise<AppSettings> {
  // Phase 1: no org merge yet.
  return getAppSettings(uid);
}

/**
 * Update user app settings with a validated patch
 * Server-managed updatedAt is applied.
 */
export async function updateAppSettings(uid: string, patch: AppSettingsPatch): Promise<AppSettings> {
  const ref = settingsDocRef(uid);

  await ref.set(
    {
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Re-read the document to return the persisted state
  return getAppSettings(uid);
}
