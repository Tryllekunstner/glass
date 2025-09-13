import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

type Body = {
  user_code?: string;
};

function makeResponse(request: NextRequest, body: any, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  const cid = request.headers.get('x-request-id') || request.headers.get('x-correlation-id');
  if (cid) res.headers.set('X-Request-ID', cid);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function getRegion() {
  return process.env.FIREBASE_REGION || process.env.GOOGLE_CLOUD_REGION || process.env.REGION || 'europe-west1';
}

function getProjectId() {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    ''
  );
}

/**
 * POST /api/device-code/complete
 * Completes the device-code flow by submitting the user_code and the current user's ID token
 * to the Cloud Function pickleGlassDeviceCodeComplete.
 */
export async function POST(request: NextRequest) {
  try {
    // Must be authenticated (cookie-based)
    const cookieStore = cookies();
    const idToken = cookieStore.get('authToken')?.value;

    if (!idToken) {
      return makeResponse(
        request,
        { success: false, error: 'authentication_required', message: 'Authentication token not found' },
        { status: 401 },
      );
    }

    let payload: Body | null = null;
    try {
      payload = (await request.json()) as Body;
    } catch {
      return makeResponse(
        request,
        { success: false, error: 'invalid_json', message: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const userCode = (payload?.user_code || '').trim();
    if (!userCode) {
      return makeResponse(
        request,
        { success: false, error: 'invalid_request', message: 'user_code is required' },
        { status: 400 },
      );
    }

    // Build Cloud Function URL
    const region = getRegion();
    const projectId = getProjectId();
    if (!projectId) {
      return makeResponse(
        request,
        { success: false, error: 'server_misconfigured', message: 'Project ID not configured' },
        { status: 500 },
      );
    }

    const fnUrl = `https://${region}-${projectId}.cloudfunctions.net/pickleGlassDeviceCodeComplete`;

    // Enforce same-origin POST if Origin header present (basic CSRF protection)
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return makeResponse(
        request,
        { success: false, error: 'invalid_origin', message: 'Cross-origin request not allowed' },
        { status: 403 },
      );
    }

    // Call Cloud Function
    const resp = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_code: userCode, token: idToken }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return makeResponse(
        request,
        {
          success: false,
          error: data?.error || `http_${resp.status}`,
          message: 'Device code completion failed',
        },
        { status: 400 },
      );
    }

    // Mirror function response
    const status = data?.status || 'unknown';
    const body = {
      success: status === 'approved',
      status,
    };

    const res = makeResponse(request, body, { status: 200 });

    // Security/telemetry headers
    try {
      res.headers.set('X-Frame-Options', 'DENY');
      res.headers.set('Cross-Origin-Resource-Policy', 'same-site');
      res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
      res.headers.set('Referrer-Policy', 'no-referrer');
      res.headers.set('Vary', 'Origin');
    } catch {
      // ignore
    }

    return res;
  } catch (error: any) {
    console.error('POST /api/device-code/complete error:', error?.message || error);
    return makeResponse(
      request,
      { success: false, error: 'server_error', message: 'Unable to complete device code flow' },
      { status: 500 },
    );
  }
}
