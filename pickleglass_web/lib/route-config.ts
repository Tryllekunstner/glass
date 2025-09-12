// Route protection configuration
export interface RouteConfig {
  path: string;
  requiresAuth: boolean;
  redirectTo?: string;
}

// Define route protection rules
export const routeConfigs: RouteConfig[] = [
  // Public routes - no authentication required
  { path: '/login', requiresAuth: false },
  { path: '/api', requiresAuth: false }, // API routes handled separately
  
  // Protected routes - authentication required
  { path: '/', requiresAuth: true, redirectTo: '/login' },
  { path: '/activity', requiresAuth: true, redirectTo: '/login' },
  { path: '/profiles', requiresAuth: true, redirectTo: '/login' },
  { path: '/personalize', requiresAuth: true, redirectTo: '/login' },
  { path: '/settings', requiresAuth: true, redirectTo: '/login' },
  { path: '/help', requiresAuth: true, redirectTo: '/login' },
  { path: '/download', requiresAuth: true, redirectTo: '/login' },
];

/**
 * Check if a route requires authentication
 * @param pathname - The pathname to check
 * @returns RouteConfig if route needs protection, null otherwise
 */
export function shouldProtectRoute(pathname: string): RouteConfig | null {
  // Find exact match first
  let config = routeConfigs.find(config => config.path === pathname);
  
  if (config) {
    // Only return config if route requires auth
    return config.requiresAuth ? config : null;
  }
  
  // Check for path prefixes (for nested routes)
  config = routeConfigs.find(config => {
    if (config.path === '/') return false; // Don't match root for prefixes
    return pathname.startsWith(config.path + '/');
  });
  
  if (config) {
    // Only return config if route requires auth
    return config.requiresAuth ? config : null;
  }
  
  // Default behavior: protect all routes except explicitly public ones
  const isPublicRoute = routeConfigs.some(config => 
    !config.requiresAuth && (config.path === pathname || pathname.startsWith(config.path + '/'))
  );
  
  if (!isPublicRoute) {
    // Default protection for unlisted routes
    return { path: pathname, requiresAuth: true, redirectTo: '/login' };
  }
  
  return null;
}

/**
 * Check if a route is public (doesn't require authentication)
 * @param pathname - The pathname to check
 * @returns true if route is public, false otherwise
 */
export function isPublicRoute(pathname: string): boolean {
  return shouldProtectRoute(pathname) === null;
}
