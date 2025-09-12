# Cloud Run Port Binding Fix

## Problem Summary
The application was failing to deploy to Firebase App Hosting (Cloud Run) with the error:
```
The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.
```

## Root Causes Identified

1. **Build Process Issue**: The build was attempting to build the entire Electron desktop application instead of just the web component
2. **Port Configuration**: Server was defaulting to port 3000 instead of 8080
3. **Build Dependencies**: Complex build process was including unnecessary Electron dependencies

## Fixes Applied

### 1. Updated `apphosting.yaml`
- Fixed build commands to only build the web application
- Ensured proper dependency installation and cleanup
- Maintained PORT=8080 environment variable

### 2. Updated `pickleglass_web/server.js`
- Changed default port from 3000 to 8080
- Added explicit directory configuration for Next.js
- Enhanced logging for better debugging
- Added health check endpoints (`/health` and `/healthz`)

### 3. Added `.dockerignore`
- Excluded unnecessary files from the container build
- Reduced build size and complexity

## Key Changes

### Port Configuration
```javascript
// Before
const port = parseInt(process.env.PORT, 10) || 3000;

// After
const port = parseInt(process.env.PORT, 10) || 8080;
```

### Next.js Configuration
```javascript
const app = next({ 
  dev, 
  hostname, 
  port,
  conf: dev ? {} : { 
    experimental: { 
      isrMemoryCacheSize: 0 
    },
    dir: __dirname  // Explicit directory setting
  }
});
```

### Build Process
```yaml
buildConfig:
  commands:
    - cd pickleglass_web && npm ci
    - cd pickleglass_web && npm run build
    - cd pickleglass_web && npm prune --production
```

## Verification Steps

1. **Local Testing**:
   ```bash
   cd pickleglass_web
   PORT=8080 NODE_ENV=production npm start
   ```

2. **Health Check**:
   ```bash
   curl http://localhost:8080/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

3. **Cloud Run Deployment**:
   - The container should now start successfully
   - Health checks should pass
   - Application should be accessible on the assigned URL

## Troubleshooting

### If the container still fails to start:

1. **Check Build Logs**: Look for any remaining Electron-related build steps
2. **Verify Dependencies**: Ensure only web dependencies are installed
3. **Port Binding**: Confirm the server is binding to 0.0.0.0:8080
4. **Health Checks**: Test the `/health` endpoint locally

### Common Issues:

- **Build timeout**: The build process should now be much faster without Electron
- **Memory issues**: Reduced dependencies should lower memory usage
- **Port conflicts**: Server now defaults to 8080 and binds to all interfaces

## Monitoring

The server now includes comprehensive logging:
- Startup time tracking
- Port and hostname confirmation
- Health check availability
- Error handling with stack traces

## Next Steps

1. Deploy the updated configuration
2. Monitor the deployment logs for successful startup
3. Test the application functionality
4. Set up monitoring for the health check endpoints

## Files Modified

- `apphosting.yaml` - Build and runtime configuration
- `pickleglass_web/server.js` - Server startup and port configuration
- `pickleglass_web/.dockerignore` - Container build optimization

## Health Check Endpoints

- `GET /health` - Returns JSON status
- `GET /healthz` - Returns JSON status (Kubernetes-style)

Both endpoints return:
```json
{
  "status": "ok",
  "timestamp": "2025-09-12T11:33:17.000Z"
}
```

## Implementation Status

✅ **COMPLETED** - All fixes have been successfully implemented:

1. **apphosting.yaml** - Updated with streamlined build process
2. **pickleglass_web/server.js** - Fixed port configuration and added health checks
3. **pickleglass_web/.dockerignore** - Added to optimize container builds

## Deployment Command

To deploy the fixed configuration:

```bash
firebase apphosting:deploy
```

## Expected Results

After deployment, you should see:
- Build process completes without Electron-related errors
- Container starts successfully on port 8080
- Health checks pass
- Application becomes accessible via the assigned Cloud Run URL

## Validation Checklist

- [x] Port defaults to 8080 instead of 3000
- [x] Server binds to 0.0.0.0 (all interfaces)
- [x] Health check endpoints added (/health, /healthz)
- [x] Build process excludes Electron dependencies
- [x] Enhanced logging for debugging
- [x] Graceful shutdown handling
- [x] Error handling with stack traces
- [x] Docker ignore file optimizes build size

The implementation is complete and ready for deployment.
