const express = require('express');
const next = require('next');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');

// Import fast startup utilities
const { enableFastStartup, createOptimizedServerConfig } = require('./server/utils/fast-startup');
const { createAsyncInitManager } = require('./server/utils/async-init-manager');
const { createCloudRunHealthResponse } = require('./server/utils/startup-health');

// Enable fast startup and get configuration
const fastStartupManager = enableFastStartup();
const serverConfig = createOptimizedServerConfig();

// Create async initialization manager
const initManager = createAsyncInitManager();

// Import authentication middleware with error handling
let authenticateRequest, healthCheck;
try {
  const authMiddleware = require('./server/middleware/auth');
  authenticateRequest = authMiddleware.authenticateRequest;
  healthCheck = authMiddleware.healthCheck;
  console.log('✅ Authentication middleware loaded successfully');
} catch (error) {
  console.error('❌ Failed to load authentication middleware:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Create fallback middleware
  authenticateRequest = (req, res, next) => {
    console.warn('⚠️  Using fallback authentication middleware');
    req.auth = { user: null, isAuthenticated: false, fallback: true };
    req.user = null;
    next();
  };
  
  healthCheck = (req, res) => {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'authentication',
      error: 'Authentication middleware failed to load',
    });
  };
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = serverConfig.hostname;
const port = serverConfig.port;

