#!/bin/bash

echo "Starting Firebase deployment for Glass application..."
echo

echo "Step 1: Logging into Firebase..."
firebase login

echo
echo "Step 2: Setting project to getseerai..."
firebase use getseerai

echo
echo "Step 3: Installing dependencies..."
npm install
cd pickleglass_web
npm install
cd ..
cd functions
npm install
cd ..

echo
echo "Step 4: Building web application..."
cd pickleglass_web
npm run build
cd ..

echo
echo "Step 5: Deploying to Firebase..."
firebase deploy

echo
echo "Deployment complete! Your app should be available at:"
echo "https://getseerai.web.app"
echo "https://getseerai.firebaseapp.com"
