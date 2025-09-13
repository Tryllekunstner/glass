/**
 * Fast Startup Utilities for Cloud Run Deployment
 * Optimizes server startup for Cloud Run environment constraints
 */

/**
 * Fast Startup Manager Class
 * Handles fast startup configuration and environment detection
 */
class FastStartupManager {
  constructor() {
    this.isCloudRun = this.detectCloudRunEnvironment();
    this.isFastStartupEnabled = this.shouldEnableFastStartup();
    this.config = this.createFastStartupConfig();
  }

  /**
   * Detect if running in Cloud Run environment
   * @returns {boolean} True if in Cloud Run
   */
  detectCloudRunEnvironment() {
    // Cloud Run specific environment variables
    const cloudRunIndicators = [
      process.env.K_SERVICE,           // Cloud Run service name
      process.env.K_REVISION,          // Cloud Run revision
      process.env.K_CONFIGURATION,     // Cloud Run configuration
      process.env.GOOGLE_CLOUD_PROJECT, // GCP project ID
      process.env.FIREBASE_APP_HOSTING, // Firebase App Hosting
    ];

    const hasCloudRunIndicators = cloudRunIndicators.some(indicator => !!indicator);
    
    // Additional checks for Cloud Run environment
    const isContainerized = process.env.PORT && process.env.NODE_ENV === 'production';
    const hasGoogleMetadata = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                             process.env.GCLOUD_PROJECT ||
                             process.env.GCP_PROJECT;

    return hasCloudRunIndicators || (isContainerized && hasGoogleMetadata);
  }

  /**
   * Determine if fast startup should be enabled
   * @returns {boolean} True if fast startup should be enabled
   */
  shouldEnableFastStartup() {
    // ALWAYS enable fast startup in Cloud Run environments
    // This is critical because Firebase App Hosting may not pass environment variables
    if (this.isCloudRun) {
      console.log('🚀 Cloud Run environment detected - FORCING fast startup mode');
      return true;
    }

    // Allow manual override
    if (process.env.FAST_STARTUP === 'true' || process.env.FAST_STARTUP_ENABLED === 'true') {
      return true;
    }

    // Enable in production environments
    if (process.env.NODE_ENV === 'production') {
      console.log('🚀 Production environment detected - enabling fast startup mode');
      return true;
    }

    // Enable in production environments with tight startup constraints
    if (process.env.NODE_ENV === 'production' && process.env.STARTUP_TIMEOUT) {
      const timeout = parseInt(process.env.STARTUP_TIMEOUT, 10);
      return timeout < 60000; // Less than 60 seconds
    }

    return false;
  }

  /**
   * Create fast startup configuration
   * @returns {Object} Fast startup configuration
   */
  createFastStartupConfig() {
    const baseConfig = {
      skipHealthChecks: false,
      skipAuthInit: false,
      skipNetworkChecks: false,
      deferNonCritical: false,
      immediateHealthResponse: false,
      maxStartupTime: 30000, // 30 seconds default
    };

    if (!this.isFastStartupEnabled) {
      return baseConfig;
    }

    // Fast startup configuration for Cloud Run
    const fastConfig = {
      skipHealthChecks: true,           // Skip blocking health checks
      skipAuthInit: true,               // Defer auth initialization
      skipNetworkChecks: true,          // Skip network connectivity checks
      deferNonCritical: true,           // Defer all non-critical initialization
      immediateHealthResponse: true,    // Return immediate health responses
      maxStartupTime: this.isCloudRun ? 15000 : 20000, // Aggressive timeout
    };

    // Allow environment variable overrides
    return {
      skipHealthChecks: process.env.SKIP_STARTUP_HEALTH_CHECKS === 'true' || fastConfig.skipHealthChecks,
      skipAuthInit: process.env.SKIP_AUTH_INIT === 'true' || fastConfig.skipAuthInit,
      skipNetworkChecks: process.env.SKIP_NETWORK_CHECKS === 'true' || fastConfig.skipNetworkChecks,
      deferNonCritical: process.env.DEFER_NON_CRITICAL === 'true' || fastConfig.deferNonCritical,
      immediateHealthResponse: process.env.IMMEDIATE_HEALTH_RESPONSE === 'true' || fastConfig.immediateHealthResponse,
      maxStartupTime: parseInt(process.env.MAX_STARTUP_TIME, 10) || fastConfig.maxStartupTime,
    };
  }

  /**
   * Get startup configuration
   * @returns {Object} Startup configuration object
   */
  getConfig() {
    return {
      isCloudRun: this.isCloudRun,
      isFastStartupEnabled: this.isFastStartupEnabled,
      ...this.config,
    };
  }

