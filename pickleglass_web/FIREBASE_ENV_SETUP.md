# Firebase App Hosting Environment Variables Setup

This guide explains how to configure environment variables for Firebase App Hosting to fix the authentication issue where "your-api-key-here" is being sent instead of the actual API key.

## Problem
Firebase App Hosting doesn't automatically load `.env.production` files. Environment variables must be configured through the Firebase console or CLI.

## Solution: Using Firebase CLI (Recommended)

### Prerequisites
1. Install Firebase CLI if not already installed:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Make sure you're in the correct project directory and have the right project selected:
```bash
firebase use --add  # Select your project if not already configured
firebase projects:list  # Verify current project
```

### Configure Environment Variables

Run these commands to set up the required environment variables for your Firebase App Hosting deployment:

```bash
# Set Firebase configuration variables
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_API_KEY --data-file <(echo "AIzaSyA8-g3sUmtRL4qwWCc1_qUwBB6jWh68VH4")
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN --data-file <(echo "getseerai.firebaseapp.com")
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_PROJECT_ID --data-file <(echo "getseerai")
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET --data-file <(echo "getseerai.appspot.com")
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --data-file <(echo "992558788759")
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_APP_ID --data-file <(echo "1:992558788759:web:3c8927306728856aadf9d2")

# Set optional variables
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID --data-file <(echo "G-MEASUREMENT_ID_PLACEHOLDER")
firebase apphosting:secrets:set NEXT_PUBLIC_API_URL --data-file <(echo "https://getseerai.web.app/api")
firebase apphosting:secrets:set NEXT_PUBLIC_ENABLE_ANALYTICS --data-file <(echo "true")
firebase apphosting:secrets:set NEXT_PUBLIC_ENABLE_DEBUG --data-file <(echo "false")

# Set Node environment
firebase apphosting:secrets:set NODE_ENV --data-file <(echo "production")
```

### Alternative: Using Environment Variables (if secrets don't work)

If the secrets approach doesn't work, try using environment variables instead:

```bash
# Set Firebase configuration as environment variables
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyA8-g3sUmtRL4qwWCc1_qUwBB6jWh68VH4"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="getseerai.firebaseapp.com"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_PROJECT_ID="getseerai"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="getseerai.appspot.com"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="992558788759"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_APP_ID="1:992558788759:web:3c8927306728856aadf9d2"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-MEASUREMENT_ID_PLACEHOLDER"
firebase apphosting:env:set NEXT_PUBLIC_API_URL="https://getseerai.web.app/api"
firebase apphosting:env:set NEXT_PUBLIC_ENABLE_ANALYTICS="true"
firebase apphosting:env:set NEXT_PUBLIC_ENABLE_DEBUG="false"
firebase apphosting:env:set NODE_ENV="production"
```

### Verify Configuration

1. List current environment variables:
```bash
firebase apphosting:env:list
```

2. List current secrets:
```bash
firebase apphosting:secrets:list
```

### Deploy Changes

After setting the environment variables, redeploy your application:

```bash
firebase deploy --only apphosting
```

## Alternative: Using Firebase Console (Web UI)

If you prefer using the web interface:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`getseerai`)
3. Navigate to **App Hosting** in the left sidebar
4. Select your backend
5. Go to **Environment variables** tab
6. Add each environment variable with the values from your `.env.production` file

## Verification

After deployment, you can verify the configuration is working by:

1. Visiting your deployed app and checking the browser console for configuration logs
2. Using the debug endpoint: `https://your-app-url/api/config-debug`
3. Attempting to login - the error should be resolved

## Troubleshooting

### If you get "command not found" errors:
- Make sure you have the latest Firebase CLI: `npm install -g firebase-tools@latest`
- Check if App Hosting commands are available: `firebase apphosting --help`

### If environment variables still show as placeholders:
1. Verify the variables are set: `firebase apphosting:env:list`
2. Ensure you've redeployed after setting variables
3. Check that variable names match exactly (case-sensitive)
4. Try using the Firebase Console web interface as an alternative

### If authentication still fails:
1. Verify your Firebase project configuration
2. Check that the API key has the correct permissions
3. Ensure your domain is authorized in Firebase Authentication settings
