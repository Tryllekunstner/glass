# Implementation Plan

[Overview]
Build a robust, scalable multi-surface agent platform consisting of: (1) an Electron desktop app focused on data ingestion and agent interaction; (2) a Next.js + Express web “master dashboard” for configuration, auth, and orchestration; and (3) Firebase/GCP backends for auth, data, and deployment—designed to scale to 100,000 active users.

This plan aligns the current dual-app codebase into a clean architecture with secure auth handshakes between desktop and web, a single source of truth for settings (Firestore), strong environment handling for Firebase Admin and web runtime, and a Cloud Run + Firebase App Hosting deployment model. Phase 1 preserves the current deep-link login flow for speed, with security hardening; Phase 2 migrates to a device-friendly “auth code + PKCE” variant. The web app will own configuration and policy; the desktop app will subscribe to those settings and expose realtime capabilities (audio, STT, local models) coordinated via IPC and Firestore events. Regional configuration will default to europe-west1 for data residency considerations.

[Types]  
Introduce a cross-surface type system for users, organizations, devices, settings, agents, and sessions.

Type specifications (TypeScript-first; JSDoc on Electron side):
- UserProfile (users/{uid})
  - uid: string (required)
  - email: string (required, email)
  - displayName?: string
  - photoURL?: string (url)
  - orgId?: string (references orgs/{orgId})
  - roles?: string[] (enum values: ["owner","admin","member","guest"])
  - createdAt: Timestamp
  - updatedAt: Timestamp
  - lastLoginAt?: Timestamp
  - status: "active" | "suspended" | "deleted" (default "active")
  - validation:
    - email RFC-5322
    - roles subset-of enum
- Organization (orgs/{orgId})
  - id: string
  - name: string
  - plan: "free" | "pro" | "enterprise"
  - region: string (default "europe-west1")
  - settings: OrgSettings
  - createdAt: Timestamp
  - updatedAt: Timestamp
- OrgSettings
  - defaultLanguage: string (BCP-47, e.g., "nb-NO" | "en-US")
  - dataRetentionDays: number (min 1, max 3650)
  - allowedProviders: string[] (e.g., ["openai","anthropic","google","local"])
- Device (devices/{deviceId})
  - id: string
  - uid: string (FK to users/{uid})
  - type: "desktop" | "mobile"
  - platform: "win" | "mac" | "linux" | "ios" | "android"
  - appVersion: string (semver)
  - lastSeenAt: Timestamp
  - status: "online" | "offline" | "blocked"
  - displayName?: string
- AppSettings (users/{uid}/settings/app)
  - language: string (BCP-47)
  - theme: "light" | "dark" | "system"
  - voiceInputEnabled: boolean
  - telemetryEnabled: boolean
  - preferredAgentId?: string
  - updatedAt: Timestamp
- AgentConfig (agentConfigs/{id})
  - id: string
  - uid: string (creator)
  - orgId?: string
  - name: string
  - type: "ask" | "listen" | "custom"
  - modelProvider: "openai" | "anthropic" | "google" | "local"
  - modelId: string
  - temperature?: number (0..2)
  - maxTokens?: number
  - systemPrompt?: string
  - tools?: string[] (ids)
  - active: boolean
  - updatedAt: Timestamp
- Session (sessions/{sessionId})
  - id: string
  - uid: string
  - type: "ask" | "listen" | "chat"
  - agentId?: string
  - startedAt: Timestamp
  - endedAt?: Timestamp
  - status: "active" | "completed" | "error"
  - meta?: Record<string, any>

[Files]
File modifications span both apps to unify auth, settings sync, and deployment.

New files to be created:
- docs/ARCHITECTURE.md
  - Purpose: Diagrams and narrative of the three-tier architecture, auth flows (Phase 1 and Phase 2), data model, and deployment topology.
- pickleglass_web/types/domain.ts
  - Purpose: Export the TS interfaces above for the web app (UserProfile, Organization, Device, AppSettings, AgentConfig, Session).
- pickleglass_web/lib/firestore-schema.md
  - Purpose: Document Firestore collections, indexes, and security rule expectations for production scale.
- pickleglass_web/app/api/device/register/route.ts
  - Purpose: Secure server route to register/update a device document on first desktop contact.
- pickleglass_web/app/api/settings/get/route.ts, pickleglass_web/app/api/settings/update/route.ts
  - Purpose: Fetch and update AppSettings with validation; ensures server-side auth required.
- pickleglass_web/app/api/agent-configs/[id]/route.ts (GET/PUT/DELETE), pickleglass_web/app/api/agent-configs/route.ts (POST/GET)
  - Purpose: CRUD for AgentConfig with role checks.
- pickleglass_web/lib/validation.ts
  - Purpose: Zod schemas (or lightweight custom validators) to validate incoming payloads for the new routes.
- pickleglass_web/lib/device.ts
  - Purpose: Device registration helpers and Firestore DAO.
- pickleglass_web/lib/settings.ts
  - Purpose: Settings DAO and merging logic (org + user).
