# Implementation Plan

## Overview
Transform the pickleglass web application into a Reetreev-branded application with improved authentication flow, optimized performance, and streamlined desktop download functionality.

This implementation addresses frontend performance issues, rebrands from Pickle to Reetreev, implements proper authentication-gated access to the sidebar, removes unnecessary UI elements, and adds smooth desktop application download functionality. The changes will create a more cohesive user experience with proper login flow and brand consistency.

## Types
Define new branding and authentication-related type definitions.

**Brand Configuration Types:**
```typescript
interface BrandConfig {
  name: string;
  displayName: string;
  protocol: string;
  logoSymbol: string;
  logoWord: string;
  websiteUrl: string;
}

interface DownloadConfig {
  enabled: boolean;
  platforms: {
    windows: {
      url: string;
      filename: string;
    };
    mac: {
      url: string;
      filename: string;
    };
    linux?: {
      url: string;
      filename: string;
    };
  };
}
```

**Authentication State Types:**
```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  showSidebar: boolean;
}
```

## Files
Modify existing files and create new configuration files for branding and download functionality.

**Files to Modify:**
- `pickleglass_web/app/layout.tsx` - Update metadata and title
- `pickleglass_web/app/page.tsx` - Update branding references and dashboard content
- `pickleglass_web/components/ClientLayout.tsx` - Add authentication-gated sidebar rendering
- `pickleglass_web/components/Sidebar.tsx` - Remove unwanted links, update branding, add desktop download
- `pickleglass_web/utils/auth.ts` - Enhance authentication state management
- `pickleglass_web/utils/api.ts` - Update localStorage keys and branding references
- `pickleglass_web/app/login/page.tsx` - Update deep link protocol
- `pickleglass_web/app/settings/privacy/page.tsx` - Update external links
- `pickleglass_web/app/download/page.tsx` - Update download page content
- `pickleglass_web/app/help/page.tsx` - Update help content references
- `package.json` - Update product name, description, and keywords
- `electron-builder.yml` - Update app ID, product name, and protocol scheme

**Files to Create:**
- `pickleglass_web/config/brand.ts` - Centralized branding configuration
- `pickleglass_web/config/download.ts` - Download configuration and logic
- `pickleglass_web/public/reetreev-symbol.svg` - Placeholder symbol logo
- `pickleglass_web/public/reetreev-word.svg` - Placeholder word logo
- `src/ui/assets/reetreev-logo.ico` - Placeholder Windows icon
- `src/ui/assets/reetreev-logo.icns` - Placeholder macOS icon

## Functions
Create new utility functions and modify existing ones for branding and download functionality.

**New Functions:**
- `getBrandConfig()` - Returns current brand configuration
- `getDownloadUrl(platform: string)` - Returns appropriate download URL for platform
- `detectUserPlatform()` - Detects user's operating system
- `initiateDownload(platform: string)` - Handles desktop app download
- `createPlaceholderLogo(type: 'symbol' | 'word')` - Generates placeholder SVG logos

**Modified Functions:**
- `useAuth()` - Add sidebar visibility state management
- `setUserInfo()` - Update localStorage key to use Reetreev branding
- `logout()` - Clear Reetreev-specific storage keys
- `checkApiKeyStatus()` - Remove or modify to exclude "local running" status

## Classes
Update existing component classes and create new ones for enhanced functionality.

**Modified Classes:**
- `ClientLayout` - Add authentication-aware sidebar rendering
- `Sidebar` - Remove unwanted navigation items, add download functionality
- `AuthProvider` - Enhanced state management for sidebar visibility

**New Classes:**
- `DownloadManager` - Handles desktop application downloads
- `BrandProvider` - Provides branding context throughout the application
- `PlaceholderLogoGenerator` - Creates temporary logo assets

## Dependencies
Add new packages for enhanced download functionality and remove unused dependencies.

**New Dependencies:**
```json
{
  "ua-parser-js": "^1.0.37",
  "file-saver": "^2.0.5"
}
```

**Configuration Updates:**
- Update electron-builder configuration for new branding
- Update Firebase hosting configuration if needed
- Update any CI/CD configurations for new product name

## Testing
Update existing tests and create new ones for authentication flow and download functionality.

**Test File Updates:**
- `pickleglass_web/__tests__/firebase.test.ts` - Update branding references
- Create `pickleglass_web/__tests__/auth-flow.test.ts` - Test authentication-gated sidebar
- Create `pickleglass_web/__tests__/download.test.ts` - Test download functionality
- Create `pickleglass_web/__tests__/branding.test.ts` - Test brand configuration

**Test Scenarios:**
- Unauthenticated users cannot see sidebar
- Authenticated users see proper sidebar with Reetreev branding
- Download functionality works across different platforms
- All Pickle references are replaced with Reetreev
- Deep linking works with new protocol scheme

## Implementation Order
Sequential steps to minimize conflicts and ensure successful integration.

1. **Create Brand Configuration** - Set up centralized branding system
2. **Generate Placeholder Assets** - Create temporary logo files
3. **Update Authentication Flow** - Implement sidebar gating logic
4. **Update Branding References** - Replace all Pickle references with Reetreev
5. **Remove Unwanted UI Elements** - Clean up sidebar and remove specified items
6. **Implement Download Functionality** - Add desktop app download feature
7. **Update Electron Configuration** - Modify build and protocol settings
8. **Update Tests** - Ensure all functionality works correctly
9. **Performance Optimization** - Address frontend performance issues
10. **Final Testing and Validation** - Comprehensive testing of all changes
