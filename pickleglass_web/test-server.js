// Simple test server to verify basic functionality
const http = require('http');

const port = parseInt(process.env.PORT, 10) || 8080;
const hostname = '0.0.0.0';

console.log('=== Simple Test Server ===');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT}`);
console.log(`Target hostname: ${hostname}`);
console.log(`Target port: ${port}`);

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Simple test server is running'
    }));
    return;
  }
  
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>Test Server</title></head>
      <body>
        <h1>Test Server Running</h1>
        <p>Server is listening on ${hostname}:${port}</p>
        <p>NODE_ENV: ${process.env.NODE_ENV}</p>
        <p>Time: ${new Date().toISOString()}</p>
        <p><a href="/health">Health Check</a></p>
      </body>
    </html>
  `);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

server.listen(port, hostname, () => {
  console.log(`✅ Test server running on http://${hostname}:${port}`);
  console.log(`Health check: http://${hostname}:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
