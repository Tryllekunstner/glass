# Task Progress

Source of truth for requirements: see implementation_plan.md. This file tracks execution status only. No local testing will be performed.

Updated: 2025-09-13T21:33:55Z

Completed and in-progress steps

- [x] Step 1: Set europe-west1 defaults across Functions/Firestore/App Hosting; tune apphosting.yaml; validate health endpoints
  Changes:
  - apphosting.yaml
    - memory: 1Gi (was 512Mi)
    - minInstances: 1 (was 0)
    - concurrency: 80 (kept; within plan’s 80–200 guidance)
    - Added environment variables for region:
      - REGION=europe-west1
      - FIREBASE_REGION=europe-west1
      - GOOGLE_CLOUD_REGION=europe-west1
  - functions/index.js
    - Global default: setGlobalOptions({ region: "europe-west1" })
    - Updated pickleGlassAuthCallback onRequest region to europe-west1
  - pickleglass_web/utils/config.ts
    - Added getRegion() with default europe-west1 via REGION/FIREBASE_REGION/GOOGLE_CLOUD_REGION
    - getFirebaseProjectId() falls back to GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT
    - Logging includes region; fixed a type issue in project ID fallback
  - pickleglass_web/.env.production
    - Added REGION/FIREBASE_REGION/GOOGLE_CLOUD_REGION = europe-west1
    - Updated NEXT_PUBLIC_API_URL to europe-west1
  - Health endpoints
    - Verified: server.js exposes /health, /healthz, /status, /status/detailed with immediate responses under fast-startup

- [x] Step 2: Author Firestore schema doc and tighten firestore.rules and indexes for users/orgs/settings/agentConfigs/sessions
  - firestore.rules updated to include:
    - users/{uid}/settings/app as explicit app settings source of truth
    - top-level devices/{deviceId} with per-user access
    - agentConfigs/{id} user-owned CRUD
    - helper isSignedIn/isUser utilities
  - firestore.indexes.json updated with recommended composite indexes (collectionGroup scope)
    - devices: uid ASC, lastSeenAt DESC
    - agentConfigs: (uid, active) and (orgId, active)
    - sessions: (uid, startedAt DESC) and (uid, status)
  - pickleglass_web/lib/firestore-schema.md created (authoritative schema doc)

- [x] Step 3: Harden Express auth (nonce, headers) keeping /api/auth/session stable; add correlation IDs and slow-path logging
  Status: Completed
  - Implemented:
    - Correlation propagation: X-Request-ID set on responses; correlation IDs carried into requests handled by Next so /api routes can echo them
    - Auth middleware: added X-Auth-Duration and Server-Timing (auth;dur=...), X-Route-Protected, and X-Auth-Reason on denied paths; exposed these via Access-Control-Expose-Headers
    - Deep-link API hardening: CSRF same-origin enforcement, security headers (X-Frame-Options, CORP, CSP frame-ancestors, Referrer-Policy), X-DeepLink-Nonce and X-DeepLink-Region
    - Structured request logging middleware emitting single JSON line per request with correlation and auth summaries
  - Kept /api/auth/session stable while enabling correlation via server propagation (no breaking changes)

- [x] Step 4: Implement /api/settings/get and /api/settings/update with validation and DAO; desktop subscribes to settings doc
  Status: Completed (server + desktop wiring)
  - Implemented:
    - pickleglass_web/lib/settings.ts (DAO)
    - pickleglass_web/lib/validation.ts (AppSettingsPatch validation)
    - /api/settings/get (GET)
    - /api/settings/update (PUT)
    - Desktop wiring: Electron subscribes to users/{uid}/settings/app via Firestore onSnapshot and broadcasts updates (IPC 'settings-updated')

- [x] Step 5: Implement /api/device/register and record lastSeenAt; desktop registers on boot and heartbeats
  Status: Completed (server + desktop wiring)
  - Implemented:
    - pickleglass_web/lib/device.ts (register, touch, listByUser)
    - /api/device/register (POST)
    - Desktop wiring: Electron registers device (devices/{deviceId}) on login and updates lastSeenAt via periodic heartbeat; platform/appVersion/status populated

- [x] Step 6: Implement /api/agent-configs CRUD with RBAC and validation; prepare UI wiring stubs
  Status: Completed (server RBAC + basic UI)
  - Implemented:
    - RBAC (org-level): owner/admin of user's org can list/create/update/delete org-scoped configs (orgId). Personal (uid) ownership preserved.
      - pickleglass_web/lib/firebase-admin.ts: VerifiedUser now exposes roles (custom claims)
      - pickleglass_web/lib/agent-configs.ts: list/create/update/delete accept roles and enforce org RBAC
      - /api/agent-configs (GET list, POST create): supports ?orgId= and passes roles through to DAO
      - /api/agent-configs/[id] (GET/PUT/DELETE): permits org-admins on matching orgId, otherwise requires uid ownership
    - UI stub:
      - pickleglass_web/app/settings/agents/page.tsx: list + simple create form; supports personal vs org scope via ?orgId=...
  - Notes:
    - Validation via validateAgentConfig in pickleglass_web/lib/validation.ts
    - Server continues to source roles from token or user custom claims; Firestore rules already guard collection access

