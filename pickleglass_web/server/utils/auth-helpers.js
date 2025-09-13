/**
 * Authentication Helper Utilities
 * Provides utility functions for authentication middleware
 */

/**
 * Extract authentication token from request
 * @param {Object} req - Express request object
 * @returns {string|null} Authentication token or null
 */
function extractAuthToken(req) {
  // Check Authorization header first (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies for Firebase ID token
  if (req.cookies && req.cookies.firebaseIdToken) {
    return req.cookies.firebaseIdToken;
  }

  // Check for token in custom header
  if (req.headers['x-firebase-token']) {
    return req.headers['x-firebase-token'];
  }

  return null;
}

/**
 * Create authentication context object
 * @param {Object|null} user - Verified user object or null
 * @param {string|null} token - Authentication token or null
 * @returns {Object} Authentication context
 */
function createAuthContext(user, token) {
  return {
    user: user,
    isAuthenticated: !!user,
    token: token,
    fallback: false,
    initializing: false,
  };
}

/**
 * Set user headers for client-side access
 * @param {Object} res - Express response object
 * @param {Object|null} user - User object or null
 */
function setUserHeaders(res, user) {
  if (user) {
    res.setHeader('X-User-Authenticated', 'true');
    res.setHeader('X-User-ID', user.uid);
    if (user.email) {
      res.setHeader('X-User-Email', user.email);
    }
  } else {
    res.setHeader('X-User-Authenticated', 'false');
  }
}

/**
 * Check if request is from a browser
 * @param {Object} req - Express request object
 * @returns {boolean} True if browser request
 */
function isBrowserRequest(req) {
  const userAgent = req.headers['user-agent'] || '';
  const acceptHeader = req.headers.accept || '';
  
  // Check for common browser user agents
  const browserPatterns = [
    /Mozilla/i,
    /Chrome/i,
    /Safari/i,
    /Firefox/i,
    /Edge/i,
    /Opera/i,
  ];

  const hasBrowserUserAgent = browserPatterns.some(pattern => pattern.test(userAgent));
  const acceptsHtml = acceptHeader.includes('text/html');

  return hasBrowserUserAgent && acceptsHtml;
}

/**
 * Check if request is an API request
 * @param {Object} req - Express request object
 * @returns {boolean} True if API request
 */
function isApiRequest(req) {
  const path = req.path;
  const acceptHeader = req.headers.accept || '';
  
  // Check if path starts with /api/
  if (path.startsWith('/api/')) {
    return true;
  }

  // Check if client accepts JSON
  if (acceptHeader.includes('application/json')) {
    return true;
  }

  // Check for AJAX requests
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return true;
  }

  return false;
}

/**
 * Log authentication events for monitoring and debugging
 * @param {string} event - Event name
 * @param {Object} req - Express request object
 * @param {Object|null} user - User object or null
 * @param {Object} metadata - Additional metadata
 */
function logAuthEvent(event, req, user = null, metadata = {}) {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    path: req.path,
    method: req.method,
    userId: user ? user.uid : null,
    userEmail: user ? user.email : null,
    ...metadata,
  };

  // Log different events at different levels
  switch (event) {
    case 'authentication_success':
    case 'access_granted':
      console.log(`🔐 ${event}:`, JSON.stringify(logData, null, 2));
      break;
    
    case 'authentication_failed':
    case 'access_denied':
    case 'token_near_expiry':
      console.warn(`🔒 ${event}:`, JSON.stringify(logData, null, 2));
      break;
    
    case 'authentication_error':
    case 'middleware_error':
    case 'auth_fallback_triggered':
      console.error(`❌ ${event}:`, JSON.stringify(logData, null, 2));
      break;
    
    case 'graceful_degradation_access_denied':
    case 'graceful_degradation_public_access':
    case 'graceful_degradation_error':
      console.log(`🚀 ${event}:`, JSON.stringify(logData, null, 2));
      break;
    
    default:
      console.log(`🔐 ${event}:`, JSON.stringify(logData, null, 2));
  }
}

/**
 * Create a secure cookie configuration
 * @param {boolean} isProduction - Whether in production environment
 * @returns {Object} Cookie configuration
 */
function createSecureCookieConfig(isProduction = false) {
  return {
    httpOnly: true,
    secure: isProduction, // Only use secure cookies in production
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  };
}

/**
 * Sanitize user data for client-side consumption
 * @param {Object} user - User object
 * @returns {Object} Sanitized user data
 */
function sanitizeUserData(user) {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    emailVerified: user.emailVerified || false,
    isAuthenticated: true,
  };
}

/**
 * Check if user has required permissions
 * @param {Object} user - User object
 * @param {Array} requiredRoles - Array of required roles
 * @returns {boolean} True if user has required permissions
 */
function hasRequiredPermissions(user, requiredRoles = []) {
  if (!user || !requiredRoles.length) {
    return true;
  }

  const userRoles = user.customClaims?.roles || [];
  return requiredRoles.some(role => userRoles.includes(role));
}

/**
 * Generate a secure random token
 * @param {number} length - Token length
 * @returns {string} Random token
 */
function generateSecureToken(length = 32) {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid email
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Rate limiting helper - check if IP is rate limited
 * @param {string} ip - Client IP address
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} True if rate limited
 */
function isRateLimited(ip, maxRequests = 100, windowMs = 15 * 60 * 1000) {
  // This is a simple in-memory rate limiter
  // In production, you might want to use Redis or another persistent store
  
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Get or create entry for this IP
  let ipData = global.rateLimitStore.get(ip) || { requests: [], firstRequest: now };
  
  // Remove old requests outside the window
  ipData.requests = ipData.requests.filter(timestamp => timestamp > windowStart);
  
  // Check if rate limited
  if (ipData.requests.length >= maxRequests) {
    return true;
  }
  
  // Add current request
  ipData.requests.push(now);
  global.rateLimitStore.set(ip, ipData);
  
  return false;
}

module.exports = {
  extractAuthToken,
  createAuthContext,
  setUserHeaders,
  isBrowserRequest,
  isApiRequest,
  logAuthEvent,
  createSecureCookieConfig,
  sanitizeUserData,
  hasRequiredPermissions,
  generateSecureToken,
  isValidEmail,
  isRateLimited,
};
