import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/firebase-admin';
import { updateAppSettings } from '@/lib/settings';
import { validateAppSettingsPatch } from '@/lib/validation';

/**
 * PUT /api/settings/update
 * Validates and updates users/{uid}/settings/app with a partial patch.
 * Auth required via authToken cookie.
 */
export async function PUT(request: NextRequest) {
  const makeResponse = (body: any, init?: ResponseInit) => {
    const res = NextResponse.json(body, init);
    const cid = request.headers.get('x-request-id') || request.headers.get('x-correlation-id');
    if (cid) res.headers.set('X-Request-ID', cid);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };

  try {
    const cookieStore = cookies();
    const token = cookieStore.get('authToken')?.value;

    if (!token) {
      return makeResponse(
        {
          success: false,
          error: 'authentication_required',
          message: 'Authentication token not found',
        },
        { status: 401 }
      );
    }

    const user = await verifyAuthToken(token);
    if (!user) {
      return makeResponse(
        {
          success: false,
          error: 'invalid_token',
          message: 'Invalid or expired token',
        },
        { status: 401 }
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return makeResponse(
        {
          success: false,
          error: 'invalid_json',
          message: 'Request body must be valid JSON',
        },
        { status: 400 }
      );
    }

    const parsed = validateAppSettingsPatch(payload);
    if (!parsed.ok) {
      return makeResponse(
        {
          success: false,
          error: 'validation_error',
          message: 'Invalid settings patch',
          errors: parsed.errors,
        },
        { status: 400 }
      );
    }

    const updated = await updateAppSettings(user.uid, parsed.data);

    return makeResponse({
      success: true,
      uid: user.uid,
      settings: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('PUT /api/settings/update error:', error?.message || error);
    return makeResponse(
      {
        success: false,
        error: 'server_error',
        message: 'Unable to update settings',
      },
      { status: 500 }
    );
  }
}
