@echo off
REM Firebase App Hosting Environment Variables Setup Script (Windows)
REM This script configures all required environment variables for Firebase App Hosting

echo 🔧 Setting up Firebase App Hosting Environment Variables...
echo.

REM Check if Firebase CLI is installed
firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Firebase CLI is not installed.
    echo Install it with: npm install -g firebase-tools
    pause
    exit /b 1
)

REM Check if user is logged in
firebase projects:list >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Not logged in to Firebase.
    echo Login with: firebase login
    pause
    exit /b 1
)

echo ✅ Firebase CLI is ready
echo.

REM Set environment variables
echo 📝 Setting Firebase configuration variables...

firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyA8-g3sUmtRL4qwWCc1_qUwBB6jWh68VH4"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="getseerai.firebaseapp.com"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_PROJECT_ID="getseerai"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="getseerai.appspot.com"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="992558788759"
firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_APP_ID="1:992558788759:web:3c8927306728856aadf9d2"

echo.
echo 📝 Setting optional configuration variables...

firebase apphosting:env:set NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-MEASUREMENT_ID_PLACEHOLDER"
firebase apphosting:env:set NEXT_PUBLIC_API_URL="https://getseerai.web.app/api"
firebase apphosting:env:set NEXT_PUBLIC_ENABLE_ANALYTICS="true"
firebase apphosting:env:set NEXT_PUBLIC_ENABLE_DEBUG="false"
firebase apphosting:env:set NODE_ENV="production"

echo.
echo ✅ Environment variables configured successfully!
echo.
echo 📋 Verifying configuration...
firebase apphosting:env:list

echo.
echo 🚀 Next steps:
echo 1. Deploy your application: firebase deploy --only apphosting
echo 2. Test the login functionality
echo 3. Check the debug endpoint: https://your-app-url/api/config-debug
echo.
echo If you encounter issues, see FIREBASE_ENV_SETUP.md for troubleshooting.
echo.
pause
