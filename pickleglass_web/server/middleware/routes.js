/**
 * Route Configuration and Protection Utilities
 * Defines which routes require authentication and handles redirects
 */

/**
 * Route protection configuration
 * Define which routes require authentication and their specific requirements
 */
const PROTECTED_ROUTES = {
  // User profile and settings
  '/profiles': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: '/login',
  },
  '/settings': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: '/login',
  },
  '/personalize': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: '/login',
  },
  
  // User activity and data
  '/activity': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: '/login',
  },
  
  // API routes that require authentication
  '/api/user': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: null, // API routes return JSON errors instead of redirects
  },
  '/api/profiles': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: null,
  },
  '/api/settings': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: null,
  },
  // New protected APIs
  '/api/device': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: null,
  },
  '/api/agent-configs': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: null,
  },
  '/api/activity': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: null,
  },
  // Phase 2 device-code flow (web completion endpoint)
  '/api/device-code': {
    requireAuth: true,
    allowedRoles: [],
    redirectTo: null,
  },
};

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/help',
  '/download',
  '/api/health',
  '/api/status',
  '/health',
  '/healthz',
  '/status',
  '/server-info',
];

/**
 * Routes that should redirect authenticated users away (like login page)
 */
const GUEST_ONLY_ROUTES = [
  '/login',
];

/**
 * Check if a route requires protection
 * @param {string} path - Request path
 * @returns {Object|null} Route configuration or null if public
 */
function shouldProtectRoute(path) {
  // Check exact matches first
  if (PROTECTED_ROUTES[path]) {
    return PROTECTED_ROUTES[path];
  }

  // Check for pattern matches (e.g., API routes)
  for (const [routePattern, config] of Object.entries(PROTECTED_ROUTES)) {
    if (path.startsWith(routePattern)) {
      return config;
    }
  }

  // Check if it's explicitly public
  if (PUBLIC_ROUTES.includes(path)) {
    return null;
  }

  // Check for public route patterns
  const publicPatterns = [
    /^\/_next\//,           // Next.js static files
    /^\/static\//,          // Static assets
    /^\/favicon\./,         // Favicon
    /^\/robots\.txt$/,      // Robots.txt
    /^\/sitemap\.xml$/,     // Sitemap
    /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/, // Static files
  ];

  for (const pattern of publicPatterns) {
    if (pattern.test(path)) {
      return null;
    }
  }

  // Default: no protection required for unlisted routes
  return null;
}

/**
 * Check if route should only be accessible to guests (unauthenticated users)
 * @param {string} path - Request path
 * @returns {boolean} True if guest-only route
 */
function isGuestOnlyRoute(path) {
  return GUEST_ONLY_ROUTES.includes(path);
}

/**
 * Handle authentication redirect for protected routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} routeConfig - Route configuration
 */
function handleAuthRedirect(req, res, routeConfig) {
  const { isApiRequest } = require('../utils/auth-helpers');
  
  if (isApiRequest(req)) {
    // For API requests, return JSON error
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource',
      path: req.path,
    });
  }

  // For browser requests, redirect to login
  const redirectTo = routeConfig.redirectTo || '/login';
  const returnUrl = encodeURIComponent(req.originalUrl);
  const loginUrl = `${redirectTo}?returnUrl=${returnUrl}`;
  
  return res.redirect(302, loginUrl);
}

/**
 * Handle login page access when user is already authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} user - Authenticated user object
 */
function handleLoginPageAccess(req, res, user) {
  // Get return URL from query parameters
  const returnUrl = req.query.returnUrl;
  let redirectUrl = '/';

  if (returnUrl && typeof returnUrl === 'string') {
    try {
      const decodedUrl = decodeURIComponent(returnUrl);
      // Ensure it's a relative URL and not an external redirect
      if (decodedUrl.startsWith('/') && !decodedUrl.startsWith('//')) {
        redirectUrl = decodedUrl;
      }
    } catch (error) {
      console.warn('Invalid return URL:', returnUrl);
    }
  }

  console.log(`🔐 User ${user.email} already authenticated, redirecting from login to ${redirectUrl}`);
  return res.redirect(302, redirectUrl);
}

