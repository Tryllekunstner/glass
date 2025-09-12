# Implementation Plan

Fix white text in input fields and authentication failures in Firebase deployment.

The application has two critical issues: invisible white text in form inputs due to dark mode CSS conflicts, and authentication failures likely caused by Firebase configuration problems in production. These issues prevent users from logging in successfully, making the application unusable in the deployed environment.

## Types

No new type definitions required - this is a styling and configuration fix.

The existing TypeScript interfaces and types in the authentication system are sufficient and don't need modification.

## Files

Fix CSS styling conflicts and Firebase configuration issues.

**Modified files:**
- `pickleglass_web/app/globals.css` - Fix dark mode CSS conflicts causing white text
- `pickleglass_web/components/EmailPasswordForm.tsx` - Add explicit text color overrides as fallback
- `pickleglass_web/.env.production` - Update Firebase configuration for production
- `firebase.json` - Ensure proper environment variable configuration

**Configuration files to verify:**
- Firebase project settings for environment variables
- Hosting configuration for proper variable substitution

## Functions

No new functions required - existing authentication functions are working correctly.

The issue is not with the authentication logic in `utils/auth.ts` or `utils/firebase.ts`, but with CSS styling and environment configuration. The existing `signIn`, `signUp`, and Firebase initialization functions are properly implemented.

## Classes

No class modifications required.

The existing React components and Firebase service classes are functioning correctly. The issues are environmental rather than structural.

## Dependencies

No new dependencies required.

All necessary packages (Firebase SDK, Tailwind CSS, React) are already installed and properly configured. The issues stem from configuration and styling conflicts, not missing dependencies.

## Testing

Verify fixes work in both local and production environments.

**Test scenarios:**
1. Local development with light/dark mode preferences
2. Firebase deployment with proper environment variables
3. Authentication flow with email/password
4. Input field visibility in both light and dark modes
5. Cross-browser compatibility for CSS fixes

**Validation steps:**
1. Test input field text visibility in different browsers
2. Verify authentication works with correct credentials
3. Check Firebase console for proper configuration
4. Test dark mode toggle behavior
5. Validate environment variable substitution in production

## Implementation Order

Sequential fixes to address styling first, then configuration.

1. **Fix CSS dark mode conflicts** - Update globals.css to prevent white text on white backgrounds
2. **Add component-level style overrides** - Ensure input fields always have visible text
3. **Update production environment configuration** - Fix Firebase config variable substitution
4. **Verify Firebase project settings** - Ensure environment variables are properly set
5. **Test authentication flow** - Validate login works with correct credentials
6. **Deploy and verify** - Test fixes in production environment
