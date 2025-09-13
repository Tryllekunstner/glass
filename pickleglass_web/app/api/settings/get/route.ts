import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/firebase-admin';
import { getMergedSettings } from '@/lib/settings';

/**
 * GET /api/settings/get
 * Returns merged application settings for the authenticated user.
 * Auth required: reads authToken cookie and verifies via Firebase Admin.
 */
export async function GET(request: NextRequest) {
  const makeResponse = (body: any, init?: ResponseInit) => {
    const res = NextResponse.json(body, init);
    // Propagate correlation id if provided by middleware/proxy
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

    const settings = await getMergedSettings(user.uid);

    return makeResponse({
      success: true,
      uid: user.uid,
      settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GET /api/settings/get error:', error?.message || error);
    return makeResponse(
      {
        success: false,
        error: 'server_error',
        message: 'Unable to fetch settings',
      },
      { status: 500 }
    );
  }
}
