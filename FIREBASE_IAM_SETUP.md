# Firebase IAM Setup for App Hosting

## Issue
The Firebase App Hosting deployment is failing with the following error:
```
Caller does not have required permission to use project getseerai. 
Grant the caller the roles/serviceusage.serviceUsageConsumer role
```

## Required IAM Role

The service account `firebase-app-hosting-compute@getseerai.iam.gserviceaccount.com` needs the following additional role:

**`roles/serviceusage.serviceUsageConsumer`** (Recommended)

This role is required for the Firebase Admin SDK to access the Identity Toolkit API (Firebase Auth services).

### Role Comparison
- **`roles/serviceusage.serviceUsageConsumer`** - Minimal permissions, only allows using enabled services (recommended for security)
- **`roles/serviceusage.serviceUsageAdmin`** - Broader permissions, includes ability to enable/disable services (unnecessary for this use case)

For Firebase App Hosting, the Consumer role is sufficient and follows the principle of least privilege.

## Current Roles
The service account currently has:
1. Developer Connect Read Token Accessor
2. Firebase Admin SDK Administrator Service Agent  
3. Firebase App Hosting Compute Runner

## How to Add the Required Role

### Option 1: Google Cloud Console
1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam?project=getseerai)
2. Find the service account: `firebase-app-hosting-compute@getseerai.iam.gserviceaccount.com`
3. Click "Edit" (pencil icon)
4. Click "Add Another Role"
5. Search for and select: `Service Usage Consumer`
6. Save the changes

### Option 2: gcloud CLI
```bash
gcloud projects add-iam-policy-binding getseerai \
    --member="serviceAccount:firebase-app-hosting-compute@getseerai.iam.gserviceaccount.com" \
    --role="roles/serviceusage.serviceUsageConsumer"
```

## Next Steps
1. Add the `roles/serviceusage.serviceUsageConsumer` role to the service account
2. Redeploy or rollout the previous build
3. Monitor the deployment logs to confirm the authentication error is resolved

## Code Analysis
The codebase already has proper error handling and graceful degradation for Firebase Admin SDK initialization. No code changes are required - this is purely an IAM permission issue.