- pickleglass_web/lib/agent-configs.ts
  - Purpose: Agent configuration DAO with permissions.
- pickleglass_web/server/utils/token-exchange.js
  - Purpose: Server-side helper to call Cloud Function for custom token exchange (fallback if needed).
- pickleglass_web/server/utils/deep-link.ts (or .js)
  - Purpose: Helpers for generating deep-link URIs safely with nonce/csrf token (Phase 1).
- functions/deviceCode.ts (Phase 2)
  - Purpose: HTTPS Callable for “device code” login flow (auth code + PKCE-like) to replace raw ID token deep link later.

Existing files to be modified:
- apphosting.yaml
  - Update region to europe-west1, min instances, concurrency, CPU/memory, health checks, and static env injection.
- firebase.json
  - Ensure Functions v2 region europe-west1; hosting config remains disabled if using App Hosting only.
- firestore.rules
  - Enforce RBAC and document-level security for users, orgs, settings, agent configurations, and sessions.
- pickleglass_web/server.js
  - Keep Express-first auth; add routes mount points (/api/*); add health and diagnostics; wire new libs; ensure fast startup flags don’t block auth for public routes.
- pickleglass_web/server/middleware/auth.js
  - Security hardening: enforce CSRF/external deep-link validation response headers; add nonce propagation for Phase 1 flow.
- pickleglass_web/server/middleware/routes.js
  - Add protection config for new /api routes; tweak PUBLIC/PROTECTED route lists.
- pickleglass_web/utils/config.ts
  - Harden project ID resolution, ensure europe-west1 defaults; reduce logs in production.
- pickleglass_web/lib/firebase-admin.ts
  - Keep lazy-init; add explicit region awareness and improved error reporting.
- src/features/common/services/authService.js
  - Phase 1: add nonce handling for deep link; keep current custom-token sign-in; broadcast auth state.
  - Phase 2: support device-code flow (poll Cloud Function) while still supporting Phase 1 behind a feature flag.
- src/index.js
  - Validate deep-link params (scheme, host, nonce, token length); rate-limit processing; improved logging and error paths; ensure safe focus behavior; add fallback retry.
- pickleglass_web/backend_node/**
  - Mount any additional IPC-backed endpoints only if required; keep them minimal; prefer Firestore flows for sync.
- pickleglass_web/next.config.js
  - Maintain SSR; enable split chunks; ensure europe-west1 region via env; keep external packages list.
- pickleglass_web/package.json
  - Add zod (or valibot) if chosen; add @google-cloud/logging (optional) for structured logs; keep Jest.
- functions/index.js
  - Keep pickleGlassAuthCallback; add CORS/region hardening; optionally add deviceCode endpoints in functions/deviceCode.ts in Phase 2.

Files to be deleted or moved:
- None immediately; Phase 2 may replace Phase 1 deep-link helper with device-code modules.

Configuration file updates:
- .env.* (web): Ensure NEXT_PUBLIC_*, FIREBASE_CONFIG or FIREBASE_WEBAPP_CONFIG, plus REGION=europe-west1, FAST_STARTUP flags only for development.
- pickleglass_web/.env.production, pickleglass_web/.env.apphosting: Ensure secrets only via Firebase/Cloud run env; do not commit secrets.
- electron package.json.electron: keep dependencies aligned; avoid bundling server credentials; add feature flag for device-code rollout.

[Functions]
Functions expand across server (Express routes), Firebase Functions, and Electron services.

New functions (name, signature, file, purpose):
- registerDevice (POST /api/device/register)
  - File: pickleglass_web/app/api/device/register/route.ts
  - Signature: async function POST(req: NextRequest)
  - Purpose: Upsert device doc with uid + device metadata; returns server time.
- getSettings (GET /api/settings/get)
  - File: pickleglass_web/app/api/settings/get/route.ts
  - Purpose: Returns merged settings (org + user) for authenticated user.
- updateSettings (PUT /api/settings/update)
  - File: pickleglass_web/app/api/settings/update/route.ts
  - Purpose: Validate and update AppSettings; write to users/{uid}/settings/app; returns updated doc.
- listAgentConfigs, createAgentConfig, getAgentConfig, updateAgentConfig, deleteAgentConfig
  - Files: pickleglass_web/app/api/agent-configs/*.ts
  - Purpose: CRUD with RBAC and validation (user must be owner or org-permitted).
- generateDeepLink (server helper)
  - File: pickleglass_web/server/utils/deep-link.ts
  - Signature: function generateDeepLink(params): string
  - Purpose: Build pickleglass:// URI with nonce and minimal payload (Phase 1).
- verifyNonceAndExchange (desktop)
  - File: src/features/common/services/authService.js
  - Purpose: Ensure the nonce matches before exchanging ID token for custom token.
- pickleGlassDeviceCodeStart, pickleGlassDeviceCodePoll (Phase 2)
  - Files: functions/deviceCode.ts
  - Purpose: Device code grant: desktop shows code; user logs in on web; desktop polls for custom token.

Modified functions:
- authenticateRequest (pickleglass_web/server/middleware/auth.js)
  - Changes: Add headers to mark auth state; integrate nonce validations when applicable; log correlation IDs.
- performAuthenticationWithFallback / performGracefulDegradation
  - Ensure public routes remain fast even if Admin init is deferred.
- src/index.js protocol handlers
  - Harden URL parsing; validate scheme/host; throttle; strict error handling when tokens invalid/expired.
- authService.signInWithCustomToken
  - Ensure centralizes broadcast and consistent state for all windows; add telemetry guard.

Removed functions:
- None in Phase 1. Phase 2 may deprecate direct ID-token deep link handling once device-code is stable.

[Classes]
Introduce light service classes and use existing ones coherently.

New classes:
- SettingsService (web) [functional module vs class acceptable]
  - File: pickleglass_web/lib/settings.ts
  - Methods: getMergedSettings(uid), updateSettings(uid, patch)
- DeviceRegistry (web)
  - File: pickleglass_web/lib/device.ts
  - Methods: register(uid, device), touch(deviceId), getByUser(uid)
- AgentConfigDAO (web)
  - File: pickleglass_web/lib/agent-configs.ts
  - Methods: list(uid|orgId), create(dto), get(id), update(id, patch), remove(id)

Modified classes:
- AuthenticationService (pickleglass_web/server/utils/firebase-admin.js)
  - Ensure region-aware logs; resilient init; better health check integration.

Removed classes:
- None.

[Dependencies]
Add minimal, targeted packages to support validation and optional logging.

- Web (pickleglass_web/package.json)
  - Add: zod ^3.x (or valibot) for payload validation
  - Optional: @google-cloud/logging for structured logs (prod only)
- Functions (functions/package.json)
  - If adding device-code: none required beyond firebase-admin/functions; or add uuid
- Electron app
  - No new external deps required for Phase 1; Phase 2 may require tiny code module for device-code polling timers.

Deployment recommendation (based on 100k active users):
- Use Firebase App Hosting with Cloud Run backend (current repo direction), region europe-west1:
  - Pros: Managed SSL, CDN, tight Firebase integration, deploy simplicity, scale-to-zero avoided with min instances.
  - Configure Cloud Run concurrency (e.g., 80–200), min instances (e.g., 1–3), CPU (1–2), memory (1–2GiB), request timeout (60s), and health check endpoints (/health).
  - Ensure Firestore and Functions in europe-west1 to minimize cross-region latency and support EU residency goals.
- Alternative: Direct Cloud Run (no App Hosting)
  - Pros: Slightly more control on traffic splitting and revision management; Cons: You’ll need to manage CDN/SSL.
- Recommendation: Stay with Firebase App Hosting + Cloud Run backend for faster iteration and built-in Firebase features. We’ll document a migration path to direct Cloud Run if required later.

[Testing]
Adopt a layered test strategy with Jest (existing) and optional Playwright later.

- Unit tests
  - Validation (zod) for settings, device, agent-configs
  - Auth middleware logic (mock Admin verify)
  - Route guards in routes.js
- Integration tests
  - API routes: /api/settings/*, /api/agent-configs/*, /api/device/register with mocked Firebase Admin
- E2E (Phase 2 candidate)
  - Playwright: login flow (web), settings update reflected in desktop (simulated via Firestore emulator + mock IPC)
- Load testing
  - K6 or Artillery against /server-info and a couple of API endpoints to size Cloud Run concurrency.

[Implementation Order]
Proceed in small, verifiable steps to keep the app runnable at all times.

1) Deployment & Environment Baseline
   - Set region defaults to europe-west1 across Functions, Firestore, App Hosting.
   - Tighten apphosting.yaml (min instances, concurrency, health checks).
   - Verify server health endpoints.
2) Firestore Schema & Rules
   - Document schema and write/update firestore.rules for RBAC and document-level constraints.
   - Add necessary composite indexes in firestore.indexes.json if needed later.
3) Web Auth Hardening (Phase 1)
   - Keep Express-first auth; add nonce and safe deep-link helpers; enhance auth middleware logs and headers.
   - Ensure /api/auth/session routes remain stable.
4) Settings Source of Truth
   - Implement /api/settings/get and /api/settings/update with validation and DAO.
   - Desktop: listen for users/{uid}/settings/app snapshots and apply live.
5) Device Registration
   - Implement /api/device/register; desktop registers on boot and heartbeats via lastSeenAt.
6) Agent Configuration CRUD
   - Implement /api/agent-configs endpoints; add UI wiring later.
7) Desktop Auth Flow Hardening
   - Harden deep-link processing in src/index.js and authService.js; add nonce verification.
   - Logging, error paths, and safe retry.
8) Backend Observability
   - Add structured logs; ensure health/status endpoints produce useful diagnostics in prod.
9) Scale & Performance Tweaks
   - Cloud Run concurrency/min instances; Next webpack chunking (already present); guard against heavy SSR pages.
10) Phase 2 (optional, post-stabilization)
   - Introduce device-code grant via Functions; move away from raw ID token deep links; feature-flag rollout.
