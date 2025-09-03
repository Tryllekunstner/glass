# Implementation Plan

## Overview

Transform the Pickle Glass application from a hybrid local/cloud system to a fully cloud-based architecture with Firebase as the primary backend, featuring a comprehensive web dashboard for all configuration and management tasks, and requiring mandatory authentication for all application access.

This implementation will completely remove the local database mode and all "guest" or "local user" options, making user authentication mandatory before accessing any part of the application. All data storage and user management will be handled through Firebase. The web dashboard will become the central hub for user account management, AI model configuration, conversation history, and profile/preset management. The Electron application will be simplified to focus purely on the user experience while requiring cloud authentication and syncing all configurations from the user's cloud profile.

The new architecture ensures data consistency across devices, enables better collaboration features, provides centralized user management, and prepares the application for scalable cloud deployment. Users must authenticate through the web dashboard before accessing any features, and the Electron app will inherit this authentication state, creating a seamless experience across both platforms while ensuring all activity and configurations are properly associated with authenticated users.

**Persistent Authentication**: The system will implement secure token storage and automatic re-authentication to provide a user-friendly experience where users remain logged in across application restarts and system reboots, eliminating the need for repeated login while maintaining security through token refresh and validation mechanisms.

## Types

Define comprehensive type system for cloud-first architecture with profile-based configuration management.

```typescript
// Core User Types
interface UserProfile {
  uid: string;
  display_name: string;
  email: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  preferences: UserPreferences;
}

interface UserPreferences {
  default_profile_id?: string;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  analytics_enabled: boolean;
}

// AI Profile/Preset Types
interface AIProfile {
  id: string;
  uid: string;
  name: string;
  description?: string;
  model_config: ModelConfiguration;
  prompt_settings: PromptSettings;
  is_default: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface ModelConfiguration {
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  model_name: string;
  api_key_encrypted?: string; // Encrypted API key for user's personal keys
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
}

interface PromptSettings {
  system_prompt: string;
  context_window_size: number;
  memory_enabled: boolean;
  custom_instructions?: string;
}

// Session and Activity Types
interface Session {
  id: string;
  uid: string;
  profile_id: string; // Links to AIProfile
  title: string;
  session_type: 'ask' | 'listen' | 'mixed';
  started_at: Timestamp;
  ended_at?: Timestamp;
  metadata: SessionMetadata;
  sync_state: 'synced' | 'pending' | 'error';
}

interface SessionMetadata {
  device_type: 'web' | 'electron';
  device_id: string;
  total_tokens_used: number;
  total_messages: number;
  duration_seconds: number;
}

// Dashboard State Types
interface DashboardState {
  current_user: UserProfile | null;
  selected_profile: AIProfile | null;
  available_profiles: AIProfile[];
  recent_sessions: Session[];
  loading_states: LoadingStates;
}

interface LoadingStates {
  user_loading: boolean;
  profiles_loading: boolean;
  sessions_loading: boolean;
  saving: boolean;
}

// Authentication Types
interface AuthState {
  user: UserProfile | null;
  is_authenticated: boolean;
  is_loading: boolean;
  error: string | null;
  auth_method: 'google' | 'email' | null;
  token_expires_at: number | null;
  refresh_token: string | null;
}

// Persistent Authentication Types
interface StoredAuthData {
  refresh_token: string;
  user_id: string;
  expires_at: number;
  auth_method: 'google' | 'email';
}

interface TokenRefreshResult {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

// Electron-specific Types
interface ElectronAuthRequest {
  type: 'auth_required' | 'profile_sync' | 'session_sync';
  user_id?: string;
  profile_id?: string;
}

interface ElectronAuthResponse {
  success: boolean;
  user_profile?: UserProfile;
  ai_profiles?: AIProfile[];
  error?: string;
}
```

## Files

Comprehensive file structure modifications to support cloud-first architecture with enhanced dashboard.