  /**
   * Log startup configuration
   */
  logConfig() {
    console.log('\n=== Fast Startup Configuration ===');
    console.log(`Environment: ${this.isCloudRun ? 'Cloud Run' : 'Other'}`);
    console.log(`Fast Startup: ${this.isFastStartupEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (this.isFastStartupEnabled) {
      console.log(`Skip Health Checks: ${this.config.skipHealthChecks}`);
      console.log(`Skip Auth Init: ${this.config.skipAuthInit}`);
      console.log(`Skip Network Checks: ${this.config.skipNetworkChecks}`);
      console.log(`Defer Non-Critical: ${this.config.deferNonCritical}`);
      console.log(`Immediate Health Response: ${this.config.immediateHealthResponse}`);
      console.log(`Max Startup Time: ${this.config.maxStartupTime}ms`);
    }
    console.log('==================================\n');
  }

  /**
   * Create immediate health check response for fast startup
   * @returns {Object} Immediate health response
   */
  createImmediateHealthResponse() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mode: 'fast_startup',
      services: {
        server: true,
        nextjs: true,
        auth: 'initializing',
        firebase: 'initializing',
      },
      message: 'Server started successfully, background services initializing',
      environment: this.isCloudRun ? 'cloud_run' : 'other',
    };
  }

  /**
   * Create startup timeout handler
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Function} Timeout handler function
   */
  createStartupTimeoutHandler(timeout = null) {
    const actualTimeout = timeout || this.config.maxStartupTime;
    
    return (callback) => {
      const timeoutId = setTimeout(() => {
        console.error(`❌ Server startup timed out after ${actualTimeout}ms`);
        console.error('This may indicate a problem with the startup sequence');
        
        if (this.isCloudRun) {
          console.error('Cloud Run requires fast startup - consider enabling more aggressive optimizations');
        }
        
        if (callback) {
          callback(new Error(`Startup timeout after ${actualTimeout}ms`));
        } else {
          process.exit(1);
        }
      }, actualTimeout);

      return () => clearTimeout(timeoutId);
    };
  }

  /**
   * Optimize Next.js configuration for fast startup
   * @returns {Object} Optimized Next.js configuration
   */
  getOptimizedNextConfig() {
    const baseConfig = {
      dev: process.env.NODE_ENV !== 'production',
      hostname: '0.0.0.0',
      port: parseInt(process.env.PORT, 10) || 8080,
    };

    if (!this.isFastStartupEnabled) {
      return baseConfig;
    }

    // Fast startup optimizations
    return {
      ...baseConfig,
      conf: {
        // Disable file watching in production
        useFileSystemPublicRoutes: true,
        // Optimize for faster startup
        experimental: {
          // Reduce memory usage during startup
          workerThreads: false,
          // Faster builds
          swcMinify: true,
        },
        // Reduce startup overhead
        poweredByHeader: false,
        // Optimize images for faster loading
        images: {
          unoptimized: true, // Skip image optimization during startup
        },
      },
    };
  }

  /**
   * Get environment-specific middleware configuration
   * @returns {Object} Middleware configuration
   */
  getMiddlewareConfig() {
    return {
      // Security middleware
      helmet: {
        contentSecurityPolicy: false, // Let Next.js handle CSP
        crossOriginEmbedderPolicy: false,
      },
      
      // Compression
      compression: this.isFastStartupEnabled ? { level: 1 } : {}, // Faster compression
      
      // Rate limiting
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: this.isCloudRun ? 200 : 100, // Higher limit for Cloud Run
        standardHeaders: true,
        legacyHeaders: false,
      },
      
      // Request logging
      logging: {
        enabled: !this.isFastStartupEnabled, // Reduce logging overhead in fast startup
        level: this.isCloudRun ? 'warn' : 'info',
      },
    };
  }
}

/**
 * Enable fast startup mode for the application
 * @returns {FastStartupManager} Configured fast startup manager
 */
function enableFastStartup() {
  const manager = new FastStartupManager();
  
  // Log configuration
  manager.logConfig();
  
  // Set environment variables for other parts of the application
  if (manager.isFastStartupEnabled) {
    process.env.FAST_STARTUP_ENABLED = 'true';
    process.env.SKIP_BLOCKING_INIT = 'true';
    
    if (manager.config.immediateHealthResponse) {
      process.env.IMMEDIATE_HEALTH_RESPONSE = 'true';
    }
  }
  
  return manager;
}

/**
 * Check if fast startup is enabled
 * @returns {boolean} True if fast startup is enabled
 */
function isFastStartupEnabled() {
  return process.env.FAST_STARTUP_ENABLED === 'true' || 
         process.env.FAST_STARTUP === 'true';
}

/**
 * Get fast startup configuration
 * @returns {Object} Fast startup configuration
 */
function getFastStartupConfig() {
  const manager = new FastStartupManager();
  return manager.getConfig();
}

/**
 * Create optimized Express server configuration for fast startup
 * @returns {Object} Express server configuration
 */
function createOptimizedServerConfig() {
  const manager = new FastStartupManager();
  
  return {
    // Server configuration
    hostname: '0.0.0.0',
    port: parseInt(process.env.PORT, 10) || 8080,
    
    // Trust proxy settings for Cloud Run
    trustProxy: manager.isCloudRun ? 1 : false,
    
    // Middleware configuration
    middleware: manager.getMiddlewareConfig(),
    
    // Next.js configuration
    nextjs: manager.getOptimizedNextConfig(),
    
    // Startup configuration
    startup: manager.getConfig(),
  };
}

module.exports = {
  FastStartupManager,
  enableFastStartup,
  isFastStartupEnabled,
  getFastStartupConfig,
  createOptimizedServerConfig,
};
