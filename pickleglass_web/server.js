const express = require('express');
const next = require('next');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');

// Import authentication middleware
const { authenticateRequest, healthCheck } = require('./server/middleware/auth');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces for Cloud Run
const port = parseInt(process.env.PORT, 10) || 8080;

console.log('=== Next.js Server with Authentication Startup ===');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT}`);
console.log(`Development mode: ${dev}`);
console.log(`Target hostname: ${hostname}`);
console.log(`Target port: ${port}`);

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
    console.log(`[${new Date().toISOString()}] Starting Next.js server with authentication...`);
    
    // Run startup health checks
    const { runStartupValidation } = require('./server/utils/startup-health');
    const healthResults = await runStartupValidation();
    
    if (!healthResults.healthy) {
      console.warn('⚠️  Some startup checks failed, but continuing with server startup...');
    }
    
    // Prepare the Next.js app with timeout
    const timeoutMs = parseInt(process.env.STARTUP_TIMEOUT, 10) || 60000;
    const prepareTimeout = setTimeout(() => {
      console.error(`Next.js app preparation timed out after ${timeoutMs}ms`);
      process.exit(1);
    }, timeoutMs);
    
    await app.prepare();
    clearTimeout(prepareTimeout);
    
    const prepareTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Next.js app prepared successfully in ${prepareTime}ms`);

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
    server.get('/health', healthCheck);
    server.get('/healthz', healthCheck);
    server.get('/status', healthCheck);

    // Basic server info endpoint
    server.get('/server-info', (req, res) => {
      res.json({
        service: 'pickleglass-web',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        authentication: 'enabled',
      });
    });

    // Authentication middleware (this is the key integration)
    server.use(authenticateRequest);

    // Handle all other requests with Next.js
    server.use((req, res) => {
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
