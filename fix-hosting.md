# Fix Firebase Hosting Issue

The "Site Not Found" error usually means Firebase Hosting isn't properly configured for your project. Here's how to fix it:

## Option 1: Reinitialize Firebase Hosting (Recommended)

Run these commands in your terminal from the `glass` directory:

```bash
# 1. Make sure you're logged in and using the right project
firebase login
firebase use getseerai

# 2. Initialize hosting (this will fix the configuration)
firebase init hosting

# When prompted:
# - "What do you want to use as your public directory?" → pickleglass_web/out
# - "Configure as a single-page app?" → Yes
# - "Set up automatic builds and deploys with GitHub?" → No (unless you want this)
# - "Overwrite index.html?" → No

# 3. Deploy again
firebase deploy --only hosting
```

## Option 2: Manual Fix via Firebase Console

1. Go to https://console.firebase.google.com/
2. Select your `getseerai` project
3. Go to "Hosting" in the left sidebar
4. If you see "Get started", click it and follow the setup
5. If hosting is already set up, check if the site is properly configured

## Option 3: Check if hosting is enabled

Run this command to see your hosting sites:
```bash
firebase hosting:sites:list
```

If no sites are listed, you need to create one:
```bash
firebase hosting:sites:create getseerai
```

## After fixing, your app should be available at:
- https://getseerai.web.app
- https://getseerai.firebaseapp.com

## Troubleshooting
If you still get "Site Not Found":
1. Wait 5-10 minutes for DNS propagation
2. Try accessing the site in an incognito/private browser window
3. Clear your browser cache
