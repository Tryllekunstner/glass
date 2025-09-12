import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware - DISABLED
 * 
 * Server-side authentication is now handled by Express middleware in server.js
 * This middleware is kept minimal to avoid conflicts with the Express authentication layer
 * 
 * The Express middleware provides:
 * - Firebase Admin SDK token verification
 * - Route protection and redirects
 * - Session management
 * - Rate limiting
 * - Security headers
 */

export function middleware(request: NextRequest) {
  // Let Express middleware handle all authentication and route protection
  // This middleware only handles basic Next.js functionality
  
  const response = NextResponse.next();
  
  // Add basic security headers (Express middleware adds more comprehensive ones)
  response.headers.set('X-Middleware', 'nextjs-minimal');
  
  return response;
}

/**
 * Configure which routes the middleware should run on
 * Keep this minimal since Express handles authentication
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes are handled by Express)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
