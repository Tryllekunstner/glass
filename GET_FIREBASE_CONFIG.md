# Get Your Firebase Configuration

To complete the setup, you need to get your Firebase project's configuration:

## Steps:

1. Go to your Firebase Console: https://console.firebase.google.com/
2. Select your project: **getseerai**
3. Click the gear icon (⚙️) → **Project settings**
4. Scroll down to "Your apps" section
5. If you don't see a web app, click **"Add app"** → **Web app** (</>) 
6. Give it a name like "Glass Web App" and click **Register app**
7. Copy the `firebaseConfig` object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "getseerai.firebaseapp.com",
  projectId: "getseerai",
  storageBucket: "getseerai.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id"
};
```

## What to do next:
Once you have this config, I'll update the `glass/pickleglass_web/utils/firebase.ts` file with your credentials.

**Please copy and paste your firebaseConfig object here when you have it!**
