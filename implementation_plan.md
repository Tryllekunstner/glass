# Implementation Plan

## Overview
Fix Firebase App Hosting deployment failure where the container fails to start and listen on port 8080 due to Next.js server configuration issues.

The core problem is that the Firebase App Hosting configuration expects the Next.js application to start a server listening on port 8080, but the current setup doesn't properly handle the PORT environment variable and server startup sequence. The build succeeds but the runtime fails because the Next.js server isn't configured to bind to the correct port that Cloud Run expects.

## Types
No new type definitions required for this fix.

The existing TypeScript interfaces and types in the Next.js application are sufficient. This is primarily a configuration and server startup issue rather than a type system problem.

## Files
Modify existing configuration files to fix server startup and port binding.

**Files to be modified:**
- `pickleglass_web/next.config.js` - Add server configuration for port binding
- `pickleglass_web/package.json` - Add custom start script that respects PORT environment variable
- `apphosting.yaml` - Update build and run configuration for proper Next.js deployment

**New files to be created:**
- `pickleglass_web/server.js` - Custom Next.js server that properly handles PORT environment variable

## Functions
Add custom server startup function to handle port configuration.

**New functions:**
- `startServer()` in `pickleglass_web/server.js` - Custom Next.js server startup function that:
  - Reads PORT environment variable (defaults to 3000 locally, uses 8080 in production)
  - Starts Next.js server with proper port binding
  - Handles graceful shutdown
  - Provides proper error handling and logging

**Modified functions:**
- Update `start` script in `pickleglass_web/package.json` to use custom server
- Update build commands in root `package.json` to ensure proper build sequence

## Classes
No new classes required for this fix.

This is a configuration and server setup issue that doesn't require new class definitions. The existing Next.js application structure and React components remain unchanged.

## Dependencies
No new dependencies required.

All necessary packages (Next.js, React) are already installed. The fix uses built-in Next.js server capabilities and standard Node.js modules for port handling.

## Testing
Add validation for server startup and port binding.

**Test requirements:**
- Verify server starts correctly with PORT environment variable
- Test local development still works with default port 3000
- Validate production build and server startup sequence
- Ensure Firebase App Hosting deployment succeeds

**Testing approach:**
- Local testing with `npm run dev` and `npm start`
- Environment variable testing with different PORT values
- Firebase App Hosting deployment testing

## Implementation Order
Sequential implementation to minimize deployment disruption.

1. **Create custom Next.js server** (`pickleglass_web/server.js`)
   - Implement PORT environment variable handling
   - Add proper error handling and logging
   - Ensure compatibility with existing Next.js configuration

2. **Update package.json scripts** (`pickleglass_web/package.json`)
   - Modify start script to use custom server
   - Ensure development workflow remains unchanged

3. **Update Next.js configuration** (`pickleglass_web/next.config.js`)
   - Add any necessary server-side configuration
   - Ensure compatibility with custom server

4. **Update Firebase App Hosting configuration** (`apphosting.yaml`)
   - Verify build and start commands are correct
   - Ensure PORT environment variable is properly set

5. **Test and validate**
   - Local testing of server startup
   - Firebase App Hosting deployment testing
   - Verify application functionality after deployment

6. **Deploy and monitor**
   - Deploy to Firebase App Hosting
   - Monitor logs for successful startup
   - Verify application is accessible and functional
