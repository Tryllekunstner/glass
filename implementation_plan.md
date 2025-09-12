# Implementation Plan

Fix login page refresh issue caused by client-side hydration problems with window object access.

The login page currently fails to render properly on refresh due to server-side rendering (SSR) and client-side rendering (CSR) mismatches. The root cause is improper handling of browser-only APIs like `window.location.search` during the hydration process. This creates inconsistencies between what the server renders and what the client expects, resulting in a blank page on refresh.

## [Overview]

Resolve SSR/CSR hydration mismatches in the login page by implementing proper Next.js patterns for client-side only code.

The issue stems from accessing `window.location.search` in a `useEffect` hook before proper hydration is complete. This causes React hydration errors where the server-rendered content doesn't match the client-rendered content, leading to blank pages on refresh. The solution involves implementing proper client-side detection patterns, using Next.js router for URL parameter handling, and ensuring all browser-specific code runs only after hydration is complete.

## [Types]

Define TypeScript interfaces for improved type safety and hydration state management.

```typescript
interface HydrationState {
  isHydrated: boolean;
  isElectronMode: boolean;
  urlParams: URLSearchParams | null;
}

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface UseClientOnlyReturn {
  isClient: boolean;
  isHydrated: boolean;
}
```

## [Files]

Modify existing files and create new utilities for proper client-side handling.

**Modified Files:**
- `pickleglass_web/app/login/page.tsx` - Replace window object access with proper Next.js patterns
- `pickleglass_web/utils/auth.ts` - Add client-side detection utilities
- `pickleglass_web/components/ClientLayout.tsx` - Ensure proper hydration handling

**New Files:**
- `pickleglass_web/hooks/useClientOnly.ts` - Custom hook for client-side detection
- `pickleglass_web/components/ClientOnly.tsx` - Component wrapper for client-side only content
- `pickleglass_web/utils/clientUtils.ts` - Utilities for safe client-side operations

## [Functions]

Implement new functions and modify existing ones for proper hydration handling.

**New Functions:**
- `useClientOnly()` in `hooks/useClientOnly.ts` - Hook to detect client-side rendering state
- `ClientOnly()` in `components/ClientOnly.tsx` - Component to wrap client-side only content
- `getUrlParams()` in `utils/clientUtils.ts` - Safe URL parameter extraction
- `isElectronEnvironment()` in `utils/clientUtils.ts` - Safe Electron detection

**Modified Functions:**
- `LoginPage()` in `app/login/page.tsx` - Replace direct window access with safe alternatives
- `useAuth()` in `utils/auth.ts` - Add hydration state management
- `ClientLayout()` in `components/ClientLayout.tsx` - Ensure proper mounting sequence

## [Classes]

No new classes required for this implementation.

The solution focuses on functional components and hooks following React best practices. All hydration-related logic will be implemented using custom hooks and utility functions rather than class-based components.

## [Dependencies]

No new external dependencies required.

The implementation uses existing Next.js and React patterns without requiring additional packages. All solutions leverage built-in Next.js router functionality and React hooks that are already available in the project.

## [Testing]

Comprehensive testing approach for hydration fixes.

**Test Files to Create:**
- `pickleglass_web/__tests__/hydration.test.ts` - Test hydration behavior
- `pickleglass_web/__tests__/clientOnly.test.ts` - Test client-only components

**Existing Test Modifications:**
- Update `pickleglass_web/__tests__/auth-flow.test.ts` - Add hydration scenarios
- Enhance `pickleglass_web/__tests__/firebase.test.ts` - Test SSR compatibility

**Manual Testing Strategy:**
- Test page refresh on `/login` route
- Verify Electron mode detection works correctly
- Confirm no hydration warnings in console
- Test with JavaScript disabled (graceful degradation)

## [Implementation Order]

Sequential implementation steps to minimize conflicts and ensure successful integration.

1. **Create Client-Side Detection Utilities**
   - Implement `hooks/useClientOnly.ts`
   - Create `components/ClientOnly.tsx`
   - Add `utils/clientUtils.ts`

2. **Update Authentication Utilities**
   - Modify `utils/auth.ts` to handle hydration state
   - Add client-side detection to auth hooks

3. **Fix Login Page Implementation**
   - Replace window object access in `app/login/page.tsx`
   - Implement proper URL parameter handling
   - Add loading states for hydration

4. **Update Layout Components**
   - Ensure `components/ClientLayout.tsx` handles hydration properly
   - Add fallback states for server-side rendering

5. **Implement Testing**
   - Create hydration-specific tests
   - Update existing auth flow tests
   - Add manual testing procedures

6. **Validation and Cleanup**
   - Test all scenarios (refresh, direct navigation, Electron mode)
   - Remove any remaining direct window object access
   - Verify no hydration warnings in console
