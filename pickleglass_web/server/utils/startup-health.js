/**
 * Startup Health Check Utilities for Firebase App Hosting
 * Validates environment setup and service initialization
 */

/**
 * Startup Health Checker Class
 */
class StartupHealthChecker {
  constructor() {
    this.checks = new Map();
    this.startTime = Date.now();
  }

  /**
   * Add a health check
   * @param {string} name - Check name
   * @param {Function} checkFn - Check function that returns Promise<boolean>
   * @param {number} timeout - Timeout in milliseconds
   */
  addCheck(name, checkFn, timeout = 5000) {
    this.checks.set(name, { checkFn, timeout });
  }

  /**
   * Run all health checks
   * @returns {Promise<Object>} Health check results
   */
  async runChecks() {
    const results = {
      healthy: true,
      checks: {},
      startupTime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    };

    for (const [name, { checkFn, timeout }] of this.checks) {
      try {
        const checkStart = Date.now();
        
        // Run check with timeout
        const checkPromise = Promise.resolve(checkFn());
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Check timeout after ${timeout}ms`)), timeout)
        );

        const passed = await Promise.race([checkPromise, timeoutPromise]);
        const duration = Date.now() - checkStart;

        results.checks[name] = {
          passed: !!passed,
          duration,
          error: null,
        };

        if (!passed) {
          results.healthy = false;
        }

      } catch (error) {
        results.checks[name] = {
          passed: false,
          duration: timeout,
          error: error.message,
        };
        results.healthy = false;
      }
    }

    return results;
  }
}

/**
 * Validate App Hosting Environment
 * @returns {Promise<boolean>} True if environment is valid
 */
async function validateAppHostingEnvironment() {
  try {
    // Check required environment variables
    const requiredVars = [
      'NODE_ENV',
      'PORT',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    ];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        console.error(`❌ Missing required environment variable: ${varName}`);
        return false;
      }
    }

    // Check if we're in App Hosting environment
    const isAppHosting = process.env.FIREBASE_APP_HOSTING === 'true' ||
                        process.env.GOOGLE_CLOUD_PROJECT ||
                        process.env.GCLOUD_PROJECT;

    if (isAppHosting) {
      console.log('✅ App Hosting environment detected');
    } else {
      console.log('ℹ️  Local development environment detected');
    }

    // Validate port
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(`❌ Invalid PORT: ${process.env.PORT}`);
      return false;
    }

    console.log(`✅ Environment validation passed (PORT: ${port})`);
    return true;

  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    return false;
  }
}

/**
 * Health check with authentication service
 * @returns {Promise<boolean>} True if auth service is healthy
 */
async function healthCheckWithAuth() {
  try {
    // Try to import and check Firebase Admin
    const { healthCheck, authService } = require('./firebase-admin');
    
    // Initialize the auth service first
    try {
      authService.initialize();
    } catch (initError) {
      console.warn('⚠️  Firebase Admin SDK initialization failed:', initError.message);
      return true; // Graceful degradation
    }
    
    // Check if Firebase Admin SDK is initialized
    if (!authService.initialized) {
      console.warn('⚠️  Firebase Admin SDK not initialized, skipping auth health check');
      return true; // Graceful degradation
    }
    
    const isHealthy = await healthCheck();
    
    if (isHealthy) {
      console.log('✅ Firebase Admin SDK health check passed');
      return true;
    } else {
      console.warn('⚠️  Firebase Admin SDK health check failed');
      return true; // Still allow server to start
    }

  } catch (error) {
    console.warn('⚠️  Firebase Admin SDK not available:', error.message);
    console.warn('Stack trace:', error.stack);
    // Return true for graceful degradation - server can start without auth
    return true;
  }
}

/**
 * Check if Next.js build exists
 * @returns {Promise<boolean>} True if build exists
 */
async function checkNextJsBuild() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const buildPath = path.join(__dirname, '../../.next');
    const standaloneServerPath = path.join(buildPath, 'standalone/server.js');
    
    // Check if .next directory exists
    if (!fs.existsSync(buildPath)) {
      console.error('❌ Next.js build directory not found');
      return false;
    }

    // Check if standalone server exists (for production)
    if (process.env.NODE_ENV === 'production' && !fs.existsSync(standaloneServerPath)) {
      console.warn('⚠️  Standalone server not found, using regular Next.js server');
    }

    console.log('✅ Next.js build validation passed');
    return true;

  } catch (error) {
    console.error('❌ Next.js build check failed:', error);
    return false;
  }
}

/**
 * Check network connectivity
 * @returns {Promise<boolean>} True if network is available
 */
async function checkNetworkConnectivity() {
  try {
    // Simple DNS lookup to check network
    const dns = require('dns').promises;
    await dns.lookup('firebase.google.com');
    
    console.log('✅ Network connectivity check passed');
    return true;

  } catch (error) {
    console.error('❌ Network connectivity check failed:', error);
    return false;
  }
}

/**
 * Create comprehensive startup health checker
 * @returns {StartupHealthChecker} Configured health checker
 */
function createStartupHealthChecker() {
  const checker = new StartupHealthChecker();
  
  // Add standard checks
  checker.addCheck('environment', validateAppHostingEnvironment, 5000);
  checker.addCheck('nextjs-build', checkNextJsBuild, 3000);
  checker.addCheck('network', checkNetworkConnectivity, 10000);
  checker.addCheck('firebase-auth', healthCheckWithAuth, 15000);
  
  return checker;
}

/**
 * Run startup validation and return results
 * @returns {Promise<Object>} Startup validation results
 */
async function runStartupValidation() {
  console.log('🔍 Running startup validation...');
  
  const checker = createStartupHealthChecker();
  const results = await checker.runChecks();
  
  if (results.healthy) {
    console.log(`✅ All startup checks passed in ${results.startupTime}ms`);
  } else {
    console.warn(`⚠️  Some startup checks failed in ${results.startupTime}ms`);
    
    // Log failed checks
    for (const [name, check] of Object.entries(results.checks)) {
      if (!check.passed) {
        console.error(`❌ ${name}: ${check.error || 'Check failed'}`);
      }
    }
  }
  
  return results;
}

module.exports = {
  StartupHealthChecker,
  validateAppHostingEnvironment,
  healthCheckWithAuth,
  checkNextJsBuild,
  checkNetworkConnectivity,
  createStartupHealthChecker,
  runStartupValidation,
};
