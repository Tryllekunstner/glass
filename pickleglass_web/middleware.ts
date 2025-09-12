import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest, handleAuthRedirect, handleLoginPageAccess, addAuthHeaders } from './lib/auth-middleware';
import { shouldProtectRoute } from './lib/route-config';

/**
 * Next.js middleware for server-side route protection
 * This runs on every request before the page is rendered
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for static files and API routes that don't need protection
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }
  
  try {
    // Get authentication context from request
    const authContext = await getAuthFromRequest(request);
    
    // Check if current route requires protection
    const routeConfig = shouldProtectRoute(pathname);
    
    // Handle authenticated users trying to access login page
    const loginRedirect = handleLoginPageAccess(request, authContext);
    if (loginRedirect) {
      return addAuthHeaders(loginRedirect, authContext);
    }
    
    // Handle route protection
    if (routeConfig && routeConfig.requiresAuth && !authContext.isAuthenticated) {
      const authRedirect = handleAuthRedirect(request, routeConfig);
      if (authRedirect) {
        return addAuthHeaders(authRedirect, authContext);
      }
    }
    
    // Continue to the requested page
    const response = NextResponse.next();
    return addAuthHeaders(response, authContext);
    
  } catch (error) {
    console.error('Middleware error:', error);
    
    // On error, check if route requires auth and redirect to login if needed
    const routeConfig = shouldProtectRoute(pathname);
    if (routeConfig && routeConfig.requiresAuth) {
      const redirectUrl = new URL('/login', request.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // For non-protected routes, continue with request
    return NextResponse.next();
  }
}

/**
 * Configure which routes the middleware should run on
 * This matcher ensures middleware only runs on app routes, not static files
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
