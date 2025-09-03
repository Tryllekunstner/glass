# Implementation Plan

## Overview
Fix white text on white background issue in email/password login form input fields by adding explicit text color classes and handling browser autofill styling.

The issue occurs in light mode where input fields in the EmailPasswordForm component lack explicit text color styling, causing white text to appear on white backgrounds. This makes the form unusable as users cannot see what they're typing. The solution involves adding explicit text color classes to all input fields and ensuring proper contrast in all states including browser autofill scenarios.

## Types
No new type definitions required for this styling fix.

The existing TypeScript interfaces and types in the EmailPasswordForm component (LoginFormData, SignupFormData, EmailPasswordFormProps) remain unchanged as this is purely a CSS styling issue.

## Files
Modify existing component file to add explicit text styling classes.

**Files to be modified:**
- `pickleglass_web/components/EmailPasswordForm.tsx` - Add explicit text color classes to all input elements
- `pickleglass_web/app/globals.css` - Add CSS rules to handle browser autofill styling and ensure proper text contrast

**No new files needed** - This is a styling fix for existing components.

## Functions
No function signature changes required for this styling fix.

The existing functions in EmailPasswordForm.tsx (handleLoginSubmit, handleSignupSubmit, toggleMode) remain unchanged. Only the JSX className attributes for input elements will be modified to include explicit text color classes.

## Classes
No new classes or class modifications required for this styling fix.

The existing React functional component structure remains the same. Only the className props on input elements will be updated to include explicit text color styling.

## Dependencies
No new dependencies required for this styling fix.

The existing dependencies (React, Tailwind CSS, Lucide React icons) are sufficient. The fix uses existing Tailwind utility classes for text colors.

## Testing
Manual testing approach to verify text visibility in form inputs.

**Testing requirements:**
- Test email and password input fields in both login and signup modes
- Verify text is visible when typing manually
- Test browser autofill scenarios to ensure text remains visible
- Check placeholder text visibility
- Verify error state styling still works correctly
- Test focus states and hover states

**No automated tests needed** - This is a visual styling fix that requires manual verification.

## Implementation Order
Sequential styling fixes to ensure consistent text visibility across all form inputs.

1. **Add explicit text color classes to login form inputs** - Update email and password input fields in the login section with `text-gray-900` class
2. **Add explicit text color classes to signup form inputs** - Update display name, email, password, and confirm password fields in signup section with `text-gray-900` class  
3. **Add browser autofill CSS rules** - Add CSS rules in globals.css to handle browser autofill styling and ensure text remains visible
4. **Test all input states** - Manually verify text visibility in normal, focus, error, and autofill states
5. **Verify form functionality** - Ensure all form interactions still work correctly after styling changes