### New Files to Create:
- `pickleglass_web/app/dashboard/page.tsx` - Main dashboard landing page with overview
- `pickleglass_web/app/dashboard/layout.tsx` - Dashboard layout with navigation
- `pickleglass_web/app/profiles/page.tsx` - AI profile management interface
- `pickleglass_web/app/profiles/[id]/page.tsx` - Individual profile editor
- `pickleglass_web/app/activity/page.tsx` - Enhanced conversation history with filtering
- `pickleglass_web/app/models/page.tsx` - AI model configuration and API key management
- `pickleglass_web/app/analytics/page.tsx` - Usage statistics and insights
- `pickleglass_web/components/Dashboard/` - Dashboard-specific components directory
- `pickleglass_web/components/Dashboard/ProfileSelector.tsx` - Profile switching component
- `pickleglass_web/components/Dashboard/SessionCard.tsx` - Session display component
- `pickleglass_web/components/Dashboard/ModelConfigForm.tsx` - Model configuration form
- `pickleglass_web/components/Dashboard/UsageChart.tsx` - Analytics visualization
- `pickleglass_web/components/Auth/AuthGuard.tsx` - Authentication wrapper component
- `pickleglass_web/utils/profiles.ts` - AI profile management utilities
- `pickleglass_web/utils/encryption.ts` - Client-side encryption for API keys
- `pickleglass_web/utils/analytics.ts` - Usage tracking and analytics
- `pickleglass_web/utils/tokenStorage.ts` - Secure token storage and management
- `src/services/cloudSync.js` - Electron cloud synchronization service
- `src/services/profileManager.js` - Electron profile management
- `src/services/authManager.js` - Enhanced Electron authentication manager with persistent auth
- `src/services/tokenManager.js` - Electron secure token storage using keytar

### Files to Modify:
- `pickleglass_web/app/page.tsx` - Redirect to login if not authenticated, dashboard if authenticated
- `pickleglass_web/app/layout.tsx` - Add mandatory authentication context and dashboard navigation
- `pickleglass_web/app/login/page.tsx` - Remove "continue in local mode" option, enhance login UX
- `pickleglass_web/app/settings/page.tsx` - Remove local mode references, focus on account management
- `pickleglass_web/utils/auth.ts` - Enhanced authentication with profile loading, persistent auth, remove local fallbacks
- `pickleglass_web/utils/api.ts` - Remove all local mode code, focus exclusively on Firebase operations
- `pickleglass_web/utils/firebase.ts` - Add profile and analytics collections, token refresh handling
- `pickleglass_web/utils/firestore.ts` - Add profile and session management functions
- `pickleglass_web/components/Sidebar.tsx` - Update navigation for new dashboard structure
- `src/index.js` - Remove local database initialization, add mandatory authentication check
- `src/features/common/services/authService.js` - Cloud-only authentication, block app launch without auth
- `firestore.rules` - Add security rules for profiles and enhanced user data
- `functions/index.js` - Add profile management and analytics functions

### Files to Remove:
- `src/features/common/services/databaseInitializer.js` - No longer needed
- `src/features/common/repositories/` - Replace with cloud-only repositories
- `pickleglass_web/backend_node/` - Remove local API server entirely
- Local SQLite database files and related utilities

## Functions

Detailed function specifications for cloud-first architecture implementation.

