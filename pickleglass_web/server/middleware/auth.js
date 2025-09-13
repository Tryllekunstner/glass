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

      // Continue with authentication (with fallback)
      performAuthenticationWithFallback(req, res, next, startTime);
    });

  } catch (error) {
    console.error('🔒 Authentication middleware error:', error);
    logAuthEvent('middleware_error', req, null, { error: error.message });
    
    // Use fallback authentication
    return createFallbackAuthMiddleware()(req, res, next);
  }
}

/**
 * Perform authentication with fallback support
 */
async function performAuthenticationWithFallback(req, res, next, startTime) {
  try {
    // Check if we're in fast startup mode and auth services might not be ready
    if (process.env.FAST_STARTUP_ENABLED === 'true') {
      const { authService } = require('../utils/firebase-admin');
      
      // If auth service is not initialized yet, use graceful degradation
      if (!authService.initialized) {
        console.log('🚀 Fast startup mode: Auth service not ready, using graceful degradation');
        return performGracefulDegradation(req, res, next, startTime);
      }
    }

    await performAuthentication(req, res, next, startTime);
  } catch (error) {
    console.error('🔒 Authentication failed, using fallback:', error);
    logAuthEvent('auth_fallback_triggered', req, null, { error: error.message });
    
    // Use fallback middleware
    return createFallbackAuthMiddleware()(req, res, next);
  }
}

/**
 * Perform graceful degradation when auth services are not ready
 */
async function performGracefulDegradation(req, res, next, startTime) {
  try {
    // Extract token for future use when auth service becomes available
    const token = extractAuthToken(req);
    
    // Create minimal auth context indicating services are initializing
    const authContext = {
      user: null,
      isAuthenticated: false,
      token: token,
      fallback: false,
      initializing: true,
      message: 'Authentication services are initializing',
    };

    // Attach auth context to request
    req.auth = authContext;
    req.user = null;

    // Set headers to indicate auth is initializing
    res.setHeader('X-Auth-Status', 'initializing');
    res.setHeader('X-Auth-Mode', 'graceful-degradation');

    // Check route protection with graceful degradation
    const routeConfig = shouldProtectRoute(req.path);
    
    if (routeConfig) {
      // Route requires authentication but services aren't ready
      logAuthEvent('graceful_degradation_access_denied', req, null, { 
        reason: 'authentication_services_initializing',
        path: req.path 
      });

      if (isApiRequest(req)) {
        return res.status(503).json({
          error: 'Authentication services are initializing',
          message: 'Please try again in a few moments',
          status: 'initializing',
          retryAfter: 5, // Suggest retry after 5 seconds
        });
      }

      // For browser requests, show a loading page or redirect to login with message
      return res.status(503).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Loading...</title>
            <meta http-equiv="refresh" content="3">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 40px; 
                text-align: center; 
                background: #f5f5f5;
              }
              .loading { 
                background: white; 
                padding: 40px; 
                border-radius: 10px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 500px; 
                margin: 100px auto; 
              }
              .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 2s linear infinite;
                margin: 20px auto;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div class="loading">
              <div class="spinner"></div>
              <h2>Starting up...</h2>
              <p>Authentication services are initializing. This page will refresh automatically.</p>
              <p><small>If this takes too long, please <a href="javascript:window.location.reload()">refresh manually</a>.</small></p>
            </div>
          </body>
        </html>
      `);
    }

    // Public route, continue with graceful degradation
    logAuthEvent('graceful_degradation_public_access', req, null, { path: req.path });
    
    // Log performance metrics
    const duration = Date.now() - startTime;
    console.log(`🚀 Graceful degradation completed in ${duration}ms for ${req.path}`);
    
    next();

  } catch (error) {
    console.error('🔒 Graceful degradation error:', error);
    logAuthEvent('graceful_degradation_error', req, null, { error: error.message });
    
    // Fall back to the fallback middleware
    return createFallbackAuthMiddleware()(req, res, next);
  }
}

/**
 * Create fallback authentication middleware when Firebase Admin fails
 * @returns {Function} Fallback middleware function
 */
function createFallbackAuthMiddleware() {
  return (req, res, next) => {
    console.warn('⚠️  Using fallback authentication middleware');
    
    // Create minimal auth context
    req.auth = {
      user: null,
      isAuthenticated: false,
      token: null,
      fallback: true,
    };
    req.user = null;

    // Check route protection with fallback behavior
    const routeConfig = shouldProtectRoute(req.path);
    
    if (routeConfig) {
      // Route requires authentication but we can't verify
      logAuthEvent('fallback_access_denied', req, null, { 
        reason: 'authentication_service_unavailable',
        path: req.path 
      });

      if (isApiRequest(req)) {
        return res.status(503).json({
          error: 'Authentication service temporarily unavailable',
          message: 'Please try again later',
          fallback: true,
        });
      }

      // For browser requests, redirect to a maintenance page or login
      return res.status(503).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Service Temporarily Unavailable</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
              .error { background: #f8f8f8; padding: 20px; border-radius: 5px; max-width: 500px; margin: 0 auto; }
              .retry { margin-top: 20px; }
              button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Service Temporarily Unavailable</h1>
              <p>The authentication service is temporarily unavailable. Please try again in a few moments.</p>
              <div class="retry">
                <button onclick="window.location.reload()">Retry</button>
              </div>
            </div>
          </body>
        </html>
      `);
    }

    // Public route, continue
    next();
  };
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
