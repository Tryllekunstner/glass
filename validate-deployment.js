#!/usr/bin/env node

/**
 * Firebase Deployment Validation Script
 * 
 * This script validates that all necessary files and configurations
 * are in place for successful Firebase deployment.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Firebase deployment setup...\n');

let hasErrors = false;
let hasWarnings = false;

// Helper functions
const checkFileExists = (filePath, description, required = true) => {
  const exists = fs.existsSync(filePath);
  if (exists) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    if (required) {
      console.log(`❌ ${description}: ${filePath} (REQUIRED)`);
      hasErrors = true;
    } else {
      console.log(`⚠️  ${description}: ${filePath} (OPTIONAL)`);
      hasWarnings = true;
    }
    return false;
  }
};

const checkFileContent = (filePath, description, checks) => {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Cannot validate ${description}: ${filePath} does not exist`);
    hasErrors = true;
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let allPassed = true;

    checks.forEach(check => {
      if (check.test(content)) {
        console.log(`✅ ${description}: ${check.description}`);
      } else {
        console.log(`❌ ${description}: ${check.description} (FAILED)`);
        hasErrors = true;
        allPassed = false;
      }
    });

    return allPassed;
  } catch (error) {
    console.log(`❌ Error reading ${description}: ${error.message}`);
    hasErrors = true;
    return false;
  }
};

console.log('📁 Checking required configuration files...');

// Check Firebase configuration files
checkFileExists('firebase.json', 'Firebase configuration');
checkFileExists('firestore.rules', 'Firestore security rules');
checkFileExists('firestore.indexes.json', 'Firestore indexes', false);
checkFileExists('.firebaserc', 'Firebase project configuration');

console.log('\n📱 Checking web app configuration...');

// Check web app files
checkFileExists('pickleglass_web/package.json', 'Web app package.json');
checkFileExists('pickleglass_web/next.config.js', 'Next.js configuration');
checkFileExists('pickleglass_web/.env.local', 'Local environment variables', false);
checkFileExists('pickleglass_web/.env.production', 'Production environment variables', false);

console.log('\n⚙️  Checking Firebase Functions...');

// Check functions
checkFileExists('functions/package.json', 'Functions package.json');
checkFileExists('functions/index.js', 'Functions entry point');

console.log('\n🔧 Checking build configuration...');

// Check build files
checkFileExists('apphosting.yaml', 'App Hosting configuration', false);
checkFileExists('package.json', 'Root package.json');

console.log('\n🧪 Checking test setup...');

// Check test files
checkFileExists('pickleglass_web/__tests__/firebase.test.ts', 'Firebase tests', false);
checkFileExists('pickleglass_web/jest.config.js', 'Jest configuration', false);
checkFileExists('pickleglass_web/jest.setup.js', 'Jest setup', false);

console.log('\n🔍 Validating file contents...');

// Validate firebase.json
checkFileContent('firebase.json', 'firebase.json', [
  {
    description: 'Contains hosting configuration',
    test: (content) => content.includes('"hosting"')
  },
  {
    description: 'Points to correct public directory',
    test: (content) => content.includes('"public": "pickleglass_web/out"')
  },
  {
    description: 'Contains firestore rules reference',
    test: (content) => content.includes('"rules": "firestore.rules"')
  }
]);

// Validate firestore.rules
checkFileContent('firestore.rules', 'firestore.rules', [
  {
    description: 'Uses rules version 2',
    test: (content) => content.includes("rules_version = '2'")
  },
  {
    description: 'Contains user access rules',
    test: (content) => content.includes('match /users/{userId}')
  }
]);

// Validate functions package.json
checkFileContent('functions/package.json', 'functions/package.json', [
  {
    description: 'Uses Node.js 20',
    test: (content) => content.includes('"node": "20"')
  },
  {
    description: 'Has firebase-functions dependency',
    test: (content) => content.includes('firebase-functions')
  }
]);

// Validate web app package.json
checkFileContent('pickleglass_web/package.json', 'web app package.json', [
  {
    description: 'Has Firebase dependency',
    test: (content) => content.includes('firebase')
  },
  {
    description: 'Has Next.js dependency',
    test: (content) => content.includes('next')
  },
  {
    description: 'Has build script',
    test: (content) => content.includes('"build"')
  }
]);

// Validate Next.js config
checkFileContent('pickleglass_web/next.config.js', 'Next.js config', [
  {
    description: 'Has static export configuration',
    test: (content) => content.includes("output: 'export'")
  }
]);

console.log('\n📊 Validation Summary:');

if (hasErrors) {
  console.log('❌ Validation failed! Please fix the errors above before deploying.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Validation passed with warnings. Consider addressing the optional items above.');
  console.log('✅ Ready for Firebase deployment!');
} else {
  console.log('✅ All validations passed! Ready for Firebase deployment!');
}

console.log('\n🚀 Next steps:');
console.log('1. Update environment variables in .env.local with your Firebase config');
console.log('2. Run: npm run build:firebase');
console.log('3. Run: firebase deploy');
console.log('4. Test your deployed application');

console.log('\n📚 For more information, see:');
console.log('- Firebase Console: https://console.firebase.google.com');
console.log('- Firebase Hosting docs: https://firebase.google.com/docs/hosting');
console.log('- Next.js deployment: https://nextjs.org/docs/deployment');
