/**
 * Route Protection Manager for Express middleware
 * Handles route configuration and protection logic for server-side authentication
 */

/**
 * Route protection configuration
 * Defines which routes require authentication and their behavior
 */
const ROUTE_CONFIG = [
  // Public routes (no authentication required)
  { path: '/login', requiresAuth: false, exact: true },
  { path: '/api', requiresAuth: false, prefix: true }, // All API routes are public by default
  { path: '/_next', requiresAuth: false, prefix: true }, // Next.js static files
  { path: '/favicon.ico', requiresAuth: false, exact: true },
  { path: '/robots.txt', requiresAuth: false, exact: true },
  { path: '/sitemap.xml', requiresAuth: false, exact: true },
  
  // Protected routes (authentication required)
  { path: '/', requiresAuth: true, exact: true, redirectTo: '/login' },
  { path: '/activity', requiresAuth: true, prefix: true, redirectTo: '/login' },
  { path: '/profiles', requiresAuth: true, prefix: true, redirectTo: '/login' },
  { path: '/settings', requiresAuth: true, prefix: true, redirectTo: '/login' },
  { path: '/personalize', requiresAuth: true, prefix: true, redirectTo: '/login' },
  { path: '/download', requiresAuth: true, prefix: true, redirectTo: '/login' },
  { path: '/help', requiresAuth: true, prefix: true, redirectTo: '/login' },
];

/**
 * Default configuration for routes not explicitly defined
 */
const DEFAULT_ROUTE_CONFIG = {
  requiresAuth: true, // Protect by default for security
  redirectTo: '/login',
};

/**
 * Route Protection Manager Class
 */
class RouteProtectionManager {
  constructor(config = ROUTE_CONFIG, defaultConfig = DEFAULT_ROUTE_CONFIG) {
    this.config = config;
    this.defaultConfig = defaultConfig;
    this.publicPaths = this.config
      .filter(route => !route.requiresAuth)
      .map(route => route.path);
    this.protectedPaths = this.config
      .filter(route => route.requiresAuth)
      .map(route => route.path);
  }

  /**
   * Check if a route should be protected
   * @param {string} pathname - Request pathname
   * @returns {Object|null} Route configuration or null if public
   */
  shouldProtectRoute(pathname) {
    if (!pathname || typeof pathname !== 'string') {
      return this.defaultConfig;
    }

    // Normalize pathname
    const normalizedPath = pathname.toLowerCase();

    // Check for exact matches first
    for (const route of this.config) {
      if (route.exact && normalizedPath === route.path.toLowerCase()) {
        return route.requiresAuth ? route : null;
      }
    }

    // Check for prefix matches
    for (const route of this.config) {
      if (route.prefix && normalizedPath.startsWith(route.path.toLowerCase())) {
        return route.requiresAuth ? route : null;
      }
    }

    // Return default configuration for unlisted routes
    return this.defaultConfig;
  }

  /**
   * Check if a route is public (doesn't require authentication)
   * @param {string} pathname - Request pathname
   * @returns {boolean} True if route is public
   */
  isPublicRoute(pathname) {
    const config = this.shouldProtectRoute(pathname);
    return config === null;
  }

  /**
   * Check if a route is protected (requires authentication)
   * @param {string} pathname - Request pathname
   * @returns {boolean} True if route is protected
   */
  isProtectedRoute(pathname) {
    return !this.isPublicRoute(pathname);
  }

  /**
   * Get redirect URL for a protected route
   * @param {string} pathname - Request pathname
   * @returns {string} Redirect URL
   */
  getRedirectUrl(pathname) {
    const config = this.shouldProtectRoute(pathname);
    return config?.redirectTo || this.defaultConfig.redirectTo;
  }

