import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthToken, adminDb, type VerifiedUser } from '@/lib/firebase-admin';
import {
  getAgentConfig,
  updateAgentConfig,
  deleteAgentConfig,
} from '@/lib/agent-configs';

/**
 * /api/agent-configs/[id]
 * GET    -> Get an agent config (owner only)
 * PUT    -> Update an agent config (owner only; partial patch allowed)
 * DELETE -> Delete an agent config (owner only)
 */

function makeResponse(request: NextRequest, body: any, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  const cid = request.headers.get('x-request-id') || request.headers.get('x-correlation-id');
  if (cid) res.headers.set('X-Request-ID', cid);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

type AuthResult = { ok: true; user: VerifiedUser } | { ok: false; res: NextResponse };

async function requireUser(request: NextRequest): Promise<AuthResult> {
  const cookieStore = cookies();
  const token = cookieStore.get('authToken')?.value;

  if (!token) {
    return {
      ok: false,
      res: makeResponse(
        request,
        {
          success: false,
          error: 'authentication_required',
          message: 'Authentication token not found',
        },
        { status: 401 },
      ),
    };
  }

  const user = await verifyAuthToken(token);
  if (!user) {
    return {
      ok: false,
      res: makeResponse(
        request,
        {
          success: false,
          error: 'invalid_token',
          message: 'Invalid or expired token',
        },
        { status: 401 },
      ),
    };
  }

  return { ok: true, user };
}

function hasOrgAdminRole(roles?: string[] | null): boolean {
  return Array.isArray(roles) && (roles.includes('owner') || roles.includes('admin'));
}

async function getUserOrgId(uid: string): Promise<string | null> {
  try {
    if (!adminDb) return null;
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const orgId = (data as any).orgId;
    return typeof orgId === 'string' && orgId.trim() ? orgId.trim() : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.res;
    const user = auth.user;

    const id = context.params.id;
    const record = await getAgentConfig(id);

    if (!record) {
      return makeResponse(
        request,
        { success: false, error: 'not_found', message: 'Agent config not found' },
        { status: 404 },
      );
    }

    if (record.uid !== user.uid) {
      let allowed = false;
      if ((record as any).orgId && hasOrgAdminRole(user.roles || null)) {
        const userOrgId = await getUserOrgId(user.uid);
        if (userOrgId && userOrgId === (record as any).orgId) {
          allowed = true;
        }
      }
      if (!allowed) {
        return makeResponse(
          request,
          { success: false, error: 'forbidden', message: 'You do not have permission to access this agent config' },
          { status: 403 },
        );
      }
    }

    return makeResponse(request, {
      success: true,
      uid: user.uid,
      agentConfig: record,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/agent-configs/[id] error:', error?.message || error);
    return makeResponse(
      request,
      { success: false, error: 'server_error', message: 'Unable to fetch agent config' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.res;
    const user = auth.user;

    const id = context.params.id;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return makeResponse(
        request,
        { success: false, error: 'invalid_json', message: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    if (payload == null || typeof payload !== 'object') {
      return makeResponse(
        request,
        { success: false, error: 'validation_error', message: 'Payload must be an object' },
        { status: 400 },
      );
    }

    // Disallow id/uid override via patch
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _ignoreId, uid: _ignoreUid, ...patch } = payload as Record<string, unknown>;

    const updated = await updateAgentConfig(id, user.uid, patch, user.roles || null);

    return makeResponse(request, {
      success: true,
      uid: user.uid,
      agentConfig: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.code === 'not_found') {
      return makeResponse(
        request,
        { success: false, error: 'not_found', message: 'Agent config not found' },
        { status: 404 },
      );
    }
    if (error?.code === 'forbidden') {
      return makeResponse(
        request,
        { success: false, error: 'forbidden', message: 'You do not own this agent config' },
        { status: 403 },
      );
    }
    if (error?.message === 'ValidationError') {
      return makeResponse(
        request,
        { success: false, error: 'validation_error', message: 'Invalid agent config', errors: error.details || {} },
        { status: 400 },
      );
    }

    console.error('PUT /api/agent-configs/[id] error:', error?.message || error);
    return makeResponse(
      request,
      { success: false, error: 'server_error', message: 'Unable to update agent config' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.res;
    const user = auth.user;

    const id = context.params.id;

    await deleteAgentConfig(id, user.uid, user.roles || null);

    return makeResponse(
      request,
      { success: true, uid: user.uid, id, timestamp: new Date().toISOString() },
      { status: 200 },
    );
  } catch (error: any) {
    if (error?.code === 'not_found') {
      return makeResponse(
        request,
        { success: false, error: 'not_found', message: 'Agent config not found' },
        { status: 404 },
      );
    }
    if (error?.code === 'forbidden') {
      return makeResponse(
        request,
        { success: false, error: 'forbidden', message: 'You do not own this agent config' },
        { status: 403 },
      );
    }
    console.error('DELETE /api/agent-configs/[id] error:', error?.message || error);
    return makeResponse(
      request,
      { success: false, error: 'server_error', message: 'Unable to delete agent config' },
      { status: 500 },
    );
  }
}
