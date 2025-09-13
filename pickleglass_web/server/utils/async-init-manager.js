/**
 * Async Initialization Manager for Cloud Run Fast Startup
 * Manages background service initialization while allowing immediate server startup
 */

/**
 * Async Initialization Manager Class
 * Handles background initialization of services while server starts immediately
 */
class AsyncInitializationManager {
  constructor() {
    this.services = new Map();
    this.initialized = false;
    this.startTime = Date.now();
    this.initPromise = null;
  }

  /**
   * Register a service for async initialization
   * @param {string} name - Service name
   * @param {Function} initFn - Initialization function that returns Promise
   * @param {Object} options - Options for initialization
   */
  registerService(name, initFn, options = {}) {
    this.services.set(name, {
      initFn,
      initialized: false,
      error: null,
      startTime: null,
      endTime: null,
      timeout: options.timeout || 30000,
      required: options.required || false,
      retries: options.retries || 0,
      maxRetries: options.maxRetries || 2,
    });
  }

  /**
   * Start async initialization of all services
   * @returns {Promise<void>} Promise that resolves when initialization starts (not completes)
   */
  async startInitialization() {
    if (this.initPromise) {
      return this.initPromise;
    }

    console.log('🚀 Starting async service initialization...');
    
    this.initPromise = this.initializeServices();
    
    // Don't await - let it run in background
    this.initPromise.catch(error => {
      console.error('❌ Background initialization failed:', error);
    });

    return Promise.resolve(); // Return immediately
  }

  /**
   * Initialize all registered services in background
   * @private
   */
  async initializeServices() {
    const initPromises = [];

    for (const [name, service] of this.services) {
      const initPromise = this.initializeService(name, service);
      initPromises.push(initPromise);
    }

    try {
      await Promise.allSettled(initPromises);
      this.initialized = true;
      
      const totalTime = Date.now() - this.startTime;
      console.log(`✅ Background initialization completed in ${totalTime}ms`);
      
      // Log service status
      this.logServiceStatus();
      
    } catch (error) {
      console.error('❌ Background initialization error:', error);
    }
  }

  /**
   * Initialize a single service with retry logic
   * @private
   */
  async initializeService(name, service) {
    service.startTime = Date.now();
    
    while (service.retries <= service.maxRetries) {
      try {
        console.log(`🔧 Initializing ${name}...`);
        
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${name} initialization timeout`)), service.timeout)
        );

        // Race initialization against timeout
        await Promise.race([
          service.initFn(),
          timeoutPromise
        ]);

        service.initialized = true;
        service.endTime = Date.now();
        service.error = null;
        
        const duration = service.endTime - service.startTime;
        console.log(`✅ ${name} initialized successfully in ${duration}ms`);
        return;

      } catch (error) {
        service.retries++;
        service.error = error;
        
        const duration = Date.now() - service.startTime;
        console.error(`❌ ${name} initialization failed (attempt ${service.retries}/${service.maxRetries + 1}) after ${duration}ms:`, error.message);

        if (service.retries <= service.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, service.retries - 1), 5000); // Exponential backoff, max 5s
          console.log(`⏳ Retrying ${name} initialization in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    service.endTime = Date.now();
    const totalDuration = service.endTime - service.startTime;
    
    if (service.required) {
      console.error(`❌ Required service ${name} failed to initialize after ${totalDuration}ms`);
    } else {
      console.warn(`⚠️  Optional service ${name} failed to initialize after ${totalDuration}ms, continuing with degraded functionality`);
    }
  }

  /**
   * Check if a specific service is initialized
   * @param {string} name - Service name
   * @returns {boolean} True if service is initialized
   */
  isServiceInitialized(name) {
    const service = this.services.get(name);
    return service ? service.initialized : false;
  }

  /**
   * Check if all required services are initialized
   * @returns {boolean} True if all required services are ready
   */
  areRequiredServicesReady() {
    for (const [name, service] of this.services) {
      if (service.required && !service.initialized) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get current status of all services
   * @returns {Object} Status object with service details
   */
  getStatus() {
    const status = {
      initialized: this.initialized,
      startTime: this.startTime,
      totalTime: Date.now() - this.startTime,
      services: {},
    };

    for (const [name, service] of this.services) {
      status.services[name] = {
        initialized: service.initialized,
        required: service.required,
        error: service.error ? service.error.message : null,
        duration: service.endTime ? service.endTime - service.startTime : null,
        retries: service.retries,
      };
    }

    return status;
  }

  /**
   * Get health check response
   * @returns {Object} Health check response
   */
  getHealthStatus() {
    const requiredServicesReady = this.areRequiredServicesReady();
    const allServicesReady = this.initialized;
    
    let status = 'healthy';
    if (!requiredServicesReady) {
      status = 'degraded';
    }
    
    // Check if any required services have errors
    for (const [name, service] of this.services) {
      if (service.required && service.error && !service.initialized) {
        status = 'unhealthy';
        break;
      }
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        server: true, // Server is always ready if we're responding
        initialization: allServicesReady,
        required_services: requiredServicesReady,
      },
      details: this.getStatus(),
    };
  }

  /**
   * Wait for a specific service to be initialized
   * @param {string} name - Service name
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} True if service initialized within timeout
   */
  async waitForService(name, timeout = 10000) {
    const service = this.services.get(name);
    if (!service) {
      return false;
    }

    if (service.initialized) {
      return true;
    }

    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (service.initialized) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Log status of all services
   * @private
   */
  logServiceStatus() {
    console.log('\n=== Service Initialization Status ===');
    
    for (const [name, service] of this.services) {
      const status = service.initialized ? '✅' : '❌';
      const required = service.required ? '[REQUIRED]' : '[OPTIONAL]';
      const duration = service.endTime ? `${service.endTime - service.startTime}ms` : 'N/A';
      const retries = service.retries > 0 ? ` (${service.retries} retries)` : '';
      
      console.log(`${status} ${name} ${required} - ${duration}${retries}`);
      
      if (service.error && !service.initialized) {
        console.log(`   Error: ${service.error.message}`);
      }
    }
    
    console.log('=====================================\n');
  }
}

/**
 * Create and configure async initialization manager for the application
 * @returns {AsyncInitializationManager} Configured initialization manager
 */
function createAsyncInitManager() {
  const manager = new AsyncInitializationManager();
  
  // Register Firebase Admin SDK initialization
  manager.registerService('firebase-admin', async () => {
    const { authService } = require('./firebase-admin');
    await authService.initialize();
    
    // Verify initialization worked
    if (!authService.initialized) {
      throw new Error('Firebase Admin SDK failed to initialize');
    }
  }, {
    timeout: 15000,
    required: false, // Not required for server startup
    maxRetries: 2,
  });

  // Register health checks
  manager.registerService('health-checks', async () => {
    const { runStartupValidation } = require('./startup-health');
    const results = await runStartupValidation();
    
    if (!results.healthy) {
      console.warn('⚠️  Some health checks failed, but continuing...');
    }
  }, {
    timeout: 10000,
    required: false, // Not required for server startup
    maxRetries: 1,
  });

  // Register network connectivity check
  manager.registerService('network-check', async () => {
    const dns = require('dns').promises;
    await dns.lookup('firebase.google.com');
  }, {
    timeout: 5000,
    required: false,
    maxRetries: 2,
  });

  return manager;
}

module.exports = {
  AsyncInitializationManager,
  createAsyncInitManager,
};
