# Implementation Plan

## Overview
Implement server-side route protection for the Next.js application to fix the blank page issue when refreshing protected routes like `/login`.

The current application uses client-side authentication checks with `useAuth` hooks and `useEffect` redirects, which causes blank pages on direct navigation or refresh because the server doesn't know how to handle these routes. The solution involves implementing Next.js middleware for server-side route protection, Firebase Admin SDK for server-side authentication verification, and proper Firebase Hosting configuration to support dynamic routes.

## Types
Define server-side authentication and middleware types for route protection.

```typescript
// Server-side authentication context
interface ServerAuthContext {
  user: {
    uid: string;
    email: string;
    displayName?: string;
  } | null;
  isAuthenticated: boolean;
}

// Middleware configuration
interface RouteConfig {
  path: string;
  requiresAuth: boolean;
  redirectTo?: string;
}

// Firebase Admin user verification
interface VerifiedUser {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
}
```

## Files
Implement server-side route protection through middleware and configuration updates.

**New files to be created:**
- `pickleglass_web/middleware.ts` - Next.js middleware for route protection
- `pickleglass_web/lib/firebase-admin.ts` - Firebase Admin SDK configuration
- `pickleglass_web/lib/auth-middleware.ts` - Authentication middleware utilities
- `pickleglass_web/lib/route-config.ts` - Route protection configuration

**Existing files to be modified:**
- `pickleglass_web/next.config.js` - Add middleware configuration and rewrites
- `firebase.json` - Update hosting configuration for dynamic routes
- `pickleglass_web/package.json` - Add Firebase Admin SDK dependency
- `pickleglass_web/app/login/page.tsx` - Remove client-side redirect logic
- `pickleglass_web/app/page.tsx` - Remove client-side authentication checks
- `pickleglass_web/utils/auth.ts` - Simplify client-side auth to focus on UI state

## Functions
Implement server-side authentication verification and route protection functions.

**New functions:**
- `verifyAuthToken(token: string): Promise<VerifiedUser | null>` in `lib/firebase-admin.ts`
- `getAuthFromRequest(request: NextRequest): Promise<ServerAuthContext>` in `lib/auth-middleware.ts`
- `shouldProtectRoute(pathname: string): RouteConfig | null` in `lib/route-config.ts`
- `handleAuthRedirect(request: NextRequest, config: RouteConfig): NextResponse` in `lib/auth-middleware.ts`

**Modified functions:**
- Update `useAuth()` in `utils/auth.ts` to remove redirect logic
- Simplify authentication checks in page components

## Classes
No new classes required - using functional approach with Next.js middleware.

**Modified classes/components:**
- `LoginPage` component - remove client-side redirect handling
- `Home` component - remove authentication redirect logic
- `ClientLayout` component - simplify to focus on UI state only

## Dependencies
Add Firebase Admin SDK for server-side authentication verification.

```json
{
  "firebase-admin": "^12.0.0"
}
```

Integration requirements:
- Firebase Admin SDK requires service account credentials
- Environment variables for Firebase Admin configuration
- Next.js middleware configuration for route matching

## Testing
Implement comprehensive testing for server-side route protection.

**New test files:**
- `pickleglass_web/__tests__/middleware.test.ts` - Test middleware route protection
- `pickleglass_web/__tests__/firebase-admin.test.ts` - Test server-side auth verification

**Modified test files:**
- Update existing auth tests to focus on client-side UI state
- Add integration tests for protected route access

**Testing approach:**
- Unit tests for middleware functions
- Integration tests for route protection
- E2E tests for authentication flow with page refreshes

## Implementation Order
Implement changes in logical sequence to minimize conflicts and ensure successful integration.

1. **Setup Firebase Admin SDK** - Add dependency and configuration
2. **Create middleware utilities** - Implement auth verification functions
3. **Implement Next.js middleware** - Add route protection logic
4. **Update Next.js configuration** - Configure middleware and rewrites
5. **Update Firebase Hosting configuration** - Support dynamic routes
6. **Simplify client-side components** - Remove redundant auth checks
7. **Update authentication utilities** - Focus on UI state management
8. **Add comprehensive testing** - Ensure route protection works correctly
9. **Deploy and validate** - Test on Firebase Hosting with real scenarios
