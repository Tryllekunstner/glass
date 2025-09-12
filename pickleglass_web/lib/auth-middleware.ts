import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, VerifiedUser } from './firebase-admin';
import { shouldProtectRoute, RouteConfig } from './route-config';

// Server-side authentication context
export interface ServerAuthContext {
  user: VerifiedUser | null;
  isAuthenticated: boolean;
}

/**
 * Extract authentication token from request cookies
 * @param request - Next.js request object
 * @returns Firebase ID token or null
 */
function getAuthTokenFromRequest(request: NextRequest): string | null {
  // Try to get token from Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Try to get token from cookies
  const tokenCookie = request.cookies.get('auth-token');
  if (tokenCookie) {
    return tokenCookie.value;
  }
  
  // Try to get token from __session cookie (Firebase hosting default)
  const sessionCookie = request.cookies.get('__session');
  if (sessionCookie) {
    return sessionCookie.value;
  }
  
  return null;
}

/**
 * Get authentication context from request
 * @param request - Next.js request object
 * @returns Server authentication context
 */
export async function getAuthFromRequest(request: NextRequest): Promise<ServerAuthContext> {
  const token = getAuthTokenFromRequest(request);
  
  if (!token) {
    return {
      user: null,
      isAuthenticated: false,
    };
  }
  
  try {
    const user = await verifyAuthToken(token);
    return {
      user,
      isAuthenticated: user !== null,
    };
  } catch (error) {
    console.error('Error verifying auth token in middleware:', error);
    return {
      user: null,
      isAuthenticated: false,
    };
  }
}

/**
 * Handle authentication redirect for protected routes
 * @param request - Next.js request object
 * @param config - Route configuration
 * @returns Next.js response with redirect or null to continue
 */
export function handleAuthRedirect(request: NextRequest, config: RouteConfig): NextResponse | null {
  if (!config.requiresAuth) {
    return null; // No protection needed
  }
  
  const redirectTo = config.redirectTo || '/login';
  const currentPath = request.nextUrl.pathname;
  
  // Avoid redirect loops
  if (currentPath === redirectTo) {
    return null;
  }
  
  // Create redirect URL
  const redirectUrl = new URL(redirectTo, request.url);
  
  // Add return URL as query parameter for better UX
  if (currentPath !== '/') {
    redirectUrl.searchParams.set('returnUrl', currentPath);
  }
  
  return NextResponse.redirect(redirectUrl);
}

/**
 * Handle authenticated user accessing login page
 * @param request - Next.js request object
 * @param authContext - Authentication context
 * @returns Next.js response with redirect or null to continue
 */
export function handleLoginPageAccess(request: NextRequest, authContext: ServerAuthContext): NextResponse | null {
  const currentPath = request.nextUrl.pathname;
  
  // If user is authenticated and trying to access login page, redirect them
  if (currentPath === '/login' && authContext.isAuthenticated) {
    // Check for return URL in query parameters
    const returnUrl = request.nextUrl.searchParams.get('returnUrl');
    const redirectTo = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/';
    
    const redirectUrl = new URL(redirectTo, request.url);
    return NextResponse.redirect(redirectUrl);
  }
  
  return null;
}

/**
 * Create response with authentication headers
 * @param response - Next.js response
 * @param authContext - Authentication context
 * @returns Modified response with auth headers
 */
export function addAuthHeaders(response: NextResponse, authContext: ServerAuthContext): NextResponse {
  // Add authentication status to headers for client-side use
  response.headers.set('x-auth-status', authContext.isAuthenticated ? 'authenticated' : 'unauthenticated');
  
  if (authContext.user) {
    response.headers.set('x-user-id', authContext.user.uid);
    response.headers.set('x-user-email', authContext.user.email);
  }
  
  return response;
}
