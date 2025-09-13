import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/firebase-admin';
import { validateDeviceRegistration } from '@/lib/validation';
import { registerDevice } from '@/lib/device';

/**
 * POST /api/device/register
 * Secure endpoint to upsert a device record owned by the authenticated user.
 * - Validates payload (id, type, platform, appVersion, displayName?)
 * - Writes/merges devices/{id} with { uid, lastSeenAt: serverTimestamp(), status: 'online' }
 * - Returns the stored device record (server-resolved timestamps)
 */
export async function POST(request: NextRequest) {
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

    const parsed = validateDeviceRegistration(payload);
    if (!parsed.ok) {
      return makeResponse(
        {
          success: false,
          error: 'validation_error',
          message: 'Invalid device registration payload',
          errors: parsed.errors,
        },
        { status: 400 }
      );
    }

    const record = await registerDevice(user.uid, parsed.data);

    return makeResponse({
      success: true,
      uid: user.uid,
      device: record,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('POST /api/device/register error:', error?.message || error);
    return makeResponse(
      {
        success: false,
        error: 'server_error',
        message: 'Unable to register device',
      },
      { status: 500 }
    );
  }
}
