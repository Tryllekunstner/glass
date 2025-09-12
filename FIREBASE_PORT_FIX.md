# Firebase App Hosting Port 8080 Fix

## Problem Summary
Firebase App Hosting deployment was failing with the error:
```
The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.
```

## Root Cause
The Next.js application was not properly configured to:
1. Read and use the PORT environment variable set by Firebase App Hosting (8080)
2. Listen on all network interfaces (0.0.0.0) required by Cloud Run
3. Start a production server that binds to the correct port

## Solution Implemented

### 1. Created Custom Next.js Server (`pickleglass_web/server.js`)
- Reads PORT environment variable (defaults to 3000 for local development)
- Listens on 0.0.0.0 (all interfaces) for Cloud Run compatibility
- Provides proper error handling and logging
- Supports graceful shutdown
- Works in both development and production modes

### 2. Updated Package Scripts (`pickleglass_web/package.json`)
- Changed `start` script from `next start` to `node server.js`
- Added `start:next` as fallback to original Next.js start command
- Maintains compatibility with existing development workflow

### 3. Updated Next.js Configuration (`pickleglass_web/next.config.js`)
- Added experimental configuration for custom server compatibility
- Consolidated duplicate experimental settings
- Maintained existing optimizations and security headers

### 4. Updated Firebase App Hosting Configuration (`apphosting.yaml`)
- Added explicit NODE_ENV=production environment variable
- Improved documentation in comments
- Maintained existing build process

## Testing Results

### Local Testing
✅ **Build Process**: `npm run build` completes successfully
✅ **Production Server**: Starts correctly on port 8080 with `PORT=8080 npm start`
✅ **Development Server**: Still works on port 3000 with `npm run dev`
✅ **Environment Variables**: Properly reads and uses PORT environment variable

### Expected Firebase App Hosting Behavior
The custom server will now:
1. Read PORT=8080 from Firebase App Hosting environment
2. Listen on 0.0.0.0:8080 as required by Cloud Run
3. Start within the allocated timeout period
4. Serve the Next.js application correctly

## Files Modified
- `pickleglass_web/server.js` (NEW)
- `pickleglass_web/package.json` (MODIFIED)
- `pickleglass_web/next.config.js` (MODIFIED)
- `apphosting.yaml` (MODIFIED)

## Deployment Instructions
1. Commit all changes to your repository
2. Push to the branch connected to Firebase App Hosting
3. Firebase will automatically trigger a new build and deployment
4. Monitor the deployment logs to confirm successful startup

## Verification Steps
After deployment, verify:
1. Build logs show successful completion
2. Server startup logs show "Ready on http://0.0.0.0:8080"
3. Application is accessible via the Firebase App Hosting URL
4. All application functionality works as expected

## Rollback Plan
If issues occur, you can quickly rollback by:
1. Reverting `pickleglass_web/package.json` start script to `next start`
2. Removing `pickleglass_web/server.js`
3. This will restore the previous behavior (though the port issue will return)

## Technical Notes
- The custom server uses Next.js built-in server capabilities
- No additional dependencies were required
- Development workflow remains unchanged
- Production deployment now properly handles Cloud Run requirements
