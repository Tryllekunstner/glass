# Implementation Plan

Fix Firebase App Hosting deployment issues including container startup failures, authentication permission errors, and optimize the Next.js application for Cloud Run deployment.

The current deployment is failing due to multiple issues: the Firebase service account lacks proper permissions, the container fails to start within the allocated timeout, and the Firebase Admin SDK cannot initialize properly. This plan addresses each issue systematically to ensure successful deployment and operation in Firebase App Hosting environment.

## Types

Update Firebase service account permissions and container configuration types.

**Service Account Permission Requirements:**
- `roles/serviceusage.serviceUsageConsumer` - Required for Firebase Auth API access
- `firebase-app-hosting-compute@getseerai.iam.gserviceaccount.com` - Default service account

**Container Configuration:**
- Port: 8080 (fixed)
- Memory: 512Mi
- CPU: 1.00
- Startup timeout: Extended to handle Firebase initialization
- Health check timeout: Extended for authentication service

**Environment Variables:**
- `FIREBASE_CONFIG` - Provided by App Hosting (basic config)
- `FIREBASE_WEBAPP_CONFIG` - Provided by App Hosting (full client config)
- `PORT=8080` - Container port
- `NODE_ENV=production` - Production environment

## Files

Modify existing configuration and server files to fix deployment issues.

**Files to be modified:**
- `apphosting.yaml` - Update container configuration and timeouts
- `pickleglass_web/next.config.js` - Enable standalone output for optimal Cloud Run deployment
- `pickleglass_web/server/utils/firebase-admin.js` - Improve error handling and graceful degradation
- `pickleglass_web/server/utils/startup-health.js` - Extend timeouts and improve resilience
- `pickleglass_web/server.js` - Optimize startup sequence and error handling

**Files to be created:**
- `FIREBASE_IAM_SETUP.md` - Documentation for setting up proper IAM permissions
- `pickleglass_web/server/utils/cloud-run-health.js` - Cloud Run specific health checks

## Functions

Enhance startup and health check functions for better Cloud Run compatibility.

**Modified functions:**
- `startServer()` in `server.js` - Add better error handling and startup sequencing
- `validateAppHostingEnvironment()` in `startup-health.js` - Improve environment validation
- `healthCheckWithAuth()` in `startup-health.js` - Add graceful degradation for auth failures
- `AuthenticationService.initialize()` in `firebase-admin.js` - Better error handling for permission issues

**New functions:**
- `validateCloudRunEnvironment()` - Cloud Run specific environment validation
- `createCloudRunHealthChecker()` - Health checker optimized for Cloud Run
- `gracefulAuthDegradation()` - Handle auth service failures gracefully

## Classes

Update existing service classes for better Cloud Run deployment compatibility.

**Modified classes:**
- `AuthenticationService` in `firebase-admin.js` - Enhanced error handling and permission checking
- `StartupHealthChecker` in `startup-health.js` - Extended timeouts and better failure handling

**Enhanced error handling:**
- Graceful degradation when Firebase Admin SDK fails to initialize
- Better logging for permission-related errors
- Timeout handling for slow Cloud Run startups

## Dependencies

No new dependencies required - focus on configuration and deployment optimization.

**Configuration changes:**
- Next.js standalone output enabled
- Extended container timeouts
- Improved health check intervals

**Firebase service account permissions:**
- Add `roles/serviceusage.serviceUsageConsumer` role
- Verify `firebase-app-hosting-compute@getseerai.iam.gserviceaccount.com` has proper permissions

## Testing

Update health checks and add Cloud Run specific validation.

**Modified test approaches:**
- Extended startup health check timeouts
- Graceful handling of Firebase Admin SDK initialization failures
- Better error reporting for permission issues

**New validation:**
- Cloud Run environment detection
- Service account permission validation
- Container startup sequence optimization

## Implementation Order

Sequential steps to fix deployment issues while maintaining system stability.

1. **Update IAM Permissions** - Add required service account roles
2. **Optimize Next.js Configuration** - Enable standalone output and container optimizations
3. **Enhance Error Handling** - Improve Firebase Admin SDK initialization and graceful degradation
4. **Extend Container Timeouts** - Update apphosting.yaml with longer startup timeouts
5. **Improve Health Checks** - Make startup validation more resilient to temporary failures
6. **Update Server Startup** - Optimize server.js startup sequence for Cloud Run
7. **Test Deployment** - Verify fixes resolve the container startup and authentication issues
