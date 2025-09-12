# Cloud Run Deployment Fix - Updated Solution

## Problem Analysis

The initial deployment failed because:

1. **Firebase App Hosting was building the entire Electron application** instead of just the web component
2. **Invalid Next.js configuration** with unsupported `isrMemoryCacheSize` option
3. **Buildpack vs Dockerfile confusion** - Firebase App Hosting uses buildpacks, not custom Dockerfiles
4. **Root directory build context** was trying to build desktop components

## Root Cause

From the build logs, we can see:
```
> reetreev-desktop@0.2.4 build
> npm run install:web && npm run build:all && electron-builder --config electron-builder.yml --publish never
```

Firebase App Hosting was executing the root `package.json` build script, which includes Electron desktop build processes that fail in a server environment.

## Solution Implemented

### 1. Fixed `apphosting.yaml`
```yaml
# Firebase App Hosting configuration
runConfig:
  cpu: 1
  memory: 512Mi
  maxInstances: 10
  minInstances: 0
  concurrency: 80
  env:
    - variable: PORT
      value: "8080"
    - variable: NODE_ENV
      value: "production"

# Build configuration - build only the web app, not Electron
buildConfig:
  rootDirectory: pickleglass_web
  commands:
    - npm ci
    - npm run build
    - npm prune --production
```

**Key Changes:**
- Set `rootDirectory: pickleglass_web` to build only the web application
- Removed Dockerfile references (Firebase App Hosting uses buildpacks)
- Simplified build commands to work within the web directory

### 2. Fixed `pickleglass_web/next.config.js`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Explicitly disable static export - ensure server-side rendering only
  trailingSlash: false,
  
  // ... rest of config
  experimental: {
    serverComponentsExternalPackages: [],
    optimizePackageImports: ['lucide-react', 'firebase'],
    // Container-specific optimizations
    workerThreads: false, // Disable worker threads in containers
  },
  // ... rest of config
}
```

**Key Changes:**
- Removed `output: 'standalone'` (not compatible with Firebase App Hosting buildpacks)
- Removed invalid `isrMemoryCacheSize` option
- Kept other optimizations for server-side rendering

### 3. Server Configuration (Already Fixed)
- `pickleglass_web/server.js` - Already properly configured for Cloud Run (0.0.0.0:8080)
- `pickleglass_web/backend_node/index.js` - Fixed hardcoded port reference
- Health check endpoint at `/health` already implemented

## What This Fixes

1. **Container Startup**: Now builds only the web application, avoiding Electron build failures
2. **Port Binding**: Server correctly binds to 0.0.0.0:8080 as required by Cloud Run
3. **Build Process**: Uses Firebase App Hosting buildpacks correctly
4. **Configuration**: Removes invalid Next.js options that caused warnings

## Expected Behavior

With these fixes:
1. Build will execute only in `pickleglass_web` directory
2. No Electron components will be built
3. Next.js application will build successfully
4. Container will start and listen on port 8080
5. Health check endpoint will be available at `/health`

## Deployment Steps

1. **Commit and push changes**:
   ```bash
   git add .
   git commit -m "Fix Cloud Run deployment configuration"
   git push
   ```

2. **Deploy to Firebase App Hosting**:
   ```bash
   firebase deploy --only hosting
   ```

3. **Monitor deployment**:
   - Check build logs for successful completion
   - Verify container starts without exit code 1
   - Test health check endpoint: `https://your-app.web.app/health`

## Validation Checklist

- [ ] Build completes without Electron-related errors
- [ ] Container starts successfully (no exit code 1)
- [ ] Health check endpoint responds with `{"status": "ok", "timestamp": "..."}`
- [ ] Web application loads correctly
- [ ] Sync functionality with Electron app still works

## Rollback Plan

If issues persist, you can temporarily revert to the previous working configuration by reverting the `apphosting.yaml` and `next.config.js` changes.

## Key Learnings

1. **Firebase App Hosting uses buildpacks**, not custom Dockerfiles
2. **`rootDirectory` is crucial** to avoid building unwanted components
3. **Next.js standalone output** is not compatible with Firebase App Hosting buildpacks
4. **Build context matters** - the root directory contains Electron build scripts that fail in server environments

This solution maintains all the sync functionality between the web dashboard and Electron app while fixing the Cloud Run deployment issues.
