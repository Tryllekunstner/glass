import { auth as firebaseAuth, firestore } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';

// AI Profile Types
export interface AiProfile {
  id: string;
  uid: string;
  name: string;
  description: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  apiKey?: string; // Encrypted
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAiProfileData {
  name: string;
  description: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  isDefault?: boolean;
}

export interface UpdateAiProfileData {
  name?: string;
  description?: string;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google' | 'local';
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

// Firestore AI Profile Service
export class FirestoreAiProfileService {
  private static getProfilesCollection(uid: string) {
    return collection(firestore, 'users', uid, 'aiProfiles');
  }

  static async getProfiles(uid: string): Promise<(AiProfile & { id: string })[]> {
    const profilesRef = this.getProfilesCollection(uid);
    const q = query(profilesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis() || Date.now(),
      updatedAt: doc.data().updatedAt?.toMillis() || Date.now(),
    })) as (AiProfile & { id: string })[];
  }

  static async getProfile(uid: string, profileId: string): Promise<AiProfile | null> {
    const profileRef = doc(firestore, 'users', uid, 'aiProfiles', profileId);
    const snapshot = await getDoc(profileRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const data = snapshot.data();
    return {
      id: snapshot.id,
      ...data,
      createdAt: data.createdAt?.toMillis() || Date.now(),
      updatedAt: data.updatedAt?.toMillis() || Date.now(),
    } as AiProfile;
  }

  static async createProfile(uid: string, data: CreateAiProfileData): Promise<string> {
    const profilesRef = this.getProfilesCollection(uid);
    const now = Timestamp.now();
    
    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await this.unsetAllDefaults(uid);
    }
    
    const profileData = {
      uid,
      name: data.name,
      description: data.description,
      model: data.model,
      provider: data.provider,
      apiKey: data.apiKey ? await this.encryptApiKey(data.apiKey) : undefined,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      systemPrompt: data.systemPrompt,
      isDefault: data.isDefault || false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(profilesRef, profileData);
    return docRef.id;
  }

  static async updateProfile(uid: string, profileId: string, data: UpdateAiProfileData): Promise<void> {
    const profileRef = doc(firestore, 'users', uid, 'aiProfiles', profileId);
    
    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await this.unsetAllDefaults(uid);
    }
    
    const updateData: any = {
      ...data,
      updatedAt: Timestamp.now(),
    };
    
    // Encrypt API key if provided
    if (data.apiKey) {
      updateData.apiKey = await this.encryptApiKey(data.apiKey);
    }
    
    await updateDoc(profileRef, updateData);
  }

  static async deleteProfile(uid: string, profileId: string): Promise<void> {
    const profileRef = doc(firestore, 'users', uid, 'aiProfiles', profileId);
    await deleteDoc(profileRef);
  }

  static async getDefaultProfile(uid: string): Promise<AiProfile | null> {
    const profilesRef = this.getProfilesCollection(uid);
    const q = query(profilesRef, where('isDefault', '==', true), where('isActive', '==', true));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toMillis() || Date.now(),
      updatedAt: data.updatedAt?.toMillis() || Date.now(),
    } as AiProfile;
  }

  static async setDefaultProfile(uid: string, profileId: string): Promise<void> {
    // First unset all defaults
    await this.unsetAllDefaults(uid);
    
    // Then set the new default
    const profileRef = doc(firestore, 'users', uid, 'aiProfiles', profileId);
    await updateDoc(profileRef, {
      isDefault: true,
      updatedAt: Timestamp.now(),
    });
  }

  private static async unsetAllDefaults(uid: string): Promise<void> {
    const profilesRef = this.getProfilesCollection(uid);
    const q = query(profilesRef, where('isDefault', '==', true));
    const snapshot = await getDocs(q);
    
    const batch = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { 
        isDefault: false, 
        updatedAt: Timestamp.now() 
      })
    );
    
    await Promise.all(batch);
  }

  // Simple encryption for API keys (in production, use proper encryption)
  private static async encryptApiKey(apiKey: string): Promise<string> {
    // This is a placeholder - in production, use proper encryption
    // For now, we'll just base64 encode it
    return btoa(apiKey);
  }

  static async decryptApiKey(encryptedKey: string): Promise<string> {
    // This is a placeholder - in production, use proper decryption
    try {
      return atob(encryptedKey);
    } catch {
      return encryptedKey; // Return as-is if not base64
    }
  }
}

// API functions for AI profiles
export const getAiProfiles = async (): Promise<AiProfile[]> => {
  const uid = firebaseAuth.currentUser!.uid;
  return await FirestoreAiProfileService.getProfiles(uid);
};

export const getAiProfile = async (profileId: string): Promise<AiProfile | null> => {
  const uid = firebaseAuth.currentUser!.uid;
  return await FirestoreAiProfileService.getProfile(uid, profileId);
};

export const createAiProfile = async (data: CreateAiProfileData): Promise<{ id: string }> => {
  const uid = firebaseAuth.currentUser!.uid;
  const profileId = await FirestoreAiProfileService.createProfile(uid, data);
  return { id: profileId };
};

export const updateAiProfile = async (profileId: string, data: UpdateAiProfileData): Promise<void> => {
  const uid = firebaseAuth.currentUser!.uid;
  await FirestoreAiProfileService.updateProfile(uid, profileId, data);
};

export const deleteAiProfile = async (profileId: string): Promise<void> => {
  const uid = firebaseAuth.currentUser!.uid;
  await FirestoreAiProfileService.deleteProfile(uid, profileId);
};

export const getDefaultAiProfile = async (): Promise<AiProfile | null> => {
  const uid = firebaseAuth.currentUser!.uid;
  return await FirestoreAiProfileService.getDefaultProfile(uid);
};

export const setDefaultAiProfile = async (profileId: string): Promise<void> => {
  const uid = firebaseAuth.currentUser!.uid;
  await FirestoreAiProfileService.setDefaultProfile(uid, profileId);
};

// Predefined AI model configurations
export const AI_MODEL_PRESETS = {
  'gpt-4': {
    name: 'GPT-4',
    provider: 'openai' as const,
    model: 'gpt-4',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    description: 'Most capable OpenAI model for complex tasks'
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    provider: 'openai' as const,
    model: 'gpt-3.5-turbo',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    description: 'Fast and efficient OpenAI model'
  },
  'claude-3-opus': {
    name: 'Claude 3 Opus',
    provider: 'anthropic' as const,
    model: 'claude-3-opus-20240229',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    description: 'Most capable Anthropic model'
  },
  'claude-3-sonnet': {
    name: 'Claude 3 Sonnet',
    provider: 'anthropic' as const,
    model: 'claude-3-sonnet-20240229',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    description: 'Balanced Anthropic model'
  },
  'gemini-pro': {
    name: 'Gemini Pro',
    provider: 'google' as const,
    model: 'gemini-pro',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    description: 'Google\'s advanced AI model'
  }
};
