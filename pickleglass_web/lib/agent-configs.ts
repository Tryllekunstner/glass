import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { AgentConfig as AgentConfigRecordType } from '@/types/domain';
import {
  validateAgentConfig,
  type AgentConfigDTO,
} from '@/lib/validation';

const COLLECTION = 'agentConfigs';

function assertAdminDb() {
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized (adminDb is null)');
  }
}

function docRef(id: string) {
  assertAdminDb();
  return adminDb!.collection(COLLECTION).doc(id);
}

function colRef() {
  assertAdminDb();
  return adminDb!.collection(COLLECTION);
}

function toRecord(data: FirebaseFirestore.DocumentData): AgentConfigRecordType {
  return {
    id: data.id as string,
    uid: data.uid as string,
    orgId: (data.orgId as string | undefined) || undefined,
    name: data.name as string,
    type: data.type as AgentConfigRecordType['type'],
    modelProvider: data.modelProvider as AgentConfigRecordType['modelProvider'],
    modelId: data.modelId as string,
    temperature: (data.temperature as number | undefined) ?? undefined,
    maxTokens: (data.maxTokens as number | undefined) ?? undefined,
    systemPrompt: (data.systemPrompt as string | undefined) ?? undefined,
    tools: (data.tools as string[] | undefined) ?? undefined,
    active: Boolean(data.active),
    updatedAt: (data.updatedAt as Timestamp | Date | string) ?? new Date(0),
  };
}

function hasOrgAdminRole(roles?: string[] | null): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.includes('owner') || roles.includes('admin');
}

async function getUserOrgId(uid: string): Promise<string | null> {
  assertAdminDb();
  try {
    const snap = await adminDb!.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const orgId = (data as any).orgId;
    return typeof orgId === 'string' && orgId.trim() ? orgId.trim() : null;
  } catch {
    return null;
  }
}

/**
 * List agent configs owned by a user.
 * Security: server-side ownership filter (uid == user.uid).
 */
export async function listAgentConfigs(
  uid: string,
  opts?: { orgId?: string | null; roles?: string[] | null }
): Promise<AgentConfigRecordType[]> {
  const requestedOrgId = (opts?.orgId || '').trim() || null;
  // If orgId is requested and user has admin role in that org, list org-scoped configs
  if (requestedOrgId && hasOrgAdminRole(opts?.roles || null)) {
    const userOrgId = await getUserOrgId(uid);
    if (userOrgId && userOrgId === requestedOrgId) {
      const snap = await colRef()
        .where('orgId', '==', requestedOrgId)
        .orderBy('updatedAt', 'desc')
        .get();
      return snap.docs.map((d) => toRecord(d.data()));
    }
    // fallthrough to personal if org mismatch
  }

  // Default: personal configs
  const snap = await colRef()
    .where('uid', '==', uid)
    .orderBy('updatedAt', 'desc')
    .get();
  return snap.docs.map((d) => toRecord(d.data()));
}

/**
 * Create a new agent config owned by the user.
 * Server enforces uid ownership and updatedAt. orgId is accepted but not used for RBAC in Phase 1.
 */
export async function createAgentConfig(
  uid: string,
  dto: AgentConfigDTO,
  roles?: string[] | null
): Promise<AgentConfigRecordType> {
  // Validate full payload
  const v = validateAgentConfig(dto);
  if (!v.ok) {
    const err = new Error('ValidationError');
    (err as any).details = v.errors;
    throw err;
  }

  // Enforce org-level RBAC if orgId is present
  let orgIdToUse: string | null = v.data.orgId ?? null;
  if (orgIdToUse) {
    const userOrgId = await getUserOrgId(uid);
    if (!(userOrgId && userOrgId === orgIdToUse && hasOrgAdminRole(roles || null))) {
      const err = new Error('Forbidden');
      (err as any).code = 'forbidden';
      (err as any).reason = 'org_permission_denied';
      throw err;
    }
  }

  const ref = colRef().doc();
  const payload: Record<string, any> = {
    id: ref.id,
    uid,
    orgId: orgIdToUse,
    name: v.data.name,
    type: v.data.type,
    modelProvider: v.data.modelProvider,
    modelId: v.data.modelId,
    temperature: v.data.temperature ?? null,
    maxTokens: v.data.maxTokens ?? null,
    systemPrompt: v.data.systemPrompt ?? null,
    tools: v.data.tools ?? null,
    active: v.data.active,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload, { merge: true });

  const snap = await ref.get();
  return toRecord(snap.data() || payload);
}