### New Functions:
- `createAIProfile(uid: string, profileData: Partial<AIProfile>): Promise<string>` - Create new AI profile in Firestore
- `updateAIProfile(uid: string, profileId: string, updates: Partial<AIProfile>): Promise<void>` - Update existing profile
- `deleteAIProfile(uid: string, profileId: string): Promise<void>` - Delete profile and update user's default if needed
- `getUserProfiles(uid: string): Promise<AIProfile[]>` - Fetch all user's AI profiles
- `setDefaultProfile(uid: string, profileId: string): Promise<void>` - Set user's default profile
- `encryptApiKey(apiKey: string, userKey: string): Promise<string>` - Client-side API key encryption
- `decryptApiKey(encryptedKey: string, userKey: string): Promise<string>` - Client-side API key decryption
- `syncProfileToElectron(profileId: string): Promise<ElectronAuthResponse>` - Sync profile data to Electron app
- `trackUsageEvent(uid: string, event: AnalyticsEvent): Promise<void>` - Track user activity for analytics
- `generateUsageReport(uid: string, timeRange: TimeRange): Promise<UsageReport>` - Generate usage analytics
- `validateModelConfiguration(config: ModelConfiguration): ValidationResult` - Validate model settings
- `testModelConnection(config: ModelConfiguration): Promise<boolean>` - Test API connectivity
- `migrateLocalDataToCloud(localData: any): Promise<void>` - One-time migration utility
- `storeAuthTokens(authData: StoredAuthData): Promise<void>` - Securely store authentication tokens
- `retrieveAuthTokens(): Promise<StoredAuthData | null>` - Retrieve stored authentication tokens
- `refreshAuthToken(refreshToken: string): Promise<TokenRefreshResult>` - Refresh expired authentication tokens
- `clearStoredAuth(): Promise<void>` - Clear stored authentication data on logout
- `validateStoredAuth(authData: StoredAuthData): boolean` - Validate stored authentication data
- `autoReauthenticate(): Promise<boolean>` - Attempt automatic re-authentication on app start

### Modified Functions:
- `useAuth()` - Enhanced to load user profiles and preferences, handle persistent authentication
- `signIn()` - Load user profiles after authentication, store auth tokens securely
- `signUp()` - Create default profile for new users, store auth tokens securely
- `signOut()` - Clear stored authentication tokens and user data
- `getUserProfile()` - Include subscription and preference data
- `createSession()` - Associate with selected AI profile
- `getSessionDetails()` - Include profile information used
- `findOrCreateUser()` - Initialize with default AI profile

### Removed Functions:
- All local database functions (`apiCall`, local repository functions)
- Local API key storage functions
- Local session management functions
- Electron IPC handlers for local data

## Classes

Class structure modifications for cloud-first architecture with profile management.

### New Classes:
- `ProfileManager` (Electron) - Manages AI profile synchronization and selection
  - Methods: `syncProfiles()`, `selectProfile()`, `getCurrentProfile()`, `validateProfile()`
  - File: `src/services/profileManager.js`
- `CloudSyncService` (Electron) - Handles real-time synchronization with Firebase
  - Methods: `startSync()`, `stopSync()`, `syncUserData()`, `handleProfileChanges()`
  - File: `src/services/cloudSync.js`
- `AnalyticsTracker` (Web) - Tracks user interactions and usage patterns
  - Methods: `trackEvent()`, `trackSession()`, `generateReport()`, `exportData()`
  - File: `pickleglass_web/utils/analytics.ts`
- `EncryptionService` (Web) - Handles client-side encryption for sensitive data
  - Methods: `encrypt()`, `decrypt()`, `generateKey()`, `validateKey()`
  - File: `pickleglass_web/utils/encryption.ts`
- `TokenManager` (Electron) - Manages secure token storage and retrieval
  - Methods: `storeTokens()`, `retrieveTokens()`, `clearTokens()`, `validateTokens()`
  - File: `src/services/tokenManager.js`
- `PersistentAuthService` (Web) - Handles browser-based persistent authentication
  - Methods: `storeAuth()`, `retrieveAuth()`, `refreshAuth()`, `clearAuth()`
  - File: `pickleglass_web/utils/tokenStorage.ts`

### Modified Classes:
- `AuthService` (Electron) - Enhanced for cloud-only authentication with persistent auth
  - Remove local authentication methods
  - Add profile synchronization after authentication
  - Add real-time auth state monitoring
  - Add automatic re-authentication on app startup
  - Add secure token storage and refresh mechanisms
- `FirestoreUserService` (Web) - Extended for profile management
  - Add profile CRUD operations
  - Add user preference management
  - Add subscription tier handling
- `WindowManager` (Electron) - Updated for authentication-required flow
  - Add authentication check before window creation
  - Add profile selection interface
  - Handle authentication redirects

### Removed Classes:
- `DatabaseInitializer` - No longer needed for cloud-first approach
- All local repository classes (replaced with Firestore services)
- Local API server classes and middleware

## Dependencies

Package and dependency modifications for cloud-first architecture.

