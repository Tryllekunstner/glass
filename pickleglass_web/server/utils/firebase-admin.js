const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

/**
 * Authentication Service for server-side Firebase Admin SDK operations
 * Handles token verification and user management for Express middleware
 */
class AuthenticationService {
  constructor() {
    this.adminAuth = null;
    this.initialized = false;
  }

  /**
   * Initialize Firebase Admin SDK (lazy initialization with App Hosting support)
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      if (getApps().length === 0) {
        // Use the new config utility that supports Firebase JSON extraction
        const { getFirebaseProjectId } = require('../../utils/config.ts');
        const projectId = getFirebaseProjectId();
        
        if (!projectId) {
          console.warn('⚠️  Firebase project ID not found in environment variables or Firebase JSON config');
          console.warn('⚠️  Firebase Admin SDK will not be initialized');
          this.initialized = false;
          return;
        }

        // Detect environment type
        const isAppHosting = this.isAppHostingEnvironment();
        const isLocalDev = process.env.NODE_ENV !== 'production';

        console.log(`🔧 Initializing Firebase Admin SDK (${isAppHosting ? 'App Hosting' : isLocalDev ? 'Local Dev' : 'Production'})`);

        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          // Use service account key for local development
          console.log('🔑 Using service account key for authentication');
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          initializeApp({
            credential: cert(serviceAccount),
            projectId,
          });
        } else if (isAppHosting) {
          // Use default credentials in App Hosting (automatic service account)
          console.log('🏠 Using App Hosting default credentials');
          initializeApp({
            projectId,
          });
        } else {
          // Fallback for other production environments
          console.log('☁️  Using default application credentials');
          initializeApp({
            projectId,
          });
        }
      }

      this.adminAuth = getAuth();
      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin SDK:', error);
      
      // In App Hosting, we want to be more resilient to auth failures
      if (this.isAppHostingEnvironment()) {
        console.warn('⚠️  Continuing without Firebase Admin SDK in App Hosting environment');
        this.initialized = false; // Mark as not initialized but don't throw
        return;
      }
      
      throw error;
    }
  }

  /**
   * Check if running in Firebase App Hosting environment
   * @returns {boolean} True if in App Hosting
   */
  isAppHostingEnvironment() {
    return process.env.FIREBASE_APP_HOSTING === 'true' ||
           process.env.GOOGLE_CLOUD_PROJECT ||
           process.env.GCLOUD_PROJECT ||
           process.env.K_SERVICE; // Cloud Run service indicator
  }

  /**
   * Verify a Firebase ID token and return user information
   * @param {string} token - Firebase ID token from client
   * @returns {Promise<Object|null>} Verified user information or null if invalid
   */
  async verifyToken(token) {
    this.initialize(); // Ensure Firebase Admin SDK is initialized
    
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const decodedToken = await this.adminAuth.verifyIdToken(token, true); // checkRevoked = true
      
      return {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        displayName: decodedToken.name,
        emailVerified: decodedToken.email_verified || false,
        authTime: decodedToken.auth_time,
        issuedAt: decodedToken.iat,
        expiresAt: decodedToken.exp,
      };
    } catch (error) {
      // Log different types of token errors for debugging
      if (error.code === 'auth/id-token-expired') {
        console.warn('🔒 Token expired for verification');
      } else if (error.code === 'auth/id-token-revoked') {
        console.warn('🔒 Token revoked for verification');
      } else if (error.code === 'auth/argument-error') {
        console.warn('🔒 Invalid token format');
      } else {
        console.error('🔒 Token verification error:', error.code || error.message);
      }
      return null;
    }
  }

  /**
   * Get user information by UID
   * @param {string} uid - User ID
   * @returns {Promise<Object|null>} User information or null if not found
   */
  async getUserByUid(uid) {
    this.initialize(); // Ensure Firebase Admin SDK is initialized
    
    if (!uid || typeof uid !== 'string') {
      return null;
    }

    try {
      const userRecord = await this.adminAuth.getUser(uid);
      
      return {
        uid: userRecord.uid,
        email: userRecord.email || '',
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
        },
      };
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.warn(`🔒 User not found: ${uid}`);
      } else {
        console.error('🔒 Error getting user by UID:', error.code || error.message);
      }
      return null;
    }
  }

  /**
   * Verify token and get user data in one call
   * @param {string} token - Firebase ID token
   * @returns {Promise<Object|null>} Combined token and user data or null
   */
  async verifyAndGetUser(token) {
    const verifiedToken = await this.verifyToken(token);
    if (!verifiedToken) {
      return null;
    }

    // Token verification already provides user data, but we can enhance it
    const userData = await this.getUserByUid(verifiedToken.uid);
    if (!userData) {
      return null;
    }

    return {
      ...verifiedToken,
      ...userData,
      isAuthenticated: true,
    };
  }

  /**
   * Check if token is close to expiration (within 5 minutes)
   * @param {Object} verifiedToken - Verified token data
   * @returns {boolean} True if token needs refresh
   */
  isTokenNearExpiry(verifiedToken) {
    if (!verifiedToken || !verifiedToken.expiresAt) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = verifiedToken.expiresAt - now;
    const fiveMinutes = 5 * 60;

    return timeUntilExpiry <= fiveMinutes;
  }

  /**
   * Health check for the authentication service
   * @returns {Promise<boolean>} True if service is healthy
   */
  async healthCheck() {
    try {
      // During build time, Firebase JSON env vars are not available, so we skip initialization
      if (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_CONFIG && !process.env.FIREBASE_WEBAPP_CONFIG) {
        console.log('🔧 Build time detected - skipping Firebase Admin health check');
        return true; // Return true during build time
      }

      this.initialize(); // Ensure Firebase Admin SDK is initialized
      
      if (!this.initialized || !this.adminAuth) {
        return false;
      }

      // Verify we can make a simple call to Firebase
      await this.adminAuth.listUsers(1);
      return true;
    } catch (error) {
      console.error('🔒 Authentication service health check failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const authService = new AuthenticationService();

module.exports = {
  AuthenticationService,
  authService,
  // Export individual functions for convenience
  verifyFirebaseToken: (token) => authService.verifyToken(token),
  getUserByUid: (uid) => authService.getUserByUid(uid),
  verifyAndGetUser: (token) => authService.verifyAndGetUser(token),
  isTokenNearExpiry: (verifiedToken) => authService.isTokenNearExpiry(verifiedToken),
  healthCheck: () => authService.healthCheck(),
};
