// Environment configuration validation and utilities
// This module provides type-safe environment variable access and validation
// Supports both Firebase App Hosting JSON format and individual environment variables

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  NEXT_PUBLIC_FIREBASE_API_KEY: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  NEXT_PUBLIC_FIREBASE_APP_ID: string;
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
  NEXT_PUBLIC_API_URL?: string;
  NEXT_PUBLIC_ENABLE_ANALYTICS?: string;
  NEXT_PUBLIC_ENABLE_DEBUG?: string;
}

/**
 * Extract Firebase configuration from Firebase App Hosting JSON environment variables
 * @returns Extracted Firebase config or null if not available
 */
function extractFirebaseConfigFromJSON(): Partial<FirebaseConfig> | null {
  try {
    // Try to extract from FIREBASE_WEBAPP_CONFIG first (contains full client config)
    if (process.env.FIREBASE_WEBAPP_CONFIG) {
      const webappConfig = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
      console.log('🔥 Extracted Firebase config from FIREBASE_WEBAPP_CONFIG');
      return {
        apiKey: webappConfig.apiKey,
        authDomain: webappConfig.authDomain,
        projectId: webappConfig.projectId,
        storageBucket: webappConfig.storageBucket,
        messagingSenderId: webappConfig.messagingSenderId,
        appId: webappConfig.appId,
        measurementId: webappConfig.measurementId
      };
    }

    // Fallback to FIREBASE_CONFIG (contains basic config)
    if (process.env.FIREBASE_CONFIG) {
      const basicConfig = JSON.parse(process.env.FIREBASE_CONFIG);
      console.log('🔥 Extracted partial Firebase config from FIREBASE_CONFIG');
      
      // Generate auth domain from project ID if not provided
      const authDomain = `${basicConfig.projectId}.firebaseapp.com`;
      
      return {
        projectId: basicConfig.projectId,
        storageBucket: basicConfig.storageBucket,
        authDomain: authDomain,
        // These will need to be provided via individual env vars or defaults
        apiKey: undefined,
        messagingSenderId: undefined,
        appId: undefined,
        measurementId: undefined
      };
    }

    return null;
  } catch (error) {
    console.warn('⚠️  Failed to parse Firebase JSON config:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Get environment variable with Firebase JSON fallback
 * @param envVarName - Individual environment variable name
 * @param jsonKey - Key in Firebase JSON config
 * @param firebaseConfig - Extracted Firebase config from JSON
 * @returns Environment variable value
 */
function getEnvWithFirebaseJSONFallback(
  envVarName: string, 
  jsonKey: keyof FirebaseConfig, 
  firebaseConfig: Partial<FirebaseConfig> | null
): string | undefined {
  // First try individual environment variable
  const envValue = process.env[envVarName];
  if (envValue) {
    return envValue;
  }

  // Fallback to Firebase JSON config
  if (firebaseConfig && firebaseConfig[jsonKey]) {
    return firebaseConfig[jsonKey];
  }

  return undefined;
}

/**
 * Helper function to get the actual value for a given environment variable
 * Used for generating helpful error messages with correct values
 */
function getActualValueForVar(varName: string): string {
  const actualValues: Record<string, string> = {
    'NEXT_PUBLIC_FIREBASE_API_KEY': 'AIzaSyA8-g3sUmtRL4qwWCc1_qUwBB6jWh68VH4',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': 'getseerai.firebaseapp.com',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'getseerai',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': 'getseerai.appspot.com',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': '992558788759',
    'NEXT_PUBLIC_FIREBASE_APP_ID': '1:992558788759:web:3c8927306728856aadf9d2'
  };
  
  return actualValues[varName] || '<your-value-here>';
}

/**
 * Validates that all required environment variables are present and non-empty
 * Supports both Firebase App Hosting JSON format and individual environment variables
 * @returns Validated environment configuration
 * @throws Error if any required environment variables are missing
 */
export function validateEnvironmentConfig(): EnvironmentConfig {
  // Extract Firebase config from JSON environment variables first
  const firebaseConfigFromJSON = extractFirebaseConfigFromJSON();
  
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ] as const;

  const missingVars: string[] = [];
  const invalidVars: string[] = [];
  const extractedValues: Record<string, string> = {};

  // Check for missing or empty required variables with Firebase JSON fallback
  for (const varName of requiredVars) {
    const jsonKeyRaw = varName.replace('NEXT_PUBLIC_FIREBASE_', '').toLowerCase();
    let mappedJsonKey: keyof FirebaseConfig;
    
    // Map environment variable names to Firebase config keys
    switch (jsonKeyRaw) {
      case 'api_key':
        mappedJsonKey = 'apiKey';
        break;
      case 'auth_domain':
        mappedJsonKey = 'authDomain';
        break;
      case 'project_id':
        mappedJsonKey = 'projectId';
        break;
      case 'storage_bucket':
        mappedJsonKey = 'storageBucket';
        break;
      case 'messaging_sender_id':
        mappedJsonKey = 'messagingSenderId';
        break;
      case 'app_id':
        mappedJsonKey = 'appId';
        break;
      case 'measurement_id':
        mappedJsonKey = 'measurementId';
        break;
      default:
        mappedJsonKey = jsonKeyRaw as keyof FirebaseConfig;
    }
    
    const value = getEnvWithFirebaseJSONFallback(varName, mappedJsonKey, firebaseConfigFromJSON);
    
    if (!value) {
      missingVars.push(varName);
    } else if (value.trim() === '' || value === 'your-api-key-here' || value === 'your-project-id-here') {
      invalidVars.push(varName);
    } else {
      extractedValues[varName] = value;
    }
  }

  // If we have Firebase JSON config, show more helpful error messages
  if (missingVars.length > 0) {
    const hasFirebaseJSON = !!firebaseConfigFromJSON;
    
    let errorMessage = `❌ Missing required environment variable: ${missingVars.join(', ')}\n\n`;
    
    if (hasFirebaseJSON) {
      errorMessage += `🔥 FIREBASE APP HOSTING DETECTED:\n` +
        `Firebase App Hosting provides configuration via JSON environment variables,\n` +
        `but some values are missing from FIREBASE_WEBAPP_CONFIG.\n\n` +
        `Available from Firebase JSON:\n`;
      
      if (firebaseConfigFromJSON) {
        Object.entries(firebaseConfigFromJSON).forEach(([key, value]) => {
          if (value) {
            errorMessage += `  ✅ ${key}: ${value}\n`;
          }
        });
      }
      
      errorMessage += `\n🔧 This usually means FIREBASE_WEBAPP_CONFIG is incomplete.\n` +
        `Check your Firebase App Hosting configuration.`;
    } else {
      errorMessage += `🔧 FIREBASE APP HOSTING SETUP REQUIRED:\n` +
        `Environment variables must be configured in Firebase App Hosting.\n` +
        `Run these commands to fix:\n\n` +
        missingVars.map(varName => 
          `firebase apphosting:env:set ${varName}="<your-value-here>"`
        ).join('\n') +
        `\n\nSee FIREBASE_ENV_SETUP.md for complete setup instructions.`;
    }
    
    throw new Error(errorMessage);
  }

  if (invalidVars.length > 0) {
    const errorMessage = `Invalid placeholder values found in environment variables: ${invalidVars.join(', ')}\n\n` +
      `🔧 FIREBASE APP HOSTING CONFIGURATION ISSUE:\n` +
      `Placeholder values detected. This usually means environment variables\n` +
      `are not properly configured in Firebase App Hosting.\n\n` +
      `Run these commands to fix:\n\n` +
      invalidVars.map(varName => {
        const actualValue = getActualValueForVar(varName);
        return `firebase apphosting:env:set ${varName}="${actualValue}"`;
      }).join('\n') +
      `\n\nSee FIREBASE_ENV_SETUP.md for complete setup instructions.`;
    throw new Error(errorMessage);
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv || !['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'`);
  }

  // Log successful extraction from Firebase JSON
  if (firebaseConfigFromJSON) {
    console.log('✅ Successfully extracted Firebase configuration from App Hosting JSON');
  }

  return {
    NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
    NEXT_PUBLIC_FIREBASE_API_KEY: extractedValues.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: extractedValues.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: extractedValues.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: extractedValues.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: extractedValues.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: extractedValues.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: getEnvWithFirebaseJSONFallback('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', 'measurementId', firebaseConfigFromJSON),
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
    NEXT_PUBLIC_ENABLE_DEBUG: process.env.NEXT_PUBLIC_ENABLE_DEBUG
  };
}

/**
 * Returns a validated Firebase configuration object
 * @returns Firebase configuration for SDK initialization
 */
export function getFirebaseConfig(): FirebaseConfig {
  const envConfig = validateEnvironmentConfig();
  
  return {
    apiKey: envConfig.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: envConfig.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: envConfig.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: envConfig.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envConfig.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: envConfig.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: envConfig.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  };
}

/**
 * Logs the current configuration status for debugging purposes
 * @param includeValues Whether to include actual values (use false in production)
 */
export function logConfigurationStatus(includeValues: boolean = false): void {
  try {
    const envConfig = validateEnvironmentConfig();
    const firebaseConfig = getFirebaseConfig();
    
    console.log('🔧 Configuration Status: ✅ Valid');
    console.log(`📍 Environment: ${envConfig.NODE_ENV}`);
    console.log(`📍 Region: ${getRegion()}`);
    console.log(`🔥 Firebase Project: ${firebaseConfig.projectId}`);
    console.log(`🌐 Auth Domain: ${firebaseConfig.authDomain}`);
    
    if (includeValues && envConfig.NODE_ENV === 'development') {
      console.log('🔍 Debug - Full Configuration:', {
        firebase: firebaseConfig,
        environment: envConfig
      });
    }
    
    // Validate specific configuration aspects
    if (firebaseConfig.apiKey.startsWith('AIza')) {
      console.log('🔑 API Key: ✅ Valid format');
    } else {
      console.warn('⚠️ API Key: Unexpected format');
    }
    
    if (firebaseConfig.authDomain.includes('.firebaseapp.com')) {
      console.log('🔐 Auth Domain: ✅ Valid format');
    } else {
      console.warn('⚠️ Auth Domain: Unexpected format');
    }
    
  } catch (error) {
    console.error('❌ Configuration Status: Invalid');
    console.error('🚨 Configuration Error:', error instanceof Error ? error.message : error);
    
    // Log available environment variables for debugging
    const availableVars = Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_FIREBASE_'))
      .map(key => `${key}: ${process.env[key] ? '✅ Set' : '❌ Missing'}`);
    
    if (availableVars.length > 0) {
      console.log('📋 Available Firebase Environment Variables:');
      availableVars.forEach(varStatus => console.log(`  ${varStatus}`));
    }
  }
}

/**
 * Checks if the current environment is development
 */
export function isDevelopment(): boolean {
  try {
    const config = validateEnvironmentConfig();
    return config.NODE_ENV === 'development';
  } catch {
    return process.env.NODE_ENV === 'development';
  }
}

/**
 * Checks if the current environment is production
 */
export function isProduction(): boolean {
  try {
    const config = validateEnvironmentConfig();
    return config.NODE_ENV === 'production';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

/**
 * Gets a safe configuration summary for logging (without sensitive values)
 */
export function getConfigurationSummary(): Record<string, any> {
  try {
    const envConfig = validateEnvironmentConfig();
    const firebaseConfig = getFirebaseConfig();
    
    return {
      environment: envConfig.NODE_ENV,
      region: getRegion(),
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      hasApiKey: !!firebaseConfig.apiKey,
      hasAppId: !!firebaseConfig.appId,
      hasStorageBucket: !!firebaseConfig.storageBucket,
      hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
      hasMeasurementId: !!firebaseConfig.measurementId,
      analyticsEnabled: envConfig.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
      debugEnabled: envConfig.NEXT_PUBLIC_ENABLE_DEBUG === 'true'
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown configuration error',
      environment: process.env.NODE_ENV || 'unknown'
    };
  }
}

/**
 * Get Firebase project ID with Firebase JSON fallback
 * This is a simplified function for Firebase Admin SDK initialization
 * @returns Firebase project ID or null if not available
 */
export function getFirebaseProjectId(): string | null {
  // First try individual environment variable
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  }

  // Fallback to Firebase JSON config
  const firebaseConfigFromJSON = extractFirebaseConfigFromJSON();
  if (firebaseConfigFromJSON?.projectId) {
    console.log('🔥 Using project ID from Firebase App Hosting JSON config');
    return firebaseConfigFromJSON.projectId;
  }

  // Fallback to Google Cloud environment variables
  const gProjectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
  if (gProjectId) {
    return gProjectId;
  }

  return null;
}

export function getRegion(): string {
  return process.env.REGION || process.env.FIREBASE_REGION || process.env.GOOGLE_CLOUD_REGION || 'europe-west1';
}