### New Dependencies:
- `@firebase/app-check` - Enhanced security for Firebase operations
- `crypto-js` - Client-side encryption for API keys
- `recharts` - Analytics visualization components
- `date-fns` - Date manipulation for analytics and filtering
- `react-hook-form` - Form management for profile configuration
- `zod` - Runtime type validation for configurations
- `react-query` - Data fetching and caching for dashboard
- `framer-motion` - Enhanced UI animations for dashboard

### Updated Dependencies:
- `firebase` - Ensure latest version with all required features
- `firebase-admin` - Update for enhanced security rules
- `next.js` - Ensure compatibility with new routing structure

### Removed Dependencies:
- `better-sqlite3` - No longer needed for local database
- `express` - Remove local API server dependencies
- `cors` - Not needed without local server
- All local database and API-related packages

## Testing

Comprehensive testing strategy for cloud-first architecture.

### New Test Files:
- `pickleglass_web/__tests__/profiles.test.ts` - AI profile management testing
- `pickleglass_web/__tests__/encryption.test.ts` - Client-side encryption testing
- `pickleglass_web/__tests__/analytics.test.ts` - Usage tracking and reporting tests
- `pickleglass_web/__tests__/dashboard.test.tsx` - Dashboard component testing
- `pickleglass_web/__tests__/auth-guard.test.tsx` - Authentication flow testing
- `src/__tests__/cloudSync.test.js` - Electron cloud synchronization testing
- `src/__tests__/profileManager.test.js` - Profile management testing

### Modified Test Files:
- `pickleglass_web/__tests__/firebase.test.ts` - Add profile and analytics testing
- `pickleglass_web/__tests__/auth.test.ts` - Update for cloud-only authentication
- Update all existing tests to remove local mode dependencies

### Testing Strategy:
- Unit tests for all new utility functions and services
- Integration tests for Firebase operations and data flow
- End-to-end tests for authentication flow between web and Electron
- Performance tests for dashboard loading and data synchronization
- Security tests for API key encryption and user data protection

## Implementation Order

Logical sequence of implementation to minimize conflicts and ensure successful integration.

1. **Phase 1: Firebase Infrastructure Setup**
   - Update Firestore security rules for new data structure
   - Create Firebase Functions for profile and analytics management
   - Set up new Firestore collections and indexes
   - Implement client-side encryption utilities

2. **Phase 2: Mandatory Authentication Implementation**
   - Remove all "local mode" and "continue without login" options
   - Implement mandatory authentication guards for all routes and features
   - Update Electron authentication to block app launch without cloud login
   - Enhance web authentication with profile loading and strict access control
   - Implement persistent authentication with secure token storage (keytar for Electron, secure browser storage for web)
   - Add automatic re-authentication on application startup
   - Add token refresh mechanisms to maintain user sessions
   - Test cross-platform authentication flow with mandatory user verification and persistent sessions

3. **Phase 3: Profile Management System**
   - Create AI profile data models and validation
   - Implement profile CRUD operations in Firestore
   - Build profile management UI components
   - Add profile synchronization to Electron app

4. **Phase 4: Dashboard Development**
   - Create new dashboard layout and navigation
   - Implement main dashboard page with overview
   - Build profile selector and management interfaces
   - Add conversation history with enhanced filtering

5. **Phase 5: Model Configuration Interface**
   - Create model configuration forms and validation
   - Implement API key encryption and storage
   - Add model testing and connectivity verification
   - Build usage analytics and reporting features

6. **Phase 6: Electron App Integration**
   - Remove local database dependencies from Electron
   - Implement cloud synchronization service
   - Add profile selection interface for Electron
   - Ensure real-time sync between web and Electron

7. **Phase 7: Data Migration and Cleanup**
   - Create migration utilities for existing users
   - Remove local mode code and dependencies
   - Update documentation and user guides
   - Perform comprehensive testing and bug fixes

8. **Phase 8: Analytics and Optimization**
   - Implement usage tracking and analytics
   - Add performance monitoring and optimization
   - Create user onboarding flow for new dashboard
   - Final security review and deployment preparation