/**
 * Get a single agent config by id.
 */
export async function getAgentConfig(id: string): Promise<AgentConfigRecordType | null> {
  const snap = await docRef(id).get();
  if (!snap.exists) return null;
  return toRecord(snap.data()!);
}

/**
 * Update an agent config by merging with existing, validating the result, and enforcing ownership.
 * Only the owner (uid match) may update in Phase 1.
 */
export async function updateAgentConfig(
  id: string,
  uid: string,
  patch: Partial<AgentConfigDTO>,
  roles?: string[] | null
): Promise<AgentConfigRecordType> {
  const ref = docRef(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error('NotFound');
    (err as any).code = 'not_found';
    throw err;
  }
  const current = toRecord(snap.data()!);

  // Ownership or org-level admin check
  if (current.uid !== uid) {
    if (current.orgId) {
      const userOrgId = await getUserOrgId(uid);
      if (!(userOrgId && userOrgId === current.orgId && hasOrgAdminRole(roles || null))) {
        const err = new Error('Forbidden');
        (err as any).code = 'forbidden';
        (err as any).reason = 'org_permission_denied';
        throw err;
      }
    } else {
      const err = new Error('Forbidden');
      (err as any).code = 'forbidden';
      throw err;
    }
  }

  // Build candidate DTO for validation (full object expected by validator)
  const candidate: AgentConfigDTO = {
    id: current.id,
    uid: current.uid,
    orgId: patch.orgId !== undefined ? patch.orgId : current.orgId,
    name: patch.name !== undefined ? patch.name : current.name,
    type: patch.type !== undefined ? patch.type : current.type,
    modelProvider: patch.modelProvider !== undefined ? patch.modelProvider : current.modelProvider,
    modelId: patch.modelId !== undefined ? patch.modelId : current.modelId,
    temperature: patch.temperature !== undefined ? patch.temperature : current.temperature,
    maxTokens: patch.maxTokens !== undefined ? patch.maxTokens : current.maxTokens,
    systemPrompt: patch.systemPrompt !== undefined ? patch.systemPrompt : current.systemPrompt,
    tools: patch.tools !== undefined ? patch.tools : current.tools,
    active: patch.active !== undefined ? patch.active : current.active,
  };

  const v = validateAgentConfig(candidate);
  if (!v.ok) {
    const err = new Error('ValidationError');
    (err as any).details = v.errors;
    throw err;
  }

  const updateData: Record<string, any> = {
    orgId: v.data.orgId ?? null,
    name: v.data.name,
    type: v.data.type,
    modelProvider: v.data.modelProvider,
    modelId: v.data.modelId,
    temperature: v.data.temperature ?? null,
    maxTokens: v.data.maxTokens ?? null,
    systemPrompt: v.data.systemPrompt ?? null,
    tools: v.data.tools ?? null,
    active: v.data.active,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(updateData, { merge: true });
  const updated = await ref.get();
  return toRecord(updated.data()!);
}

/**
 * Delete an agent config. Only owner may delete.
 */
export async function deleteAgentConfig(id: string, uid: string, roles?: string[] | null): Promise<void> {
  const ref = docRef(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error('NotFound');
    (err as any).code = 'not_found';
    throw err;
  }
  const current = toRecord(snap.data()!);
  if (current.uid !== uid) {
    if (current.orgId) {
      const userOrgId = await getUserOrgId(uid);
      if (!(userOrgId && userOrgId === current.orgId && hasOrgAdminRole(roles || null))) {
        const err = new Error('Forbidden');
        (err as any).code = 'forbidden';
        (err as any).reason = 'org_permission_denied';
        throw err;
      }
    } else {
      const err = new Error('Forbidden');
      (err as any).code = 'forbidden';
      throw err;
    }
  }
  await ref.delete();
}
