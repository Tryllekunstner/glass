// Environment configuration validation and utilities
// This module provides type-safe environment variable access and validation

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
 * Validates that all required environment variables are present and non-empty
 * @returns Validated environment configuration
 * @throws Error if any required environment variables are missing
 */
export function validateEnvironmentConfig(): EnvironmentConfig {
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

  // Check for missing or empty required variables
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      missingVars.push(varName);
    } else if (value.trim() === '' || value === 'your-api-key-here' || value === 'your-project-id-here') {
      invalidVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  if (invalidVars.length > 0) {
    throw new Error(`Invalid placeholder values found in environment variables: ${invalidVars.join(', ')}`);
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv || !['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'`);
  }

  return {
    NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
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
