# Cloud Run Deployment Guide

## Overview

This guide documents the comprehensive fixes implemented to resolve the Cloud Run deployment failure where the container failed to start and listen on PORT=8080 within the allocated timeout.

## Problem Summary

The original error was:
```
generic::failed_precondition: Revision 'seer39-build-2025-09-12-008' is not ready and cannot serve traffic. The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.
```

## Root Causes Identified

1. **Missing Dockerfile**: Application relied on buildpacks which couldn't handle the hybrid Electron/Next.js structure
2. **Port Configuration Issues**: Hardcoded localhost:3000 references throughout codebase
3. **Server Binding Problems**: Server not properly configured for Cloud Run environment
4. **Missing Health Checks**: No health check endpoints for Cloud Run monitoring
5. **Suboptimal Next.js Configuration**: Not optimized for containerized deployment

## Implemented Solutions

### 1. Containerization Infrastructure

#### Created `pickleglass_web/Dockerfile`
- Multi-stage Docker build optimized for Next.js
- Uses Node.js 18 Alpine for minimal image size
- Implements proper security with non-root user
- Includes built-in health checks
- Optimized for Cloud Run deployment

#### Updated `pickleglass_web/.dockerignore`
- Comprehensive exclusion of unnecessary files
- Optimized for faster builds and smaller images
- Excludes development-only dependencies

#### Created `pickleglass_web/docker-entrypoint.sh`
- Robust container startup script
- Environment validation and error handling
- Cloud Run environment detection
- Comprehensive logging and diagnostics

### 2. Next.js Configuration Optimization

#### Updated `pickleglass_web/next.config.js`
- Enabled `output: 'standalone'` for optimal containerization
- Added container-specific optimizations
- Disabled ISR cache and worker threads for containers
- Maintained existing security headers and optimizations

### 3. Server Configuration Fixes

#### Fixed `pickleglass_web/server.js`
- Already properly configured for Cloud Run (0.0.0.0:8080)
- Includes health check endpoint at `/health`
- Proper error handling and graceful shutdown
- Comprehensive logging and diagnostics

#### Fixed `pickleglass_web/backend_node/index.js`
- Removed hardcoded localhost:3000 reference
- Now uses dynamic port from environment variable
- Maintains CORS configuration compatibility

### 4. Health Check Implementation

#### Created `pickleglass_web/healthcheck.js`
- Dedicated health check script for monitoring
- Comprehensive environment validation
- Timeout handling and error reporting
- Cloud Run environment detection

### 5. Firebase App Hosting Configuration

#### Updated `apphosting.yaml`
- Switched from buildpack to Dockerfile-based deployment
- Configured proper resource limits (1 CPU, 1Gi memory)
- Set appropriate scaling parameters
- Maintained environment variable configuration

### 6. Package.json Enhancements

#### Added container-specific scripts:
- `start:container`: Container-optimized startup
- `healthcheck`: Health check validation
- `docker:build`: Local Docker build testing
- `docker:run`: Local container testing
- `docker:test`: Container validation

## File Structure

```
pickleglass_web/
├── Dockerfile                 # Multi-stage container build
├── docker-entrypoint.sh      # Container startup script
├── healthcheck.js            # Health check implementation
├── .dockerignore             # Optimized Docker ignore rules
├── server.js                 # Custom Next.js server (fixed)
├── next.config.js            # Container-optimized config
├── package.json              # Updated with container scripts
├── backend_node/
│   └── index.js              # Fixed hardcoded port reference
└── apphosting.yaml           # Updated for Dockerfile deployment
```

## Deployment Instructions

### 1. Local Testing (if Docker is available)

```bash
# Build the container
cd pickleglass_web
docker build -t pickleglass-web .

# Test the container locally
docker run -p 8080:8080 -e NODE_ENV=production pickleglass-web

# Test health check
curl http://localhost:8080/health
```

### 2. Firebase App Hosting Deployment

```bash
# Deploy to Firebase App Hosting
firebase deploy --only hosting

# Monitor deployment logs
firebase hosting:logs
```

### 3. Validation Steps

1. **Container Startup**: Verify container starts within timeout
2. **Port Binding**: Confirm server binds to 0.0.0.0:8080
3. **Health Check**: Validate `/health` endpoint responds correctly
4. **Application Functionality**: Test web dashboard features
5. **Sync Functionality**: Verify Electron app sync still works

## Key Features Preserved

- **Sync Functionality**: Web dashboard continues to serve as configuration tool for Electron desktop app
- **Firebase Integration**: All Firebase services remain functional
- **Authentication**: User authentication and session management preserved
- **Data Persistence**: Firestore integration maintained
- **Security**: All security headers and configurations preserved

## Environment Variables

The following environment variables are automatically set by Cloud Run:

- `PORT=8080`: Container port (required)
- `NODE_ENV=production`: Production environment
- `HOSTNAME=0.0.0.0`: Bind to all interfaces
- `K_SERVICE`: Cloud Run service name (auto-set)
- `K_REVISION`: Cloud Run revision (auto-set)

## Monitoring and Debugging

### Health Check Endpoint
- **URL**: `https://your-app.web.app/health`
- **Response**: `{"status": "ok", "timestamp": "2025-01-12T..."}`

### Container Logs
```bash
# View deployment logs
firebase hosting:logs

# View Cloud Run logs (if using Cloud Run directly)
gcloud logs read --service=your-service-name
```

### Common Issues and Solutions

1. **Container Won't Start**
   - Check environment variables are set correctly
   - Verify Dockerfile builds successfully
   - Review container startup logs

2. **Port Binding Issues**
   - Ensure server binds to 0.0.0.0:$PORT
   - Verify no hardcoded port references remain

3. **Health Check Failures**
   - Test `/health` endpoint locally
   - Check server startup sequence
   - Verify Next.js app is ready

## Performance Optimizations

- **Multi-stage Build**: Minimal production image size
- **Standalone Output**: Optimized Next.js bundle
- **Alpine Linux**: Lightweight base image
- **Non-root User**: Enhanced security
- **Optimized Dependencies**: Production-only packages

## Security Considerations

- Container runs as non-root user (nextjs:nodejs)
- Comprehensive input validation
- Proper error handling without information leakage
- Security headers maintained from original configuration
- Environment variable validation

## Next Steps

1. **Deploy and Test**: Deploy to Firebase App Hosting and validate functionality
2. **Monitor Performance**: Watch startup times and resource usage
3. **Load Testing**: Verify application handles expected traffic
4. **Backup Plan**: Keep buildpack configuration as fallback if needed

## Rollback Plan

If issues occur, you can quickly rollback by reverting `apphosting.yaml` to use buildpacks:

```yaml
# Rollback configuration
runConfig:
  runtime: nodejs20
  startCommand: cd pickleglass_web && npm start
  env:
    - variable: PORT
      value: "8080"
    - variable: NODE_ENV
      value: "production"

buildConfig:
  commands:
    - cd pickleglass_web && npm ci
    - cd pickleglass_web && npm run build
    - cd pickleglass_web && npm prune --production
```

## Support

For issues or questions:
1. Check container logs for startup errors
2. Verify health check endpoint responds
3. Test local Docker build if possible
4. Review environment variable configuration
