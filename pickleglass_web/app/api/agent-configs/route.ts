import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthToken, type VerifiedUser } from '@/lib/firebase-admin';
import { listAgentConfigs, createAgentConfig } from '@/lib/agent-configs';
import { validateAgentConfig } from '@/lib/validation';

/**
 * /api/agent-configs
 * GET  -> List agent configs for authenticated user
 * POST -> Create a new agent config for authenticated user
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
      res: makeResponse(request, {
        success: false,
        error: 'authentication_required',
        message: 'Authentication token not found',
      }, { status: 401 })
    };
  }

  const user = await verifyAuthToken(token);
  if (!user) {
    return {
      ok: false,
      res: makeResponse(request, {
        success: false,
        error: 'invalid_token',
        message: 'Invalid or expired token',
      }, { status: 401 })
    };
  }

  return { ok: true, user };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.res;
    const user = auth.user;

    const url = new URL(request.url);
    const orgId = (url.searchParams.get('orgId') || '').trim() || null;

    const items = await listAgentConfigs(user.uid, { orgId, roles: user.roles || null });

    return makeResponse(request, {
      success: true,
      uid: user.uid,
      orgId,
      items,
      count: items.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/agent-configs error:', error?.message || error);
    return makeResponse(request, {
      success: false,
      error: 'server_error',
      message: 'Unable to list agent configs',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.res;
    const user = auth.user;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return makeResponse(request, {
        success: false,
        error: 'invalid_json',
        message: 'Request body must be valid JSON',
      }, { status: 400 });
    }

    // Validate payload (full create)
    const parsed = validateAgentConfig(payload);
    if (!parsed.ok) {
      return makeResponse(request, {
        success: false,
        error: 'validation_error',
        message: 'Invalid agent config',
        errors: parsed.errors,
      }, { status: 400 });
    }

    const record = await createAgentConfig(user.uid, parsed.data, user.roles || null);

    return makeResponse(request, {
      success: true,
      uid: user.uid,
      agentConfig: record,
      timestamp: new Date().toISOString(),
    }, { status: 201 });
  } catch (error: any) {
    // Map known validation error thrown by DAO (should be rare since we pre-validate)
    if (error?.message === 'ValidationError') {
      return makeResponse(request, {
        success: false,
        error: 'validation_error',
        message: 'Invalid agent config',
        errors: error.details || {},
      }, { status: 400 });
    }

    console.error('POST /api/agent-configs error:', error?.message || error);
    return makeResponse(request, {
      success: false,
      error: 'server_error',
      message: 'Unable to create agent config',
    }, { status: 500 });
  }
}