/**
 * Get route configuration for a specific path
 * @param {string} path - Request path
 * @returns {Object} Route configuration
 */
function getRouteConfig(path) {
  const protectionConfig = shouldProtectRoute(path);
  const isGuestOnly = isGuestOnlyRoute(path);
  const isPublic = !protectionConfig && !isGuestOnly;

  return {
    path,
    requireAuth: !!protectionConfig,
    isPublic,
    isGuestOnly,
    allowedRoles: protectionConfig?.allowedRoles || [],
    redirectTo: protectionConfig?.redirectTo || '/login',
  };
}

/**
 * Validate route configuration
 * @param {Object} config - Route configuration to validate
 * @returns {boolean} True if valid
 */
function validateRouteConfig(config) {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Check required fields
  if (typeof config.requireAuth !== 'boolean') {
    return false;
  }

  if (config.allowedRoles && !Array.isArray(config.allowedRoles)) {
    return false;
  }

  return true;
}

/**
 * Add or update route protection configuration
 * @param {string} path - Route path
 * @param {Object} config - Route configuration
 */
function addProtectedRoute(path, config) {
  if (!validateRouteConfig(config)) {
    throw new Error(`Invalid route configuration for ${path}`);
  }

  PROTECTED_ROUTES[path] = config;
}

/**
 * Remove route protection
 * @param {string} path - Route path
 */
function removeProtectedRoute(path) {
  delete PROTECTED_ROUTES[path];
}

/**
 * Get all protected routes
 * @returns {Object} All protected routes configuration
 */
function getAllProtectedRoutes() {
  return { ...PROTECTED_ROUTES };
}

/**
 * Get all public routes
 * @returns {Array} All public routes
 */
function getAllPublicRoutes() {
  return [...PUBLIC_ROUTES];
}

/**
 * Check if user has permission to access route
 * @param {Object} user - User object
 * @param {Object} routeConfig - Route configuration
 * @returns {boolean} True if user has permission
 */
function hasRoutePermission(user, routeConfig) {
  if (!routeConfig || !routeConfig.requireAuth) {
    return true;
  }

  if (!user) {
    return false;
  }

  // Check role-based permissions
  if (routeConfig.allowedRoles && routeConfig.allowedRoles.length > 0) {
    const userRoles = user.customClaims?.roles || [];
    return routeConfig.allowedRoles.some(role => userRoles.includes(role));
  }

  // If no specific roles required, just need to be authenticated
  return true;
}

/**
 * Generate route protection middleware for specific route
 * @param {string} path - Route path
 * @param {Object} config - Route configuration
 * @returns {Function} Express middleware function
 */
function createRouteProtectionMiddleware(path, config) {
  return (req, res, next) => {
    if (req.path !== path) {
      return next();
    }

    const routeConfig = shouldProtectRoute(path);
    if (!routeConfig) {
      return next();
    }

    if (!req.auth || !req.auth.isAuthenticated) {
      return handleAuthRedirect(req, res, routeConfig);
    }

    if (!hasRoutePermission(req.user, routeConfig)) {
      const { isApiRequest } = require('../utils/auth-helpers');
      
      if (isApiRequest(req)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You do not have permission to access this resource',
        });
      }

      return res.redirect(302, '/unauthorized');
    }

    next();
  };
}

module.exports = {
  shouldProtectRoute,
  isGuestOnlyRoute,
  handleAuthRedirect,
  handleLoginPageAccess,
  getRouteConfig,
  validateRouteConfig,
  addProtectedRoute,
  removeProtectedRoute,
  getAllProtectedRoutes,
  getAllPublicRoutes,
  hasRoutePermission,
  createRouteProtectionMiddleware,
  PROTECTED_ROUTES,
  PUBLIC_ROUTES,
  GUEST_ONLY_ROUTES,
};
