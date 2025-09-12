const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces for Cloud Run
const port = parseInt(process.env.PORT, 10) || 3000;

console.log('=== Next.js Server Startup ===');
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
    experimental: { 
      isrMemoryCacheSize: 0 
    } 
  }
});
const handle = app.getRequestHandler();

async function startServer() {
  const startTime = Date.now();
  
  try {
    console.log(`[${new Date().toISOString()}] Starting Next.js server...`);
    
    // Prepare the Next.js app with timeout
    const prepareTimeout = setTimeout(() => {
      console.error('Next.js app preparation timed out after 60 seconds');
      process.exit(1);
    }, 60000);
    
    await app.prepare();
    clearTimeout(prepareTimeout);
    
    const prepareTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Next.js app prepared successfully in ${prepareTime}ms`);

    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        // Add basic health check endpoint
        if (req.url === '/health' || req.url === '/healthz') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
          return;
        }
        
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error handling request ${req.url}:`, err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      }
    });

    // Handle server errors
    server.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] Server error:`, err);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      }
      process.exit(1);
    });

    // Start listening with promise wrapper for better error handling
    await new Promise((resolve, reject) => {
      server.listen(port, hostname, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    const totalTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ✅ Server ready on http://${hostname}:${port}`);
    console.log(`[${new Date().toISOString()}] Total startup time: ${totalTime}ms`);
    console.log(`[${new Date().toISOString()}] Health check available at: http://${hostname}:${port}/health`);

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`[${new Date().toISOString()}] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log(`[${new Date().toISOString()}] Server closed`);
        process.exit(0);
      });
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
