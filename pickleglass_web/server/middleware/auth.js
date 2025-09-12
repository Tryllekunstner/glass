const rateLimit = require('express-rate-limit');
const { verifyAndGetUser, isTokenNearExpiry } = require('../utils/firebase-admin');
const { 
  extractAuthToken, 
  createAuthContext, 
  setUserHeaders, 
  isBrowserRequest,
  isApiRequest,
  logAuthEvent 
} = require('../utils/auth-helpers');
const { 
  shouldProtectRoute, 
  handleAuthRedirect, 
  handleLoginPageAccess 
} = require('./routes');

/**
 * Rate limiting for authentication attempts
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static files and health checks
    return req.path.startsWith('/_next/') || 
           req.path === '/health' || 
           req.path === '/favicon.ico';
  },
});

/**
 * Main authentication middleware for Express server
 * Handles server-side route protection and user authentication
 */
async function authenticateRequest(req, res, next) {
  const startTime = Date.now();
  
  try {
    // Skip authentication for static files and Next.js internals
    if (shouldSkipAuthentication(req)) {
      return next();
    }

    // Apply rate limiting
    authRateLimit(req, res, (rateLimitError) => {
      if (rateLimitError) {
        logAuthEvent('rate_limit_exceeded', req);
        return; // Rate limit middleware handles the response
      }

      // Continue with authentication
      performAuthentication(req, res, next, startTime);
    });

  } catch (error) {
    console.error('🔒 Authentication middleware error:', error);
    logAuthEvent('middleware_error', req, null, { error: error.message });
    
    // For API requests, return JSON error
    if (isApiRequest(req)) {
      return res.status(500).json({
        error: 'Authentication service error',
        message: 'Please try again later',
      });
    }

    // For browser requests, allow through but log the error
    next();
  }
}

/**
 * Perform the actual authentication logic
 */
async function performAuthentication(req, res, next, startTime) {
  try {
    // Extract authentication token
    const token = extractAuthToken(req);
    let user = null;
    let authContext = null;

    // Verify token if present
    if (token) {
      user = await verifyAndGetUser(token);
      
      if (user) {
        // Check if token is near expiry
        if (isTokenNearExpiry(user)) {
          logAuthEvent('token_near_expiry', req, user);
          // Set header to indicate client should refresh token
          res.setHeader('X-Token-Refresh-Required', 'true');
        }
        
        logAuthEvent('authentication_success', req, user);
      } else {
        logAuthEvent('authentication_failed', req, null, { reason: 'invalid_token' });
      }
    }

    // Create authentication context
    authContext = createAuthContext(user, token);

    // Attach auth context to request
    req.auth = authContext;
    req.user = user;

    // Set user headers for client-side access
    setUserHeaders(res, user);

    // Check route protection
    const routeConfig = shouldProtectRoute(req.path);
    
    if (routeConfig) {
      // Route requires authentication
      if (!user) {
        logAuthEvent('access_denied', req, null, { 
          reason: 'authentication_required',
          path: req.path 
        });
        return handleAuthRedirect(req, res, routeConfig);
      }

      // User is authenticated, check for additional requirements
      if (routeConfig.allowedRoles && routeConfig.allowedRoles.length > 0) {
        // Role-based access control (if implemented in the future)
        const userRoles = user.customClaims?.roles || [];
        const hasRequiredRole = routeConfig.allowedRoles.some(role => 
          userRoles.includes(role)
        );

        if (!hasRequiredRole) {
          logAuthEvent('access_denied', req, user, { 
            reason: 'insufficient_permissions',
            requiredRoles: routeConfig.allowedRoles,
            userRoles 
          });
          
          if (isApiRequest(req)) {
            return res.status(403).json({
              error: 'Insufficient permissions',
              message: 'You do not have permission to access this resource',
            });
          }

          return res.redirect(302, '/unauthorized');
        }
      }

      logAuthEvent('access_granted', req, user, { path: req.path });
    }

    // Handle login page access (redirect if already authenticated)
    if (req.path === '/login' && user) {
      return handleLoginPageAccess(req, res, user);
    }

    // Log performance metrics
    const duration = Date.now() - startTime;
    if (duration > 1000) { // Log slow authentication requests
      console.warn(`🐌 Slow authentication: ${duration}ms for ${req.path}`);
    }

    // Continue to Next.js
    next();

  } catch (error) {
    console.error('🔒 Authentication error:', error);
    logAuthEvent('authentication_error', req, null, { error: error.message });
    
    // For critical errors, deny access to protected routes
    const routeConfig = shouldProtectRoute(req.path);
    if (routeConfig) {
      if (isApiRequest(req)) {
        return res.status(500).json({
          error: 'Authentication service error',
          message: 'Please try again later',
        });
      }
      return res.redirect(302, '/login?error=auth_service_error');
    }

    // For public routes, continue but log the error
    next();
  }
}

/**
 * Check if authentication should be skipped for this request
 */
function shouldSkipAuthentication(req) {
  const path = req.path;
  
  // Skip for Next.js static files and build files
  if (path.startsWith('/_next/') || 
      path.startsWith('/static/') ||
      path.startsWith('/__nextjs_original-stack-frame') ||
      path.includes('hot-reload')) {
    return true;
  }

  // Skip for common static files
  if (path.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/)) {
    return true;
  }

  // Skip for health checks and monitoring
  if (path === '/health' || path === '/status' || path === '/ping') {
    return true;
  }

  return false;
}

/**
 * Middleware to ensure user is authenticated
 * Use this for routes that absolutely require authentication
 */
function requireAuth(req, res, next) {
  if (!req.auth || !req.auth.isAuthenticated) {
    logAuthEvent('auth_required_failed', req);
    
    if (isApiRequest(req)) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
    }

    return res.redirect(302, `/login?returnUrl=${encodeURIComponent(req.originalUrl)}`);
  }

  next();
}

/**
 * Middleware to ensure user is NOT authenticated (for login/register pages)
 */
function requireGuest(req, res, next) {
  if (req.auth && req.auth.isAuthenticated) {
    logAuthEvent('guest_required_failed', req, req.user);
    
    const returnUrl = req.query.returnUrl;
    let redirectUrl = '/';

    if (returnUrl && typeof returnUrl === 'string') {
      try {
        const decodedUrl = decodeURIComponent(returnUrl);
        if (decodedUrl.startsWith('/') && !decodedUrl.startsWith('//')) {
          redirectUrl = decodedUrl;
        }
      } catch (error) {
        console.warn('Invalid return URL:', returnUrl);
      }
    }

    return res.redirect(302, redirectUrl);
  }

  next();
}

/**
 * Middleware to check user roles
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.auth || !req.auth.isAuthenticated) {
      return requireAuth(req, res, next);
    }

    const userRoles = req.user?.customClaims?.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logAuthEvent('role_check_failed', req, req.user, { 
        requiredRoles: roles,
        userRoles 
      });

      if (isApiRequest(req)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You do not have permission to access this resource',
          requiredRoles: roles,
        });
      }

      return res.redirect(302, '/unauthorized');
    }

    next();
  };
}

/**
 * Health check endpoint for authentication service
 */
async function healthCheck(req, res) {
  try {
    const { healthCheck } = require('../utils/firebase-admin');
    const isHealthy = await healthCheck();
    
    const status = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'authentication',
      version: process.env.npm_package_version || '1.0.0',
    };

    res.status(isHealthy ? 200 : 503).json(status);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'authentication',
      error: error.message,
    });
  }
}

module.exports = {
  authenticateRequest,
  requireAuth,
  requireGuest,
  requireRole,
  healthCheck,
  authRateLimit,
};