console.log('=== Next.js Server with Fast Startup ===');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT}`);
console.log(`Development mode: ${dev}`);
console.log(`Target hostname: ${hostname}`);
console.log(`Target port: ${port}`);
console.log(`Fast startup: ${serverConfig.startup.isFastStartupEnabled ? 'ENABLED' : 'DISABLED'}`);
console.log(`Cloud Run: ${serverConfig.startup.isCloudRun ? 'YES' : 'NO'}`);

// Create Next.js app
const app = next({ 
  dev, 
  hostname, 
  port,
  // Disable file watching in production for better performance
  conf: dev ? {} : { 
    // Ensure we're in the correct directory
    dir: __dirname
  }
});
const handle = app.getRequestHandler();

async function startServer() {
  const startTime = Date.now();
  
  try {
    console.log(`[${new Date().toISOString()}] Starting Next.js server with fast startup...`);
    
    // Start background initialization immediately (non-blocking)
    if (serverConfig.startup.isFastStartupEnabled) {
      console.log('🚀 Fast startup mode: Starting background service initialization');
      initManager.startInitialization().catch(error => {
        console.error('❌ Background initialization failed:', error);
      });
    }
    
    // Handle startup validation based on configuration
    if (!serverConfig.startup.skipHealthChecks && process.env.NODE_ENV !== 'production') {
      try {
        const { runStartupValidation } = require('./server/utils/startup-health');
        const healthResults = await runStartupValidation();
        
        if (!healthResults.healthy) {
          console.warn('⚠️  Some startup checks failed, but continuing with server startup...');
        }
      } catch (healthError) {
        console.error('❌ Startup health checks failed:', healthError.message);
        console.warn('⚠️  Continuing with server startup despite health check failures...');
      }
    } else {
      console.log('🚀 Fast startup mode: Skipping blocking startup health checks');
    }
    
    // Prepare the Next.js app with optimized timeout
    const timeoutMs = serverConfig.startup.maxStartupTime || 30000;
    const prepareTimeout = setTimeout(() => {
      console.error(`❌ Next.js app preparation timed out after ${timeoutMs}ms`);
      if (serverConfig.startup.isCloudRun) {
        console.error('💡 Cloud Run detected - consider optimizing Next.js build or increasing timeout');
      }
      process.exit(1);
    }, timeoutMs);
    
    console.log(`[${new Date().toISOString()}] Preparing Next.js app (timeout: ${timeoutMs}ms)...`);
    await app.prepare();
    clearTimeout(prepareTimeout);
    
    const prepareTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ✅ Next.js app prepared successfully in ${prepareTime}ms`);

    // Create Express server
    const server = express();

    // Security middleware
    server.use(helmet({
      contentSecurityPolicy: false, // Let Next.js handle CSP
      crossOriginEmbedderPolicy: false, // Avoid issues with Next.js
    }));

    // Compression middleware
    server.use(compression());

    // Cookie parser middleware (required for authentication)
    server.use(cookieParser());

    // Trust proxy for proper IP detection behind load balancers
    server.set('trust proxy', 1);

    // Request logging middleware
    server.use((req, res, next) => {
      const start = Date.now();
      
      // Log request
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${req.ip}`);
      
      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
      });
      
      next();
    });

    // Health check endpoints (before authentication)
    // Use optimized health checks for fast startup
    if (serverConfig.startup.immediateHealthResponse) {
      console.log('🚀 Fast startup mode: Using immediate health check responses');
      
      const immediateHealthCheck = (req, res) => {
        const response = createCloudRunHealthResponse(initManager);
        res.status(200).json(response);
      };
      
      server.get('/health', immediateHealthCheck);
      server.get('/healthz', immediateHealthCheck);
      server.get('/status', immediateHealthCheck);
      
      // Add detailed status endpoint for debugging
      server.get('/status/detailed', (req, res) => {
        const status = initManager.getStatus();
        res.json({
          ...createCloudRunHealthResponse(initManager),
          detailed: status,
          fastStartup: serverConfig.startup,
        });
      });
    } else {
      server.get('/health', healthCheck);
      server.get('/healthz', healthCheck);
      server.get('/status', healthCheck);
    }

    // Basic server info endpoint
    server.get('/server-info', (req, res) => {
      res.json({
        service: 'pickleglass-web',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        authentication: 'enabled',
        fastStartup: serverConfig.startup.isFastStartupEnabled,
        cloudRun: serverConfig.startup.isCloudRun,
      });
    });

    // Firebase configuration diagnostic endpoint
    server.get('/debug/firebase-config', (req, res) => {
      try {
        const diagnostics = {
          timestamp: new Date().toISOString(),
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            FIREBASE_APP_HOSTING: process.env.FIREBASE_APP_HOSTING,
            GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
            GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
            K_SERVICE: process.env.K_SERVICE,
            NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          },
          configSources: {
            FIREBASE_CONFIG_available: !!process.env.FIREBASE_CONFIG,
            FIREBASE_WEBAPP_CONFIG_available: !!process.env.FIREBASE_WEBAPP_CONFIG,
            FIREBASE_SERVICE_ACCOUNT_KEY_available: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
          },
          firebaseConfig: null,
          projectId: null,
          error: null,
        };

        // Try to get Firebase project ID
        try {
          const { getFirebaseProjectId } = require('./utils/config.ts');
          diagnostics.projectId = getFirebaseProjectId();
        } catch (configError) {
          diagnostics.error = `Config utility error: ${configError.message}`;
          
          // Fallback to environment variables
          diagnostics.projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                                 process.env.GOOGLE_CLOUD_PROJECT || 
                                 process.env.GCLOUD_PROJECT;
        }

        // Try to parse Firebase config if available
        if (process.env.FIREBASE_CONFIG) {
          try {
            const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
            diagnostics.firebaseConfig = {
              projectId: firebaseConfig.projectId,
              hasApiKey: !!firebaseConfig.apiKey,
              hasAuthDomain: !!firebaseConfig.authDomain,
              hasStorageBucket: !!firebaseConfig.storageBucket,
              hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
              hasAppId: !!firebaseConfig.appId,
            };
          } catch (parseError) {
            diagnostics.error = `FIREBASE_CONFIG parse error: ${parseError.message}`;
          }
        }

        // Check Firebase Admin SDK status
        const { authService } = require('./server/utils/firebase-admin');
        diagnostics.firebaseAdmin = {
          initialized: authService.initialized,
          isAppHostingEnvironment: authService.isAppHostingEnvironment(),
        };

        // Check initialization manager status
        diagnostics.initializationManager = initManager.getStatus();

        res.json(diagnostics);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to generate Firebase diagnostics',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Authentication middleware (this is the key integration)
    server.use(authenticateRequest);

    // Handle all other requests with Next.js (using middleware approach)
    server.use((req, res, next) => {
      // Skip if response already sent
      if (res.headersSent) {
        return next();
      }
      
      // Let Next.js handle the request
      return handle(req, res);
    });

    // Error handling middleware
    server.use((err, req, res, next) => {
      console.error(`[${new Date().toISOString()}] Server error:`, err);
      
      if (res.headersSent) {
        return next(err);
      }

      // For API requests, return JSON error
      if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: dev ? err.message : 'Something went wrong',
          timestamp: new Date().toISOString(),
        });
      } else {
        // For browser requests, return HTML error
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Server Error</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .error { background: #f8f8f8; padding: 20px; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="error">
                <h1>Server Error</h1>
                <p>Something went wrong. Please try again later.</p>
                ${dev ? `<pre>${err.stack}</pre>` : ''}
              </div>
            </body>
          </html>
        `);
      }
    });

    // Start the Express server
    const expressServer = server.listen(port, hostname, () => {
      const totalTime = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] ✅ Server ready on http://${hostname}:${port}`);
      console.log(`[${new Date().toISOString()}] Total startup time: ${totalTime}ms`);
      console.log(`[${new Date().toISOString()}] Health check available at: http://${hostname}:${port}/health`);
      console.log(`[${new Date().toISOString()}] Server info available at: http://${hostname}:${port}/server-info`);
      console.log(`[${new Date().toISOString()}] 🔐 Server-side authentication enabled`);
    });

    // Handle server errors
    expressServer.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] Server error:`, err);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      }
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`[${new Date().toISOString()}] Received ${signal}. Shutting down gracefully...`);
      
      expressServer.close(() => {
        console.log(`[${new Date().toISOString()}] Express server closed`);
        
        // Close Next.js app
        app.close().then(() => {
          console.log(`[${new Date().toISOString()}] Next.js app closed`);
          process.exit(0);
        }).catch((err) => {
          console.error(`[${new Date().toISOString()}] Error closing Next.js app:`, err);
          process.exit(1);
        });
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error(`[${new Date().toISOString()}] Forced shutdown after timeout`);
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] ❌ Failed to start server after ${totalTime}ms:`, err);
    console.error('Stack trace:', err.stack);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
