# Firebase Build Fix

## Problem
The Firebase App Hosting build was failing with the error:
```
sh: 1: next: not found
```

This occurred because:
1. Firebase was running `npm ci` and `npm run build` from the root directory
2. The build script tried to build the Next.js web component in `pickleglass_web/`
3. But the Next.js dependencies weren't installed in the subdirectory during the build process

## Solution Applied

### 1. Updated `package.json` Scripts
- Added `install:web` script to install web dependencies: `cd pickleglass_web && npm ci`
- Modified `postinstall` to include web dependency installation
- Updated build scripts to ensure web dependencies are installed before building

### 2. Created `apphosting.yaml`
Added Firebase App Hosting configuration with:
- Node.js 20 runtime
- Custom build commands that properly install dependencies for both root and web subdirectory
- Static asset serving configuration

### 3. Enhanced `firebase.json`
- Added caching headers for better performance
- Maintained existing hosting configuration for static export

## Files Modified
- `package.json` - Updated build scripts
- `apphosting.yaml` - New Firebase App Hosting configuration
- `firebase.json` - Added caching headers
- `FIREBASE_BUILD_FIX.md` - This documentation

## Next Steps
1. Commit and push these changes to your repository
2. Trigger a new Firebase App Hosting build
3. The build should now succeed and properly deploy your Next.js web application

## Build Process Flow
1. Firebase runs the commands in `apphosting.yaml`
2. Installs root dependencies with `npm ci --omit=optional`
3. Installs web dependencies with `cd pickleglass_web && npm ci`
4. Builds renderer with `npm run build:renderer`
5. Builds web component with `npm run build:web`
6. Serves static files from `pickleglass_web/out/`

## Verification
After deployment, your web application should be accessible at your Firebase Hosting URL with all Next.js functionality working correctly.
