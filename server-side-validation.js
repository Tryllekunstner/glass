#!/usr/bin/env node

/**
 * Server-Side Validation Script
 * 
 * This script validates that the Next.js application is configured for
 * server-side rendering only and prevents any static generation.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating server-side only configuration...\n');

let hasErrors = false;

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Read and parse JSON file
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Read file content as string
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Validate Firebase configuration
 */
function validateFirebaseConfig() {
  console.log('📋 Checking Firebase configuration...');
  
  const firebaseConfigPath = 'firebase.json';
  if (!fileExists(firebaseConfigPath)) {
    console.error('❌ firebase.json not found');
    hasErrors = true;
    return;
  }

  const firebaseConfig = readJsonFile(firebaseConfigPath);
  if (!firebaseConfig) {
    hasErrors = true;
    return;
  }

  // Check that hosting configuration is removed
  if (firebaseConfig.hosting) {
    console.error('❌ Static hosting configuration found in firebase.json');
    console.error('   This conflicts with server-side rendering. Remove the "hosting" section.');
    hasErrors = true;
  } else {
    console.log('✅ No static hosting configuration found');
  }

  // Check that functions and firestore are configured
  if (firebaseConfig.functions) {
    console.log('✅ Firebase Functions configured');
  }
  
  if (firebaseConfig.firestore) {
    console.log('✅ Firestore configured');
  }
}

/**
 * Validate App Hosting configuration
 */
function validateAppHostingConfig() {
  console.log('\n📋 Checking App Hosting configuration...');
  
  const appHostingConfigPath = 'apphosting.yaml';
  if (!fileExists(appHostingConfigPath)) {
    console.error('❌ apphosting.yaml not found');
    hasErrors = true;
    return;
  }

  const appHostingConfig = readFile(appHostingConfigPath);
  if (!appHostingConfig) {
    hasErrors = true;
    return;
  }

  // Check for server-side configuration
  if (appHostingConfig.includes('npm start')) {
    console.log('✅ App Hosting configured for server-side rendering');
  } else {
    console.error('❌ App Hosting not configured for server-side rendering');
    hasErrors = true;
  }

  if (appHostingConfig.includes('nodejs20')) {
    console.log('✅ Node.js 20 runtime configured');
  }
}

/**
 * Validate Next.js configuration
 */
function validateNextConfig() {
  console.log('\n📋 Checking Next.js configuration...');
  
  const nextConfigPath = 'pickleglass_web/next.config.js';
  if (!fileExists(nextConfigPath)) {
    console.error('❌ next.config.js not found');
    hasErrors = true;
    return;
  }

  const nextConfig = readFile(nextConfigPath);
  if (!nextConfig) {
    hasErrors = true;
    return;
  }

  // Check for static export configuration (should not exist)
  if (nextConfig.includes('output:') && nextConfig.includes('export')) {
    console.error('❌ Static export configuration found in next.config.js');
    console.error('   Remove output: "export" to enable server-side rendering');
    hasErrors = true;
  } else {
    console.log('✅ No static export configuration found');
  }

  // Check for headers (indicates server-side rendering)
  if (nextConfig.includes('async headers()')) {
    console.log('✅ Server-side headers configured');
  }

  // Check for trailingSlash setting
  if (nextConfig.includes('trailingSlash: false')) {
    console.log('✅ Trailing slash disabled for server-side rendering');
  }
}

/**
 * Validate app layout for dynamic rendering
 */
function validateAppLayout() {
  console.log('\n📋 Checking app layout configuration...');
  
  const layoutPath = 'pickleglass_web/app/layout.tsx';
  if (!fileExists(layoutPath)) {
    console.error('❌ app/layout.tsx not found');
    hasErrors = true;
    return;
  }

  const layoutContent = readFile(layoutPath);
  if (!layoutContent) {
    hasErrors = true;
    return;
  }

  // Check for force-dynamic export
  if (layoutContent.includes("export const dynamic = 'force-dynamic'")) {
    console.log('✅ Root layout configured for dynamic rendering');
  } else {
    console.error('❌ Root layout missing force-dynamic configuration');
    console.error('   Add: export const dynamic = "force-dynamic"');
    hasErrors = true;
  }
}

/**
 * Validate package.json scripts
 */
function validatePackageScripts() {
  console.log('\n📋 Checking deployment scripts...');
  
  const packagePath = 'package.json';
  if (!fileExists(packagePath)) {
    console.error('❌ package.json not found');
    hasErrors = true;
    return;
  }

  const packageConfig = readJsonFile(packagePath);
  if (!packageConfig) {
    hasErrors = true;
    return;
  }

  // Check for App Hosting deployment script
  if (packageConfig.scripts && packageConfig.scripts['deploy:apphosting']) {
    console.log('✅ App Hosting deployment script configured');
  } else {
    console.error('❌ App Hosting deployment script not found');
    console.error('   Add: "deploy:apphosting": "npm run build:firebase && firebase apphosting:deploy"');
    hasErrors = true;
  }

  // Check that static hosting deployment is not used
  if (packageConfig.scripts && packageConfig.scripts['deploy:firebase'] && 
      packageConfig.scripts['deploy:firebase'].includes('firebase deploy')) {
    console.error('❌ Static hosting deployment script found');
    console.error('   This would deploy static hosting. Use deploy:apphosting instead.');
    hasErrors = true;
  }
}

/**
 * Check for any static generation patterns in app pages
 */
function validateAppPages() {
  console.log('\n📋 Checking app pages for static generation...');
  
  const appDir = 'pickleglass_web/app';
  if (!fileExists(appDir)) {
    console.error('❌ app directory not found');
    hasErrors = true;
    return;
  }

  const checkDirectory = (dir) => {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        checkDirectory(itemPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        const content = readFile(itemPath);
        if (content) {
          // Check for generateStaticParams (should not exist for server-side only)
          if (content.includes('generateStaticParams')) {
            console.error(`❌ generateStaticParams found in ${itemPath}`);
            console.error('   Remove generateStaticParams for server-side rendering');
            hasErrors = true;
          }
          
          // Check for getStaticProps (should not exist in app router)
          if (content.includes('getStaticProps')) {
            console.error(`❌ getStaticProps found in ${itemPath}`);
            console.error('   getStaticProps is not used in App Router');
            hasErrors = true;
          }
        }
      }
    }
  };

  try {
    checkDirectory(appDir);
    console.log('✅ No static generation patterns found in app pages');
  } catch (error) {
    console.error('❌ Error checking app pages:', error.message);
    hasErrors = true;
  }
}

/**
 * Main validation function
 */
function main() {
  validateFirebaseConfig();
  validateAppHostingConfig();
  validateNextConfig();
  validateAppLayout();
  validatePackageScripts();
  validateAppPages();

  console.log('\n' + '='.repeat(50));
  
  if (hasErrors) {
    console.log('❌ Validation failed! Please fix the issues above.');
    console.log('   The application may generate static content or have deployment conflicts.');
    process.exit(1);
  } else {
    console.log('✅ All validations passed!');
    console.log('   The application is configured for server-side rendering only.');
    console.log('   Deploy using: npm run deploy:apphosting');
  }
}

// Run validation
main();
