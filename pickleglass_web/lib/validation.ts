// Lightweight validation utilities for API payloads (no external deps)
// Mirrors schemas outlined in the implementation plan. Keep in sync with types/domain.ts.
//
// Design:
// - Each validate* returns { ok, data, errors } where data is normalized on success.
// - Accepts unknown input and performs type-narrowing with safe parsing.
// - AppSettings accepts partial patch for update semantics.
//
// Note: Prefer server-side validation here; client-side form validation remains in utils/validation.ts.

export type ValidationResult<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  errors: Record<string, string>;
};

// Utility guards
function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
function isNonEmptyString(v: unknown): v is string {
  return isString(v) && v.trim().length > 0;
}
function clampString(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

// Simple BCP-47-ish check (allow letters, digits, hyphen/underscore, 2..32 length)
function isLikelyBCP47(tag: string): boolean {
  return /^[A-Za-z0-9_-]{2,32}$/.test(tag);
}

// Simple semver-ish check (1.2.3 or 1.2.3-beta)
function isLikelySemver(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(version);
}

// -------- App Settings --------
export type ThemeOption = 'light' | 'dark' | 'system';
export interface AppSettingsPatch {
  language?: string;            // BCP-47
  theme?: ThemeOption;
  voiceInputEnabled?: boolean;
  telemetryEnabled?: boolean;
  preferredAgentId?: string;
}

export function validateAppSettingsPatch(input: unknown): ValidationResult<AppSettingsPatch> {
  const errors: Record<string, string> = {};
  const out: AppSettingsPatch = {};

  if (input == null || typeof input !== 'object') {
    return { ok: false, errors: { root: 'Invalid payload (object required)' } };
  }

  const obj = input as Record<string, unknown>;

  if ('language' in obj && obj.language !== undefined) {
    if (!isString(obj.language) || !isLikelyBCP47(obj.language)) {
      errors.language = 'language must be a BCP-47 string (e.g., "nb-NO", "en-US")';
    } else {
      out.language = clampString(obj.language, 32);
    }
  }

  if ('theme' in obj && obj.theme !== undefined) {
    const t = obj.theme;
    if (t !== 'light' && t !== 'dark' && t !== 'system') {
      errors.theme = "theme must be one of 'light' | 'dark' | 'system'";
    } else {
      out.theme = t;
    }
  }

  if ('voiceInputEnabled' in obj && obj.voiceInputEnabled !== undefined) {
    if (!isBoolean(obj.voiceInputEnabled)) {
      errors.voiceInputEnabled = 'voiceInputEnabled must be a boolean';
    } else {
      out.voiceInputEnabled = obj.voiceInputEnabled;
    }
  }

  if ('telemetryEnabled' in obj && obj.telemetryEnabled !== undefined) {
    if (!isBoolean(obj.telemetryEnabled)) {
      errors.telemetryEnabled = 'telemetryEnabled must be a boolean';
    } else {
      out.telemetryEnabled = obj.telemetryEnabled;
    }
  }

  if ('preferredAgentId' in obj && obj.preferredAgentId !== undefined) {
    if (!isNonEmptyString(obj.preferredAgentId)) {
      errors.preferredAgentId = 'preferredAgentId must be a non-empty string';
    } else {
      out.preferredAgentId = clampString(String(obj.preferredAgentId), 128);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: out };
}

// -------- Device Registration --------
export type DeviceType = 'desktop' | 'mobile';
export type Platform = 'win' | 'mac' | 'linux' | 'ios' | 'android';

export interface DeviceRegistrationDTO {
  id: string;                // deviceId (client-generated stable id)
  type: DeviceType;
  platform: Platform;
  appVersion: string;        // semver
  displayName?: string;
}

export function validateDeviceRegistration(input: unknown): ValidationResult<DeviceRegistrationDTO> {
  const errors: Record<string, string> = {};
  const out = {} as DeviceRegistrationDTO;

  if (input == null || typeof input !== 'object') {
    return { ok: false, errors: { root: 'Invalid payload (object required)' } };
  }
  const obj = input as Record<string, unknown>;

  // id
  if (!isNonEmptyString(obj.id)) {
    errors.id = 'id is required (non-empty string)';
  } else {
    out.id = clampString(obj.id, 128);
  }

  // type
  if (obj.type !== 'desktop' && obj.type !== 'mobile') {
    errors.type = "type must be 'desktop' or 'mobile'";
  } else {
    out.type = obj.type;
  }

  // platform
  const platforms: Platform[] = ['win', 'mac', 'linux', 'ios', 'android'];
  if (!isString(obj.platform) || !platforms.includes(obj.platform as Platform)) {
    errors.platform = "platform must be one of 'win' | 'mac' | 'linux' | 'ios' | 'android'";
  } else {
    out.platform = obj.platform as Platform;
  }

  // appVersion
  if (!isNonEmptyString(obj.appVersion) || !isLikelySemver(obj.appVersion)) {
    errors.appVersion = 'appVersion must be a semver string, e.g., 1.2.3';
  } else {
    out.appVersion = clampString(obj.appVersion, 32);
  }

  // displayName (optional)
  if (obj.displayName !== undefined) {
    if (!isNonEmptyString(obj.displayName)) {
      errors.displayName = 'displayName must be a non-empty string if provided';
    } else {
      out.displayName = clampString(String(obj.displayName), 120);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, data: out };
}

// -------- Agent Configs (skeleton for Step 6) --------
export type AgentType = 'ask' | 'listen' | 'custom';
export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'local';

export interface AgentConfigDTO {
  id?: string;
  uid?: string; // set server-side
  orgId?: string;
  name: string;
  type: AgentType;
  modelProvider: ModelProvider;
  modelId: string;
  temperature?: number;   // 0..2
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];
  active: boolean;
}

export function validateAgentConfig(input: unknown): ValidationResult<AgentConfigDTO> {
  const errors: Record<string, string> = {};
  const out = {} as AgentConfigDTO;

  if (input == null || typeof input !== 'object') {
    return { ok: false, errors: { root: 'Invalid payload (object required)' } };
  }
  const obj = input as Record<string, unknown>;

  // name
  if (!isNonEmptyString(obj.name)) {
    errors.name = 'name is required';
  } else {
    out.name = clampString(String(obj.name), 120);
  }

  // type
  if (obj.type !== 'ask' && obj.type !== 'listen' && obj.type !== 'custom') {
    errors.type = "type must be one of 'ask' | 'listen' | 'custom'";
  } else {
    out.type = obj.type as AgentType;
  }

  // modelProvider
  const providers: ModelProvider[] = ['openai', 'anthropic', 'google', 'local'];
  if (!isString(obj.modelProvider) || !providers.includes(obj.modelProvider as ModelProvider)) {
    errors.modelProvider = "modelProvider must be one of 'openai' | 'anthropic' | 'google' | 'local'";
  } else {
    out.modelProvider = obj.modelProvider as ModelProvider;
  }

  // modelId
  if (!isNonEmptyString(obj.modelId)) {
    errors.modelId = 'modelId is required';
  } else {
    out.modelId = clampString(String(obj.modelId), 128);
  }

  // temperature (optional 0..2)
  if (obj.temperature !== undefined) {
    if (typeof obj.temperature !== 'number' || obj.temperature < 0 || obj.temperature > 2) {
      errors.temperature = 'temperature must be a number between 0 and 2';
    } else {
      out.temperature = obj.temperature;
    }
  }

  // maxTokens (optional > 0)
  if (obj.maxTokens !== undefined) {
    if (typeof obj.maxTokens !== 'number' || obj.maxTokens <= 0) {
      errors.maxTokens = 'maxTokens must be a positive number';
    } else {
      out.maxTokens = obj.maxTokens;
    }
  }

  // systemPrompt (optional)
  if (obj.systemPrompt !== undefined) {
    if (!isString(obj.systemPrompt)) {
      errors.systemPrompt = 'systemPrompt must be a string';
    } else {
      out.systemPrompt = clampString(obj.systemPrompt, 5000);
    }
  }

  // tools (optional string[])
  if (obj.tools !== undefined) {
    if (!Array.isArray(obj.tools) || !obj.tools.every(isNonEmptyString)) {
      errors.tools = 'tools must be an array of non-empty strings';
    } else {
      out.tools = (obj.tools as string[]).map((t) => clampString(t, 128));
    }
  }

  // active
  if (typeof obj.active !== 'boolean') {
    errors.active = 'active must be a boolean';
  } else {
    out.active = obj.active;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, data: out };
}
