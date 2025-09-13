import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthToken } from '@/lib/firebase-admin';

// Use CommonJS util implemented on server side per plan
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateDeepLink, createNonce, setDeepLinkHeaders } = require('@/server/utils/deep-link.js');

type DeepLinkRequestBody = {
  action?: string;        // e.g., 'auth-success'
  token?: string;         // Firebase ID token (Phase 1: still passed; Phase 2 will switch to device-code)
  returnTo?: string;      // optional return path
  extra?: Record<string, string>;
};

function makeResponse(request: NextRequest, body: any, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  const cid = request.headers.get('x-request-id') || request.headers.get('x-correlation-id');
  if (cid) res.headers.set('X-Request-ID', cid);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/**
 * POST /api/auth/deep-link
 * Auth required. Generates a Phase 1 deep-link URI including a cryptographic nonce and minimal payload.
 * Returns: { success, url, nonce, timestamp }
 */
export async function POST(request: NextRequest) {
  // Prepare an early response so we can still attach headers later
  try {
    // Auth check using cookie per existing API conventions
    const cookieStore = cookies();
    const token = cookieStore.get('authToken')?.value;

    if (!token) {
      return makeResponse(
        request,
        {
          success: false,
          error: 'authentication_required',
          message: 'Authentication token not found',
        },
        { status: 401 },
      );
    }

    const user = await verifyAuthToken(token);
    if (!user) {
      return makeResponse(
        request,
        {
          success: false,
          error: 'invalid_token',
          message: 'Invalid or expired token',
        },
        { status: 401 },
      );
    }

    let payload: DeepLinkRequestBody | null = null;
    try {
      payload = (await request.json()) as DeepLinkRequestBody;
    } catch {
      return makeResponse(
        request,
        { success: false, error: 'invalid_json', message: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const action = (payload?.action && typeof payload.action === 'string') ? payload.action : 'auth-success';
    const returnTo = (payload?.returnTo && typeof payload.returnTo === 'string') ? payload.returnTo : '/';
    const idToken = (payload?.token && typeof payload.token === 'string') ? payload.token : undefined;

    // CSRF: enforce same-origin for POST if Origin header is present
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return makeResponse(
        request,
        {
          success: false,
          error: 'invalid_origin',
          message: 'Cross-origin request not allowed',
        },
        { status: 403 },
      );
    }

    // Generate a server-side nonce
    const nonce: string = createNonce(16);

    // Build URL via shared helper. In Phase 1 we still include token for desktop exchange;
    // this will be replaced in Phase 2 with a device-code/PKCE-like grant.
    const url: string = generateDeepLink({
      action,
      nonce,
      token: idToken,
      returnTo,
      extra: payload?.extra,
    });

    // Set deep-link headers to help telemetry/correlation (server-only)
    // NextResponse doesn't expose a direct way to write headers via Express' res,
    // but we mirror the same values on the NextResponse so proxies can log them.
    const res = makeResponse(request, {
      success: true,
      uid: user.uid,
      url,
      nonce,
      timestamp: new Date().toISOString(),
    });

    try {
      res.headers.set('X-DeepLink-Nonce', String(nonce));
      const region =
        process.env.REGION ||
        process.env.FIREBASE_REGION ||
        process.env.GOOGLE_CLOUD_REGION ||
        'europe-west1';
      res.headers.set('X-DeepLink-Region', region);
      // Tighten response for security/telemetry
      res.headers.set('X-Frame-Options', 'DENY');
      res.headers.set('Cross-Origin-Resource-Policy', 'same-site');
      res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
      res.headers.set('Referrer-Policy', 'no-referrer');
      // Vary on Origin since we validated it (helps caching layers)
      res.headers.set('Vary', 'Origin');
    } catch {
      // ignore header set failures
    }

    return res;
  } catch (error: any) {
    console.error('POST /api/auth/deep-link error:', error?.message || error);
    return makeResponse(
      request,
      {
        success: false,
        error: 'server_error',
        message: 'Unable to generate deep link',
      },
      { status: 500 },
    );
  }
}
