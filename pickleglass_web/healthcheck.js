#!/usr/bin/env node

/**
 * Dedicated health check script for Cloud Run deployment
 * This script provides a comprehensive health check for the Next.js application
 */

const http = require('http');

const PORT = process.env.PORT || 8080;
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const TIMEOUT = 10000; // 10 seconds timeout

/**
 * Performs a health check by making an HTTP request to the health endpoint
 * @returns {Promise<boolean>} True if healthy, false otherwise
 */
function performHealthCheck() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/health',
      method: 'GET',
      timeout: TIMEOUT,
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const isHealthy = res.statusCode === 200 && response.status === 'ok';
          
          if (isHealthy) {
            console.log(`✅ Health check passed: ${response.status} at ${response.timestamp}`);
            resolve(true);
          } else {
            console.error(`❌ Health check failed: Status ${res.statusCode}, Response: ${data}`);
            resolve(false);
          }
        } catch (error) {
          console.error(`❌ Health check failed: Invalid JSON response: ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Health check failed: ${error.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.error(`❌ Health check failed: Request timeout after ${TIMEOUT}ms`);
      req.destroy();
      resolve(false);
    });

    req.setTimeout(TIMEOUT);
    req.end();
  });
}

/**
 * Validates the environment configuration
 * @returns {boolean} True if environment is valid
 */
function validateEnvironment() {
  console.log('=== Environment Validation ===');
  console.log(`PORT: ${PORT}`);
  console.log(`HOSTNAME: ${HOSTNAME}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

  // Check if port is valid
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    console.error(`❌ Invalid PORT: ${PORT}`);
    return false;
  }

  // Check if we're in Cloud Run
  if (process.env.K_SERVICE) {
    console.log(`🌐 Cloud Run detected: ${process.env.K_SERVICE}`);
    console.log(`📦 Revision: ${process.env.K_REVISION || 'unknown'}`);
  }

  return true;
}

/**
 * Main health check function
 */
async function main() {
  console.log('=== Next.js Application Health Check ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Validate environment first
  if (!validateEnvironment()) {
    process.exit(1);
  }

  // Perform health check
  const isHealthy = await performHealthCheck();
  
  if (isHealthy) {
    console.log('✅ Application is healthy');
    process.exit(0);
  } else {
    console.error('❌ Application is unhealthy');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`❌ Uncaught exception during health check: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`❌ Unhandled rejection during health check: ${reason}`);
  process.exit(1);
});

// Run the health check if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { performHealthCheck, validateEnvironment };
