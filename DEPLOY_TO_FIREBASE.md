# Deploy Glass Application to Firebase

## Prerequisites
- ✅ Firebase CLI installed
- ✅ Project connected to `getseerai`
- ✅ Firebase config updated with your project credentials

## Deployment Steps

### 1. Login to Firebase (if not already logged in)
```bash
firebase login
```

### 2. Verify you're connected to the right project
```bash
firebase use getseerai
```

### 3. Install dependencies
```bash
# Install main app dependencies
npm install

# Install web app dependencies
cd pickleglass_web
npm install
cd ..

# Install functions dependencies
cd functions
npm install
cd ..
```

### 4. Build the web application
```bash
cd pickleglass_web
npm run build
cd ..
```

### 5. Deploy to Firebase
```bash
# Deploy everything at once
firebase deploy

# OR deploy components separately:
# firebase deploy --only hosting        # Web app only
# firebase deploy --only functions      # Functions only
# firebase deploy --only firestore      # Database rules only
```

## Expected Output
After successful deployment, you should see:
- ✅ Hosting URL: `https://getseerai.web.app` or `https://getseerai.firebaseapp.com`
- ✅ Functions deployed
- ✅ Firestore rules deployed

## Troubleshooting
If you get errors:
1. Make sure you're in the `glass` directory
2. Check that `pickleglass_web/out` directory exists after build
3. Verify Firebase project permissions
4. Run `firebase login` again if authentication fails

## Next Steps After Deployment
1. Test the web application at your hosting URL
2. Verify authentication works
3. Test database connectivity
4. Check that functions are responding

---
**Status: ✅ READY TO DEPLOY! All configuration complete.**

## Quick Deploy Commands
Run these commands in your terminal from the `glass` directory:

```bash
# 1. Login and verify project
firebase login
firebase use getseerai

# 2. Install all dependencies
npm install && cd pickleglass_web && npm install && cd .. && cd functions && npm install && cd ..

# 3. Build and deploy
cd pickleglass_web && npm run build && cd .. && firebase deploy
```

Your Glass application will be live at: **https://getseerai.web.app**
