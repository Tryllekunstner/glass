# Server-Side Only Deployment Guide

## Overview

This guide covers deploying the Glass project as a **server-side only** application using Firebase App Hosting. All static page generation has been removed to ensure the application runs entirely on the server.

## ✅ Configuration Summary

The application has been configured for server-side rendering only with the following changes:

### Firebase Configuration
- **Removed static hosting** from `firebase.json`
- **App Hosting configured** in `apphosting.yaml` with Node.js 20 runtime
- **Functions and Firestore** remain configured for backend services

### Next.js Configuration
- **Force dynamic rendering** set in root layout: `export const dynamic = 'force-dynamic'`
- **No static export** configuration in `next.config.js`
- **Server-side headers** enabled for security
- **Trailing slash disabled** for server-side routing

### Deployment Scripts
- **App Hosting deployment**: `npm run deploy:apphosting`
- **Local testing**: `npm run serve:firebase` (functions and Firestore only)
- **Validation**: `npm run validate:serverside`

## 🚀 Deployment Steps

### Prerequisites

1. **Firebase CLI installed and authenticated**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Firebase project configured**:
   ```bash
   firebase use your-project-id
   ```

3. **Environment variables set** (if needed):
   - Update `pickleglass_web/.env.local` for development
   - Set production environment variables in Firebase Console

### Step 1: Validate Configuration

Before deploying, run the validation script to ensure everything is configured correctly:

```bash
npm run validate:serverside
```

This will check:
- ✅ No static hosting configuration
- ✅ App Hosting properly configured
- ✅ Next.js configured for server-side rendering
- ✅ Dynamic rendering enabled
- ✅ No static generation patterns in code

### Step 2: Build and Deploy

Deploy to Firebase App Hosting:

```bash
npm run deploy:apphosting
```

This command will:
1. Install web dependencies
2. Build the Next.js application for server-side rendering
3. Deploy to Firebase App Hosting

### Step 3: Verify Deployment

1. **Check deployment status** in Firebase Console
2. **Test the application** at your App Hosting URL
3. **Verify server-side rendering** by checking page source (should show rendered content)

## 🧪 Local Development

### Development Server

Run the Next.js development server:

```bash
cd pickleglass_web
npm run dev
```

### Local Firebase Services

Test with local Firebase services:

```bash
npm run serve:firebase
```

This serves:
- Firebase Functions (if any)
- Firestore emulator
- **Note**: Does not serve static hosting (removed)

## 🔍 Validation and Testing

### Server-Side Validation

Run the comprehensive validation script:

```bash
npm run validate:serverside
```

### Manual Verification

1. **Check page source**: Should show fully rendered HTML content
2. **Network tab**: Should show server responses, not static files
3. **Firebase Console**: App Hosting should show active deployment
4. **No `/out` directory**: Should not be generated during build

## 🚨 Troubleshooting

### Common Issues

1. **Static hosting still configured**:
   - Check `firebase.json` - should not contain `hosting` section
   - Run validation script to confirm

2. **Build generates static files**:
   - Ensure `export const dynamic = 'force-dynamic'` in layout
   - Check for `generateStaticParams` in pages (should not exist)
   - Verify no `output: 'export'` in `next.config.js`

3. **Deployment fails**:
   - Check Firebase project has App Hosting enabled
   - Verify `apphosting.yaml` configuration
   - Ensure Node.js 20 runtime is supported

4. **Pages not rendering server-side**:
   - Check for client-side only components
   - Verify dynamic rendering configuration
   - Check browser network tab for server responses

### Debug Commands

```bash
# Validate server-side configuration
npm run validate:serverside

# Check build output
cd pickleglass_web && npm run build

# Test local server
cd pickleglass_web && npm run start
```

## 📁 File Structure

### Key Configuration Files

```
├── firebase.json              # Firebase config (hosting removed)
├── apphosting.yaml           # App Hosting configuration
├── server-side-validation.js # Validation script
├── pickleglass_web/
│   ├── next.config.js        # Next.js config (no static export)
│   ├── app/
│   │   └── layout.tsx        # Root layout (force-dynamic)
│   └── package.json          # Web app dependencies
└── package.json              # Root scripts (deploy:apphosting)
```

### Deployment Scripts

- `deploy:apphosting` - Deploy to Firebase App Hosting
- `validate:serverside` - Validate server-side configuration
- `serve:firebase` - Local Firebase services (no static hosting)
- `build:firebase` - Build for Firebase deployment

## 🔐 Security

### Server-Side Headers

The following security headers are configured in `next.config.js`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Environment Variables

- Development: `pickleglass_web/.env.local`
- Production: Set in Firebase Console or hosting provider

## 📊 Monitoring

### Firebase Console

Monitor your deployment in Firebase Console:

1. **App Hosting** - Deployment status and logs
2. **Functions** - Backend function performance
3. **Firestore** - Database usage and security rules

### Performance

Server-side rendering provides:
- ✅ Better SEO (fully rendered HTML)
- ✅ Faster initial page load
- ✅ Dynamic content generation
- ✅ Server-side authentication

## 🎯 Next Steps

1. **Set up monitoring** and alerting for your App Hosting deployment
2. **Configure custom domain** if needed
3. **Set up CI/CD pipeline** for automated deployments
4. **Monitor performance** and optimize as needed

---

## Quick Reference

```bash
# Validate configuration
npm run validate:serverside

# Deploy to App Hosting
npm run deploy:apphosting

# Local development
cd pickleglass_web && npm run dev

# Test Firebase services locally
npm run serve:firebase
```

**✅ The application is now configured for server-side rendering only!**