  /**
   * Handle authentication redirect for protected routes
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Object} config - Route configuration
   */
  handleAuthRedirect(req, res, config) {
    const redirectUrl = config.redirectTo || this.defaultConfig.redirectTo;
    const returnUrl = encodeURIComponent(req.originalUrl);
    const fullRedirectUrl = `${redirectUrl}?returnUrl=${returnUrl}`;

    // For API requests, return JSON error
    if (this.isApiRequest(req)) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
        redirectUrl: fullRedirectUrl,
      });
    }

    // For browser requests, redirect to login
    res.redirect(302, fullRedirectUrl);
  }

  /**
   * Handle login page access (redirect if already authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Object} user - Authenticated user data
   */
  handleLoginPageAccess(req, res, user) {
    if (!user) {
      return; // Not authenticated, allow access to login page
    }

    // User is already authenticated, redirect to appropriate page
    const returnUrl = req.query.returnUrl;
    let redirectUrl = '/'; // Default to home page

    if (returnUrl && typeof returnUrl === 'string') {
      try {
        const decodedUrl = decodeURIComponent(returnUrl);
        // Validate that the return URL is safe (same origin)
        if (decodedUrl.startsWith('/') && !decodedUrl.startsWith('//')) {
          redirectUrl = decodedUrl;
        }
      } catch (error) {
        console.warn('Invalid return URL:', returnUrl);
      }
    }

    res.redirect(302, redirectUrl);
  }

  /**
   * Check if request is an API call
   * @param {Object} req - Express request object
   * @returns {boolean} True if API request
   */
  isApiRequest(req) {
    return req.path.startsWith('/api/') || 
           req.headers['content-type']?.includes('application/json') ||
           req.headers.accept?.includes('application/json');
  }

  /**
   * Get route statistics
   * @returns {Object} Route statistics
   */
  getStats() {
    return {
      totalRoutes: this.config.length,
      publicRoutes: this.publicPaths.length,
      protectedRoutes: this.protectedPaths.length,
      defaultProtection: this.defaultConfig.requiresAuth,
    };
  }

  /**
   * Add a new route configuration
   * @param {Object} routeConfig - Route configuration
   */
  addRoute(routeConfig) {
    this.config.push(routeConfig);
    this.refreshCaches();
  }

  /**
   * Remove a route configuration
   * @param {string} path - Route path to remove
   */
  removeRoute(path) {
    this.config = this.config.filter(route => route.path !== path);
    this.refreshCaches();
  }

  /**
   * Update route configuration
   * @param {string} path - Route path to update
   * @param {Object} updates - Configuration updates
   */
  updateRoute(path, updates) {
    const routeIndex = this.config.findIndex(route => route.path === path);
    if (routeIndex !== -1) {
      this.config[routeIndex] = { ...this.config[routeIndex], ...updates };
      this.refreshCaches();
    }
  }

  /**
   * Refresh internal caches after configuration changes
   */
  refreshCaches() {
    this.publicPaths = this.config
      .filter(route => !route.requiresAuth)
      .map(route => route.path);
    this.protectedPaths = this.config
      .filter(route => route.requiresAuth)
      .map(route => route.path);
  }

  /**
   * Export current configuration
   * @returns {Object} Current configuration
   */
  exportConfig() {
    return {
      routes: [...this.config],
      defaultConfig: { ...this.defaultConfig },
    };
  }

  /**
   * Import configuration
   * @param {Object} config - Configuration to import
   */
  importConfig(config) {
    if (config.routes) {
      this.config = config.routes;
    }
    if (config.defaultConfig) {
      this.defaultConfig = config.defaultConfig;
    }
    this.refreshCaches();
  }
}

// Create singleton instance
const routeManager = new RouteProtectionManager();

// Export individual functions for convenience
function shouldProtectRoute(pathname) {
  return routeManager.shouldProtectRoute(pathname);
}

function isPublicRoute(pathname) {
  return routeManager.isPublicRoute(pathname);
}

function isProtectedRoute(pathname) {
  return routeManager.isProtectedRoute(pathname);
}

function getRedirectUrl(pathname) {
  return routeManager.getRedirectUrl(pathname);
}

function handleAuthRedirect(req, res, config) {
  return routeManager.handleAuthRedirect(req, res, config);
}

function handleLoginPageAccess(req, res, user) {
  return routeManager.handleLoginPageAccess(req, res, user);
}

module.exports = {
  RouteProtectionManager,
  routeManager,
  shouldProtectRoute,
  isPublicRoute,
  isProtectedRoute,
  getRedirectUrl,
  handleAuthRedirect,
  handleLoginPageAccess,
  ROUTE_CONFIG,
  DEFAULT_ROUTE_CONFIG,
};
