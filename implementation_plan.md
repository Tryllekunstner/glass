# Implementation Plan

Fix Firebase App Hosting environment variable mapping to resolve deployment failures by extracting configuration from Firebase's native JSON format.

## Overview

The deployment is failing because Firebase App Hosting provides environment variables in `FIREBASE_CONFIG` and `FIREBASE_WEBAPP_CONFIG` JSON format, but the application expects individual `NEXT_PUBLIC_*` variables. The solution is to update the configuration utilities to extract values from Firebase's JSON format while maintaining backward compatibility with individual variables for local development.

## Types

Update environment configuration types to support both Firebase JSON format and individual variables.

```typescript
interface FirebaseConfig {
  projectId: string;
  storageBucket: string;
  databaseURL?: string;
}

interface FirebaseWebappConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

interface EnvironmentConfig {
  NODE_ENV: string;
  NEXT_PUBLIC_FIREBASE_API_KEY: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  NEXT_PUBLIC_FIREBASE_APP_ID: string;
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: string;
  NEXT_PUBLIC_API_URL: string;
  NEXT_PUBLIC_ENABLE_ANALYTICS: string;
  NEXT_PUBLIC_ENABLE_DEBUG: string;
}
```

## Files

Modify existing configuration files to support Firebase App Hosting's native environment variable format.

**Modified files:**
- `pickleglass_web/utils/config.ts` - Update to extract from Firebase JSON configs
- `pickleglass_web/server/utils/firebase-admin.js` - Update to use extracted project ID
- `pickleglass_web/server/utils/startup-health.js` - Update environment validation
- `pickleglass_web/lib/firebase-admin.ts` - Update to use extracted project ID

**Configuration files to update:**
- `apphosting.yaml` - Remove redundant individual environment variables
- `pickleglass_web/.env.apphosting` - Simplify to only necessary overrides

## Functions

Update configuration extraction and validation functions to support Firebase's JSON format.

**New functions:**
- `extractFirebaseConfig()` - Extract values from FIREBASE_CONFIG JSON
- `extractFirebaseWebappConfig()` - Extract values from FIREBASE_WEBAPP_CONFIG JSON
- `getEnvironmentConfig()` - Unified config getter with fallback logic

**Modified functions:**
- `validateEnvironmentConfig()` - Update validation for new extraction logic
- `getFirebaseConfig()` - Update to use extracted values
- `validateAppHostingEnvironment()` - Update to check for Firebase JSON configs

## Classes

No new classes required. Existing configuration classes will be updated to use the new extraction functions.

**Modified classes:**
- `AuthenticationService` - Update to use extracted project ID from new config system

## Dependencies

No new dependencies required. The solution uses existing JSON parsing capabilities and maintains current Firebase SDK versions.

## Testing

Update existing tests to cover both Firebase JSON format and individual variable fallback scenarios.

**Test updates:**
- `pickleglass_web/__tests__/firebase.test.ts` - Add tests for JSON config extraction
- `pickleglass_web/__tests__/config.test.ts` - Add tests for environment config extraction

**New test scenarios:**
- Firebase App Hosting JSON format parsing
- Fallback to individual variables for local development
- Error handling for malformed JSON configs

## Implementation Order

1. Update `utils/config.ts` with Firebase JSON extraction logic
2. Update Firebase Admin SDK initialization files
3. Update startup health checks
4. Update environment files and App Hosting configuration
5. Update tests to cover new functionality
6. Test deployment to verify fix
