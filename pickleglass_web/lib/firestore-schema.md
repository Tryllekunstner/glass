# Firestore Schema (Source of Truth)

Region and residency
- Default region: europe-west1 (align Functions and Cloud Run).
- Firestore location is set at project provisioning time; runtime reads REGION/FIREBASE_REGION for diagnostics and behavior.

Collections and documents
1) users/{uid}
   - Fields
     - uid: string (PK, equals doc id)
     - email: string (email, required)
     - displayName?: string
     - photoURL?: string (url)
     - orgId?: string (orgs/{orgId})
     - roles?: string[] (subset of ["owner","admin","member","guest"])
     - status: "active" | "suspended" | "deleted" (default "active")
     - createdAt: Timestamp
     - updatedAt: Timestamp
     - lastLoginAt?: Timestamp
   - Access
     - R/W: only the authenticated user (uid == request.auth.uid)
   - Subcollections
     a) sessions/{sessionId}
        - Fields
          - id: string (doc id)
          - uid: string (FK users/{uid})
          - type: "ask" | "listen" | "chat"
          - agentId?: string (agentConfigs/{id})
          - startedAt: Timestamp
          - endedAt?: Timestamp
          - status: "active" | "completed" | "error"
          - meta?: map
        - Subcollections
          - transcripts/{transcriptId}: user-owned transcript chunks
          - aiMessages/{messageId}: user-owned AI assistant messages
          - summary/{document=**}: summarized content (structured)
        - Access: only owner user
     b) promptPresets/{presetId}: user-owned presets (owner only)
     c) aiProfiles/{profileId}: user-owned AI presets (owner only)
     d) preferences/{document=**}: user-owned misc prefs (owner only)
     e) settings/app (single doc)
        - Fields
          - language: string (BCP-47)
          - theme: "light" | "dark" | "system"
          - voiceInputEnabled: boolean
          - telemetryEnabled: boolean
          - preferredAgentId?: string
          - updatedAt: Timestamp
        - Access: only owner user (uid == request.auth.uid)
     f) activity/{activityId}: user-owned event/activity logs (owner only)
     g) credentials/{credentialId}: encrypted API keys (owner only; strongly recommend server-side writes only)

2) devices/{deviceId} (top-level)
   - Fields
     - id: string (doc id)
     - uid: string (FK users/{uid}, owner)
     - type: "desktop" | "mobile"
     - platform: "win" | "mac" | "linux" | "ios" | "android"
     - appVersion: string (semver)
     - lastSeenAt: Timestamp
     - status: "online" | "offline" | "blocked"
     - displayName?: string
   - Access
     - Read: allowed if resource.data.uid == request.auth.uid
     - Create: allowed if request.resource.data.uid == request.auth.uid
     - Update: allowed if resource.data.uid == request.auth.uid
     - Delete: denied (managed by server/admin flows)
   - Typical queries
     - List devices by uid with lastSeenAt sorting (requires index: uid ASC, lastSeenAt DESC)

3) agentConfigs/{id} (top-level)
   - Fields
     - id: string (doc id)
     - uid: string (creator/owner)
     - orgId?: string (org owner variant, read-only to clients unless explicitly user-owned)
     - name: string
     - type: "ask" | "listen" | "custom"
     - modelProvider: "openai" | "anthropic" | "google" | "local"
     - modelId: string
     - temperature?: number
     - maxTokens?: number
     - systemPrompt?: string
     - tools?: string[]
     - active: boolean
     - updatedAt: Timestamp
   - Access
     - Read: allowed if resource.data.uid == request.auth.uid
     - Create/Update/Delete: allowed if resource.data.uid == request.auth.uid
     - Org-owned configs: server/admin managed; client writes denied by rules
   - Typical queries
     - List by uid and active (uid == auth.uid AND active == true)
     - List by orgId and active (server-side/admin)

4) orgs/{orgId} (top-level)
   - Fields
     - id: string
     - name: string
     - plan: "free" | "pro" | "enterprise"
     - region: string (default "europe-west1")
     - settings: map (OrgSettings)
     - createdAt: Timestamp
     - updatedAt: Timestamp
   - Access: client reads/writes denied by default in rules (server/admin only)

5) config/{document=**}, system/{document=**}, aiModels/{modelId}, analytics/{document=**}
   - Access
     - Read: authenticated users
     - Write: denied (server/admin only)

Security model (see firestore.rules)
- Helper guards isSignedIn() and isUser(uid) used to concisely express access.
- users subtree is strictly user-owned; only the same uid can read/write.
- devices is top-level and guarded by the device’s owner uid.
- agentConfigs is guarded for user-owned docs; org-owned configs are write-protected client-side.
- All other roots default to deny; only whitelisted patterns allowed.

Recommended composite indexes (firestore.indexes.json)
- devices by uid with lastSeenAt sorting
  - collectionGroup: "devices"
  - fields: uid (ASC), lastSeenAt (DESC)
- agentConfigs by uid and active flag
  - collectionGroup: "agentConfigs"
  - fields: uid (ASC), active (ASC)
- agentConfigs by orgId and active (server-side/admin queries)
  - collectionGroup: "agentConfigs"
  - fields: orgId (ASC), active (ASC)
- sessions by uid with startedAt sorting (under users/{uid}/sessions)
  - collectionGroup: "sessions"
  - fields: uid (ASC), startedAt (DESC)
- sessions by uid and status (filtering recent states)
  - collectionGroup: "sessions"
  - fields: uid (ASC), status (ASC)

Query patterns by surface
- Desktop app
  - Read: users/{uid}/settings/app (listen for real-time updates)
  - Write: devices/{deviceId} upsert (register) and periodic lastSeenAt heartbeat
- Web app (server routes)
  - Read/Write: users/{uid}/settings/app (API with validation)
  - CRUD: agentConfigs/{id} (user-owned), with RBAC checks applied server-side
  - Reads for device registry (owner filtered by uid)

Data validation (server-side)
- All API writes validated with Zod (web/lib/validation.ts) per plan.
- Device registration payload: {id, type, platform, appVersion} + server-managed {uid, lastSeenAt, status}
- Settings update payload: partial AppSettings with server-managed updatedAt
- Agent configs: enforce allowed modelProvider/modelId and safe limits for temperature, maxTokens

Retention and lifecycle
- sessions/* subcollections may be pruned/archived by scheduled jobs (server-side) depending on plan.
- devices: deleted by server when blocked or on decommission flows.
- credentials: strongly recommend server-only writes; clients read limited or disallowed (future strengthening).

Notes
- This doc is authoritative for schema and access behavior. Keep in sync with rules and APIs.
- No local testing; deploy-time and managed environment behavior only, per project requirements.
