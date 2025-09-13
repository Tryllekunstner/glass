# Implementation Plan

[Overview]
Consolidate deployment to Firebase App Hosting, validate server configuration, and streamline developer/deployment experience while adding a few UX improvements.

This codebase is already optimized for Firebase App Hosting (Cloud Run under the hood): hosting is disabled in firebase.json, apphosting.yaml is present with fast-startup tuning, and pickleglass_web/server.js is a custom Express/Next server instrumented for Cloud Run. The plan finalizes a single-platform deployment path (Firebase App Hosting), adds missing root scripts, documents runtime/env setup, and proposes low-risk UX enhancements that improve perceived reliability during cold starts and authentication initialization. If you later prefer Vercel or standalone Cloud Run, this plan also outlines the exact deltas to switch cleanly.

[Types]  
No type system changes required.

The Next.js app already uses TypeScript in the app/ tree and types/ folder. This plan does not introduce or modify TypeScript interfaces. Optional future work (not in scope here) could add explicit types for auth headers and health responses if desired.

[Files]
Minor file modifications and developer scripts, plus optional UX pages.

- New files to be created
  - pickleglass_web/app/startup/page.tsx
    - Purpose: User-friendly “Starting up…” page to replace inline HTML during graceful degradation (when auth initializes on cold start).
  - pickleglass_web/app/unauthorized/page.tsx
    - Purpose: Friendly unauthorized page referenced by auth middleware for insufficient permissions.

- Existing files to be modified
  - package.json (root)
    - Add scripts for building, validating, deploying, and local emulation against Firebase App Hosting.
  - pickleglass_web/server/middleware/auth.js
    - Change graceful degradation browser behavior to redirect to /startup (instead of returning inline HTML) for better UX, while keeping API behavior (503 JSON) intact.
  - apphosting.yaml
    - No required changes; document required envs and optional tweaks (minInstances/region) in comments only.
  - firebase.json
    - Keep hosting disabled. No changes required; ensure only functions/firestore are configured.
  - docs/ (optional)
    - Create or update a short docs/DEPLOYMENT_OVERVIEW.md that mirrors DEPLOYMENT_GUIDE.md with one-page instructions for new contributors (optional).

- Files to be deleted or moved
  - None required. If vercel config files are found later (vercel.json, .vercel), remove them to enforce single-platform deployment.

- Configuration file updates
  - .firebaserc
    - Confirm default project set (current: getseerai). No code change; document that deploy scripts will target this project unless overridden via CLI.
  - Environment variables (managed in Firebase Console for App Hosting)
    - Document required NEXT_PUBLIC_FIREBASE_* and service account settings for Admin SDK; keep secrets out of repo.

[Functions]
No server algorithmic changes; only routing/UX refinements.

- New functions
  - None.

- Modified functions
  - pickleglass_web/server/middleware/auth.js
    - performGracefulDegradation(req,res,next):
      - For browser requests (non-API) on protected routes while initializing, replace inline 503 HTML with 302 redirect to /startup, preserving existing API 503 JSON behavior and headers.
    - This reduces initial friction during Cloud Run cold starts and matches the app directory UX.
  - pickleglass_web/server.js
    - No logic change required; server already exposes /health, /healthz, /status and /server-info and is tuned for Cloud Run fast startup.

- Removed functions
  - None.

[Classes]
No class changes.

- New classes
  - None.

- Modified classes
  - None.

- Removed classes
  - None.

[Dependencies]
Minimal dependency changes for cross-platform scripts only.

- Add (root):
  - cross-env (devDependency) to make scripts portable on Windows/macOS/Linux when setting NODE_ENV.
- No changes to runtime deps of the Next.js app; it already includes express, helmet, compression, express-rate-limit, firebase, firebase-admin, next 14, etc.

[Testing]
Expand existing Jest + add deploy validation and smoke checks.

- Unit/Integration (existing)
  - Continue to run pickleglass_web Jest tests.
- Validation scripts
  - Use existing server-side-validation.js and validate-deployment.js (present at repo root) via new npm scripts.
