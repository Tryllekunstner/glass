const cookieParser = require('cookie-parser');

/**
 * Authentication helper functions for Express middleware
 * Handles cookie management, token extraction, and session utilities
 */

/**
 * Extract authentication token from request cookies or headers
 * @param {Object} req - Express request object
 * @returns {string|null} Authentication token or null if not found
 */
function extractAuthToken(req) {
  // First, try to get token from cookies (preferred method)
  if (req.cookies && req.cookies.authToken) {
    return req.cookies.authToken;
  }

  // Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check for custom header (for API calls)
  if (req.headers['x-auth-token']) {
    return req.headers['x-auth-token'];
  }

  return null;
}

/**
 * Set secure authentication cookie
 * @param {Object} res - Express response object
 * @param {string} token - Authentication token
 * @param {Object} options - Cookie options
 */
function setAuthCookie(res, token, options = {}) {
  const defaultOptions = {
    httpOnly: true, // Prevent XSS attacks
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    ...options,
  };

  res.cookie('authToken', token, defaultOptions);
}

/**
 * Clear authentication cookie
 * @param {Object} res - Express response object
 */
function clearAuthCookie(res) {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Set user session data in response headers (for client-side access)
 * @param {Object} res - Express response object
 * @param {Object} user - User data
 */
function setUserHeaders(res, user) {
  if (!user) {
    res.removeHeader('X-User-ID');
    res.removeHeader('X-User-Email');
    res.removeHeader('X-User-Verified');
    return;
  }

  // Set safe user data in headers (no sensitive information)
  res.setHeader('X-User-ID', user.uid || '');
  res.setHeader('X-User-Email', user.email || '');
  res.setHeader('X-User-Verified', user.emailVerified ? 'true' : 'false');
}

/**
 * Create authentication context for request
 * @param {Object} user - Verified user data
 * @param {string} token - Authentication token
 * @returns {Object} Authentication context
 */
function createAuthContext(user, token) {
  return {
    user: user ? {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
    } : null,
    isAuthenticated: !!user,
    token: token || null,
  };
}

/**
 * Check if request is from a browser (has HTML accept header)
 * @param {Object} req - Express request object
 * @returns {boolean} True if browser request
 */
function isBrowserRequest(req) {
  const acceptHeader = req.headers.accept || '';
  return acceptHeader.includes('text/html');
}

/**
 * Check if request is an API call
 * @param {Object} req - Express request object
 * @returns {boolean} True if API request
 */
function isApiRequest(req) {
  return req.path.startsWith('/api/') || 
         req.headers['content-type']?.includes('application/json') ||
         req.headers.accept?.includes('application/json');
}

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '0.0.0.0';
}

/**
 * Log authentication event for monitoring
 * @param {string} event - Event type (login, logout, access_denied, etc.)
 * @param {Object} req - Express request object
 * @param {Object} user - User data (optional)
 * @param {Object} extra - Extra data (optional)
 */
function logAuthEvent(event, req, user = null, extra = {}) {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    ip: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    path: req.path,
    method: req.method,
    userId: user?.uid || 'anonymous',
    userEmail: user?.email || 'unknown',
    ...extra,
  };

  // In production, you might want to send this to a logging service
  console.log(`🔐 Auth Event [${event}]:`, JSON.stringify(logData, null, 2));
}

/**
 * Session Management Class for server-side session handling
 */
class SessionManager {
  constructor() {
    this.sessions = new Map(); // In production, use Redis or database
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Create a new session
   * @param {string} userId - User ID
   * @param {Object} userData - User data
   * @param {number} expiresIn - Session duration in seconds
   * @returns {string} Session ID
   */
  createSession(userId, userData, expiresIn = 24 * 60 * 60) {
    const sessionId = this.generateSessionId();
    const expiresAt = Date.now() + (expiresIn * 1000);

    this.sessions.set(sessionId, {
      userId,
      userData,
      createdAt: Date.now(),
      expiresAt,
      lastAccessed: Date.now(),
    });

    return sessionId;
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data or null if not found/expired
   */
  getSession(sessionId) {
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last accessed time
    session.lastAccessed = Date.now();
    return session;
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID
   */
  deleteSession(sessionId) {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Generate a secure session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Cleanup expired sessions
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(
        session => Date.now() <= session.expiresAt
      ).length,
    };
  }

  /**
   * Destroy the session manager
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}

// Create singleton session manager
const sessionManager = new SessionManager();

module.exports = {
  extractAuthToken,
  setAuthCookie,
  clearAuthCookie,
  setUserHeaders,
  createAuthContext,
  isBrowserRequest,
  isApiRequest,
  getClientIP,
  logAuthEvent,
  SessionManager,
  sessionManager,
};
