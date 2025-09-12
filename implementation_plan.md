# Implementation Plan

## Overview
Fix Cloud Run deployment failure where the container fails to start and listen on PORT=8080 within the allocated timeout.

The investigation reveals multiple critical issues: the application is configured as a hybrid Electron/Next.js application with complex build dependencies, server configuration conflicts, missing Dockerfile for proper containerization, hardcoded port references, and deployment configuration mismatches. The current approach attempts to deploy a desktop application to Cloud Run without proper containerization or server-side optimization.

## Types
Container configuration and deployment architecture changes.

- **ContainerConfig**: New interface for Docker container configuration
  - `port: number` - Container port (8080)
  - `hostname: string` - Bind hostname (0.0.0.0)
  - `healthCheck: HealthCheckConfig` - Health check configuration
- **HealthCheckConfig**: Health check endpoint configuration
  - `path: string` - Health check path (/health)
  - `timeout: number` - Timeout in seconds
  - `interval: number` - Check interval in seconds
- **BuildConfig**: Build process configuration
  - `target: 'web' | 'electron'` - Build target
  - `excludeElectron: boolean` - Exclude Electron dependencies
  - `optimizeForContainer: boolean` - Container-specific optimizations

## Files
Containerization and deployment configuration fixes.

**New files to be created:**
- `pickleglass_web/Dockerfile` - Multi-stage Docker build for Next.js application
- `pickleglass_web/.dockerignore` - Enhanced Docker ignore file (update existing)
- `pickleglass_web/docker-entrypoint.sh` - Container startup script
- `pickleglass_web/healthcheck.js` - Dedicated health check script

**Existing files to be modified:**
- `apphosting.yaml` - Update to use Dockerfile-based build instead of buildpacks
- `pickleglass_web/server.js` - Fix port binding, add proper error handling, optimize for production
- `pickleglass_web/next.config.js` - Add container-specific optimizations
- `pickleglass_web/package.json` - Add container-specific scripts and optimize dependencies
- `pickleglass_web/backend_node/index.js` - Fix hardcoded localhost:3000 reference
- `package.json` (root) - Update deployment scripts to use containerized approach

**Configuration file updates:**
- Update Firebase App Hosting to use custom Dockerfile
- Optimize Next.js configuration for server-side rendering in containers
- Add proper environment variable handling for Cloud Run

## Functions
Server startup and containerization functions.

**New functions:**
- `createHealthCheckServer()` in `pickleglass_web/healthcheck.js` - Dedicated health check endpoint
- `validateEnvironment()` in `pickleglass_web/server.js` - Environment validation on startup
- `gracefulShutdown()` in `pickleglass_web/server.js` - Proper shutdown handling (enhance existing)
- `containerOptimizations()` in `pickleglass_web/server.js` - Container-specific optimizations

**Modified functions:**
- `startServer()` in `pickleglass_web/server.js` - Fix port binding logic, add container detection
- `createApp()` in `pickleglass_web/backend_node/index.js` - Remove hardcoded localhost:3000 reference
- Next.js configuration functions in `pickleglass_web/next.config.js` - Add container optimizations

**Removed functions:**
- Electron-specific server functions that conflict with Cloud Run deployment
- Development-only middleware that shouldn't run in production containers

## Classes
No new classes required, focus on configuration and deployment fixes.

**Modified classes:**
- Server configuration classes to properly handle Cloud Run environment
- Build configuration to separate web and desktop builds

## Dependencies
Container runtime and deployment dependencies.

**New packages:**
- None required - using existing Next.js and Node.js capabilities

**Configuration changes:**
- Update `pickleglass_web/package.json` to optimize for production containers
- Remove Electron dependencies from production build
- Add container-specific environment variable handling

**Integration requirements:**
- Docker multi-stage build for optimal container size
- Firebase App Hosting integration with custom Dockerfile
- Proper health check integration with Cloud Run

## Testing
Container and deployment validation approach.

**Test file requirements:**
- `pickleglass_web/__tests__/container.test.js` - Container startup and health check tests
- `pickleglass_web/__tests__/deployment.test.js` - Deployment configuration validation
- Update existing tests to work with containerized environment

**Existing test modifications:**
- Update port references in tests from 3000 to 8080
- Add container environment detection in test setup
- Modify Firebase integration tests for Cloud Run environment

**Validation strategies:**
- Local Docker build and run testing
- Health check endpoint validation
- Port binding verification
- Environment variable handling tests
- Cloud Run deployment simulation

## Implementation Order
Sequential implementation to minimize conflicts and ensure successful deployment.

1. **Create Dockerfile and container configuration** - Essential foundation for Cloud Run deployment
2. **Fix server.js port binding and configuration** - Core server functionality must work correctly
3. **Update apphosting.yaml for Dockerfile-based builds** - Switch from buildpacks to custom container
4. **Fix hardcoded port references** - Remove localhost:3000 references throughout codebase
5. **Add health check endpoints and validation** - Required for Cloud Run health monitoring
6. **Optimize Next.js configuration for containers** - Performance and compatibility improvements
7. **Update package.json scripts and dependencies** - Clean separation of web vs desktop builds
8. **Add container startup script and environment validation** - Robust container initialization
9. **Test local Docker build and deployment** - Validate changes before Cloud Run deployment
10. **Deploy to Cloud Run and validate functionality** - Final deployment and verification

**Critical Path Dependencies:**
- Dockerfile must be created before updating apphosting.yaml
- Server port fixes must be completed before container testing
- Health checks must be implemented before Cloud Run deployment
- All hardcoded references must be fixed before production deployment

**Risk Mitigation:**
- Each step includes validation before proceeding to next step
- Rollback plan available by reverting to buildpack approach if needed
- Local testing environment mirrors Cloud Run as closely as possible
- Incremental deployment approach allows for quick issue identification