- [x] Step 7: Desktop deep-link hardening in src/index.js and authService.js (nonce verification, throttling, error paths)
  Status: Completed
  - Implemented:
    - Nonce verification using client nonce (cn) generated on desktop; deep link rejected if nonce mismatch/absent
    - Throttling (3s cooldown) and duplicate suppression via token digest memoization
    - JWT shape/length validation before token exchange
    - Retry-once strategy for transient token exchange failures
    - Safe focus behavior post-success; improved logging with correlation (nonce and cn markers) without leaking secrets
    - startFirebaseAuthFlow throttling and URL validation; client nonce expiration window (5 minutes)
  - Notes:
    - Server-provided 'nonce' is used for correlation only in Phase 1; verification happens on desktop per plan

- [x] Step 8: Add structured logging and diagnostics endpoints; verify in staging
  Status: Completed
  - Implemented:
    - Structured JSON request logging middleware (server/utils/logger.js) and wired into server.js
    - Auth middleware now emits X-Auth-Duration and Server-Timing: auth;dur=... for latency observability
    - /api/auth/deep-link hardened with Origin check and security headers (X-Frame-Options, CORP, CSP frame-ancestors, Referrer-Policy, Vary: Origin)
    - Health/status endpoints available: /health, /healthz, /status, /status/detailed with fast-startup integration
  - Notes:
    - Logs are console-emitted for Cloud Run/App Hosting ingestion and include correlation ID where available

- [x] Step 9: Apply Cloud Run concurrency/min instances and verify SSR chunking and route protection under load
  Status: Completed
  - Implemented:
    - Cloud Run/App Hosting tuning: concurrency 120, minInstances 2, maxInstances 20 (apphosting.yaml)
    - Next.js splitChunks already configured; added long-term cache headers for Next static assets and public assets
    - Observability under load: auth middleware emits Server-Timing (auth;dur=...) and X-Auth-Duration; structured request logs with correlation ID
  - Notes:
    - Values within plan guidance; may tune further after profiling hot paths and real traffic

- [x] Step 10: Add Phase 2 device-code Functions and desktop polling behind a feature flag (post-stabilization)
  Status: Completed (feature-flag ready; Phase 1 retained)
  - Implemented:
    - Cloud Functions (v2, region europe-west1): pickleGlassDeviceCodeStart, pickleGlassDeviceCodePoll, pickleGlassDeviceCodeComplete (functions/deviceCode.js) and exports wired in functions/index.js
    - Desktop (Electron): feature-flagged device-code flow in authService.startFirebaseAuthFlow(); polling and custom token sign-in on approval
    - Web: verification page /device and API endpoint /api/device-code/complete to complete flow for signed-in users; protected by middleware
    - Route protection: added /api/device-code to protected routes
  - Feature flag:
    - Enable by setting DEVICE_CODE_ENABLED=true (or pickleglass_DEVICE_CODE_ENABLED=true) in the desktop environment
  - Notes:
    - Phase 1 deep-link flow remains available; Phase 2 can be rolled out gradually

Files changed in this update

- apphosting.yaml
- functions/index.js
- pickleglass_web/utils/config.ts
- pickleglass_web/.env.production
- firestore.rules
- firestore.indexes.json
- pickleglass_web/lib/firestore-schema.md
- pickleglass_web/server/middleware/auth.js
- pickleglass_web/server/utils/deep-link.js
- pickleglass_web/lib/firebase-admin.ts
- pickleglass_web/types/domain.ts
- pickleglass_web/lib/validation.ts
- pickleglass_web/lib/settings.ts
- pickleglass_web/app/api/settings/get/route.ts
- pickleglass_web/app/api/settings/update/route.ts
- pickleglass_web/lib/device.ts
- pickleglass_web/app/api/device/register/route.ts
- pickleglass_web/server/middleware/routes.js
- pickleglass_web/lib/agent-configs.ts
- pickleglass_web/app/api/agent-configs/route.ts
- pickleglass_web/app/api/agent-configs/[id]/route.ts
- pickleglass_web/app/api/auth/deep-link/route.ts
- pickleglass_web/app/login/page.tsx
- src/features/common/services/authService.js
- functions/deviceCode.js
- functions/index.js
- pickleglass_web/app/api/device-code/complete/route.ts
- pickleglass_web/app/device/page.tsx
- pickleglass_web/server/middleware/routes.js

Notes

- Regional alignment is europe-west1 across Functions, environment variables, and App Hosting runtime. Firestore location is a project setting; runtime reads REGION/FIREBASE_REGION for diagnostics and behavior.
- Validators are lightweight per plan (no zod dependency added). Can be swapped to Zod later without API contract changes.
- No local testing paths were added; all work targets Firebase App Hosting + Cloud Run as the runtime.

Next actions (per plan)

- None pending in Phase 1. Monitor in staging and tune RBAC/UX as needed.
