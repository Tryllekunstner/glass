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
   * @returns {Promise<void>} Promise that resolves when initialization completes
   */
  async initialize() {
    if (this.initialized) {
      return Promise.resolve();
    }

    // Check if we should skip initialization for fast startup
    // Always defer in Cloud Run/production environments for faster startup
    const isCloudRun = this.isAppHostingEnvironment();
    const isProduction = process.env.NODE_ENV === 'production';
    const shouldDefer = process.env.SKIP_AUTH_INIT === 'true' || 
                       process.env.FAST_STARTUP_ENABLED === 'true' ||
                       isCloudRun || 
                       isProduction;
    
    if (shouldDefer) {
      console.log('🚀 Fast startup mode: Deferring Firebase Admin SDK initialization');
      console.log(`  Reason: ${isCloudRun ? 'Cloud Run' : isProduction ? 'Production' : 'Environment Variable'}`);
      return Promise.resolve();
    }

    try {
      // Enhanced environment diagnostics
      console.log('🔍 Firebase Admin SDK initialization diagnostics:');
      console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`  FIREBASE_APP_HOSTING: ${process.env.FIREBASE_APP_HOSTING}`);
      console.log(`  GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT}`);
      console.log(`  GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT}`);
      console.log(`  K_SERVICE: ${process.env.K_SERVICE}`);
      console.log(`  FIREBASE_CONFIG available: ${!!process.env.FIREBASE_CONFIG}`);
      console.log(`  FIREBASE_WEBAPP_CONFIG available: ${!!process.env.FIREBASE_WEBAPP_CONFIG}`);
      console.log(`  NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
      console.log(`  FIREBASE_SERVICE_ACCOUNT_KEY available: ${!!process.env.FIREBASE_SERVICE_ACCOUNT_KEY}`);

      if (getApps().length === 0) {
        // Use the new config utility that supports Firebase JSON extraction
        let projectId;
        try {
          const { getFirebaseProjectId } = require('../../utils/config.ts');
          projectId = getFirebaseProjectId();
          console.log(`🔍 Project ID from config utility: ${projectId}`);
        } catch (configError) {
          console.error('❌ Error getting Firebase project ID from config utility:', configError);
          
          // Fallback to environment variables
          projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                     process.env.GOOGLE_CLOUD_PROJECT || 
                     process.env.GCLOUD_PROJECT;
          console.log(`🔍 Fallback project ID from env vars: ${projectId}`);
        }
        
        if (!projectId) {
          const errorMsg = 'Firebase project ID not found in any configuration source';
          console.error(`❌ ${errorMsg}`);
          console.error('   Checked sources:');
          console.error('   - getFirebaseProjectId() utility');
          console.error('   - NEXT_PUBLIC_FIREBASE_PROJECT_ID');
          console.error('   - GOOGLE_CLOUD_PROJECT');
          console.error('   - GCLOUD_PROJECT');
          console.error('   - FIREBASE_CONFIG JSON');
          console.error('   - FIREBASE_WEBAPP_CONFIG JSON');
          
          // Don't throw error, just mark as not initialized
          this.initialized = false;
          return Promise.resolve();
        }

        // Detect environment type
        const isAppHosting = this.isAppHostingEnvironment();
        const isLocalDev = process.env.NODE_ENV !== 'production';

        console.log(`🔧 Initializing Firebase Admin SDK (${isAppHosting ? 'App Hosting' : isLocalDev ? 'Local Dev' : 'Production'})`);
        console.log(`🔧 Using project ID: ${projectId}`);

        let initConfig = { projectId };

        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          // Use service account key for local development
          console.log('🔑 Using service account key for authentication');
          try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            console.log(`🔑 Service account project_id: ${serviceAccount.project_id}`);
            console.log(`🔑 Service account client_email: ${serviceAccount.client_email}`);
            initConfig.credential = cert(serviceAccount);
          } catch (parseError) {
            console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError);
            throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_KEY: ${parseError.message}`);
          }
        } else if (isAppHosting) {
          // Use default credentials in App Hosting (automatic service account)
          console.log('🏠 Using App Hosting default credentials (no explicit credential)');
          // Don't set credential - let Firebase use default service account
        } else {
          // Fallback for other production environments
          console.log('☁️  Using default application credentials');
          // Don't set credential - let Firebase use default application credentials
        }

        console.log('🔧 Calling initializeApp with config:', JSON.stringify({
          projectId: initConfig.projectId,
          hasCredential: !!initConfig.credential
        }, null, 2));

        initializeApp(initConfig);
        console.log('✅ Firebase app initialized successfully');
      } else {
        console.log('🔧 Firebase app already initialized, using existing instance');
      }

      console.log('🔧 Getting Firebase Auth instance...');
      this.adminAuth = getAuth();
      console.log('✅ Firebase Auth instance obtained');

      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
      
    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        stack: error.stack,
        name: error.name
      };
      
      console.error('❌ Failed to initialize Firebase Admin SDK - Detailed Error:', JSON.stringify(errorDetails, null, 2));
      
      // In App Hosting, we want to be more resilient to auth failures
      if (this.isAppHostingEnvironment()) {
        console.warn('⚠️  Continuing without Firebase Admin SDK in App Hosting environment');
        this.initialized = false; // Mark as not initialized but don't throw
        return Promise.resolve();
      }
      
      // Re-throw with more context
      const contextualError = new Error(`Firebase Admin SDK failed to initialize: ${error.message}`);
      contextualError.originalError = error;
      throw contextualError;
    }

    return Promise.resolve();
  }

  /**
   * Ensure Firebase Admin SDK is initialized (lazy initialization)
   * @returns {Promise<boolean>} True if initialized successfully
   */
  async ensureInitialized() {
    if (this.initialized) {
      return true;
    }

    try {
      await this.initialize();
      return this.initialized;
    } catch (error) {
      console.error('❌ Failed to ensure Firebase Admin SDK initialization:', error);
      return false;
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
    if (!token || typeof token !== 'string') {
      return null;
    }

    // Ensure Firebase Admin SDK is initialized
    const isInitialized = await this.ensureInitialized();
    if (!isInitialized || !this.adminAuth) {
      console.warn('🔒 Firebase Admin SDK not available for token verification');
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
    if (!uid || typeof uid !== 'string') {
      return null;
    }

    // Ensure Firebase Admin SDK is initialized
    const isInitialized = await this.ensureInitialized();
    if (!isInitialized || !this.adminAuth) {
      console.warn('🔒 Firebase Admin SDK not available for user lookup');
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

      // For fast startup mode, return true immediately if not yet initialized
      if (process.env.FAST_STARTUP_ENABLED === 'true' && !this.initialized) {
        console.log('🚀 Fast startup mode: Firebase Admin SDK initializing in background');
        return true;
      }

      // Ensure Firebase Admin SDK is initialized
      const isInitialized = await this.ensureInitialized();
      if (!isInitialized || !this.adminAuth) {
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