- Runtime smoke tests (local and after deploy)
  - Confirm 200 on /health and /server-info.
  - Confirm 503 JSON for protected API paths during init when auth is not ready.
  - Confirm 302 to /startup on protected browser paths when auth is initializing (after the middleware change).
- Manual checks
  - Confirm App Hosting deployment completes for project .firebaserc: default getseerai.
  - Confirm cold start behavior now shows /startup.

[Implementation Order]
Start with scripts/docs, then UX page, then middleware tweak.

1) Root scripts and docs
   - Update root package.json with deploy/validate/serve scripts for App Hosting; add cross-env devDep.
   - Optionally add docs/DEPLOYMENT_OVERVIEW.md with one-page quickstart, linking to DEPLOYMENT_GUIDE.md.

2) UX pages
   - Create pickleglass_web/app/startup/page.tsx and app/unauthorized/page.tsx with simple accessible designs.

3) Auth middleware UX enhancement
   - In performGracefulDegradation, change browser behavior on protected routes to redirect 302 to /startup; keep API JSON behavior as-is; maintain all headers (X-Auth-*, Server-Timing) for observability.

4) Clean up alternative hosting paths (optional)
   - If any vercel.json/.vercel or Cloud Run standalone manifests are present beyond apphosting.yaml, remove or archive them to enforce single-platform deployments.

5) Validation and deploy
   - Run npm run validate:serverside.
   - Build web: cd pickleglass_web && npm run build.
   - Deploy to App Hosting: npm run deploy:apphosting.
   - Verify logs and endpoints.

6) Post-deploy UX checks
   - Hit protected pages during first cold start to verify redirect to /startup.
   - Confirm success on retries as auth initializes; check /status/detailed.

— — —

Platform alternatives (delta only)

- If choosing Vercel instead:
  - Remove Express custom server or configure Vercel Node server mode; wire env/secrets; replace App Hosting deploy scripts with vercel CLI flows; add vercel.json; revisit firebase-admin initialization for serverless timeouts; remove apphosting.yaml.

- If choosing standalone Cloud Run:
  - Keep server.js; add Dockerfile; build with Cloud Build/Artifact Registry; deploy via gcloud run deploy; manage secrets via Secret Manager; remove Firebase App Hosting specific config if not used.

— — —

Serve/Deploy How-To (single platform: Firebase App Hosting)

- Local development
  - cd pickleglass_web && npm run dev
  - Local emulators (functions + firestore): npm run serve:firebase

- CI/Manual deployment
  - Validate: npm run validate:serverside
  - Deploy: npm run deploy:apphosting
  - Logs: use Firebase Console (App Hosting) or firebase apphosting:logs

- Runtime URLs/endpoints
  - Health: /health, /healthz
  - Status: /status, /status/detailed
  - Info: /server-info
  - Protected routes redirect to /startup during auth init (after this plan is applied)

— — —

Exact script additions (root package.json)
- "start:dev": "cd pickleglass_web && npm run dev"
- "build:web": "cd pickleglass_web && npm run build"
- "serve:firebase": "firebase emulators:start --only functions,firestore"
- "validate:serverside": "node server-side-validation.js"
- "deploy:apphosting": "firebase deploy --only apphosting"
- "logs:apphosting": "firebase apphosting:logs"

These complement existing "start", "build", and "install" scripts which delegate to pickleglass_web.

— — —

Security and env configuration

- Keep secrets out of repo; configure App Hosting env vars in Firebase Console:
  - NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID, NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  - Service account (for Admin SDK) or workload identity; ensure auth utils can read FIREBASE_CONFIG or GOOGLE_CLOUD_PROJECT.
- Confirm region consistency (europe-west1) across App Hosting, Functions, Firestore.

— — —

User-facing improvements (small, high-value)

- Friendly startup page: Consistent “Starting up…” UX during cold starts/auth init (app/startup/page.tsx)
- Friendly unauthorized page to match middleware redirects
- Maintain security headers already present in next.config.js; keep rate-limiting and logging for auth
- Keep immediate health response in fast startup mode for quick liveness checks
