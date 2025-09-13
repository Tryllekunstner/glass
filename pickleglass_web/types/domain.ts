// Domain types shared across server-side web modules (App Router APIs, DAOs)
// Mirrors the plan's [Types] section. Keep in sync with firestore-schema.md and firestore.rules.

export type TimestampLike = FirebaseFirestore.Timestamp | Date | string;

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  orgId?: string;
  roles?: Array<'owner' | 'admin' | 'member' | 'guest'>;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  lastLoginAt?: TimestampLike;
  status: 'active' | 'suspended' | 'deleted';
}

export interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  region: string; // default europe-west1
  settings: OrgSettings;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface OrgSettings {
  defaultLanguage: string; // BCP-47
  dataRetentionDays: number; // 1..3650
  allowedProviders: Array<'openai' | 'anthropic' | 'google' | 'local'>;
}

export interface Device {
  id: string;
  uid: string;
  type: 'desktop' | 'mobile';
  platform: 'win' | 'mac' | 'linux' | 'ios' | 'android';
  appVersion: string; // semver
  lastSeenAt: TimestampLike;
  status: 'online' | 'offline' | 'blocked';
  displayName?: string;
}

export interface AppSettings {
  language: string; // BCP-47
  theme: 'light' | 'dark' | 'system';
  voiceInputEnabled: boolean;
  telemetryEnabled: boolean;
  preferredAgentId?: string;
  updatedAt: TimestampLike;
}

export interface AgentConfig {
  id: string;
  uid: string;
  orgId?: string;
  name: string;
  type: 'ask' | 'listen' | 'custom';
  modelProvider: 'openai' | 'anthropic' | 'google' | 'local';
  modelId: string;
  temperature?: number; // 0..2
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[]; // ids
  active: boolean;
  updatedAt: TimestampLike;
}

export interface Session {
  id: string;
  uid: string;
  type: 'ask' | 'listen' | 'chat';
  agentId?: string;
  startedAt: TimestampLike;
  endedAt?: TimestampLike;
  status: 'active' | 'completed' | 'error';
  meta?: Record<string, any>;
}
