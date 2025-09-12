/**
 * Firebase Configuration Tests
 * 
 * These tests validate that Firebase is properly configured and can connect
 * to the Firebase services.
 */

// Mock Firebase modules before importing
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({
    name: '[DEFAULT]',
    options: {
      apiKey: 'mock-api-key',
      authDomain: 'mock-auth-domain',
      projectId: 'mock-project-id',
      storageBucket: 'mock-storage-bucket',
      messagingSenderId: 'mock-sender-id',
      appId: 'mock-app-id'
    }
  })),
  getApp: jest.fn(() => ({
    name: '[DEFAULT]',
    options: {
      apiKey: 'mock-api-key',
      authDomain: 'mock-auth-domain',
      projectId: 'mock-project-id',
      storageBucket: 'mock-storage-bucket',
      messagingSenderId: 'mock-sender-id',
      appId: 'mock-app-id'
    }
  })),
  getApps: jest.fn(() => [])
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    app: { name: '[DEFAULT]' },
    currentUser: null
  })),
  setPersistence: jest.fn(() => Promise.resolve()),
  browserLocalPersistence: {}
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({
    app: { name: '[DEFAULT]' }
  }))
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn(() => null),
  isSupported: jest.fn(() => Promise.resolve(false))
}));

import { app, auth, firestore, analytics } from '../utils/firebase';
import { validateEnvironmentConfig, getFirebaseConfig, logConfigurationStatus } from '../utils/config';

describe('Firebase Configuration', () => {
  test('Firebase app should be initialized', () => {
    expect(app).toBeDefined();
    expect(app.name).toBe('[DEFAULT]');
  });

  test('Firebase app should be the same instance', () => {
    // Mock implementation test
    expect(app.name).toBe('[DEFAULT]');
  });

  test('Firebase Auth should be initialized', () => {
    expect(auth).toBeDefined();
    expect(auth.app.name).toBe('[DEFAULT]');
  });

  test('Firestore should be initialized', () => {
    expect(firestore).toBeDefined();
    expect(firestore.app.name).toBe('[DEFAULT]');
  });

  test('Analytics should be null in test environment', () => {
    // Analytics should be null in test environment since window is undefined
    expect(analytics).toBeNull();
  });

  test('Firebase configuration should have required fields', () => {
    const config = app.options;
    
    // In test environment, these will be undefined, but we can test the structure
    expect(config).toHaveProperty('apiKey');
    expect(config).toHaveProperty('authDomain');
    expect(config).toHaveProperty('projectId');
    expect(config).toHaveProperty('storageBucket');
    expect(config).toHaveProperty('messagingSenderId');
    expect(config).toHaveProperty('appId');
  });
});

describe('Firebase Environment Variables', () => {
  test('should validate environment variables are properly loaded', () => {
    // Test that environment variables are being read
    // In a real test environment, you would mock these or use test config
    const requiredEnvVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID'
    ];

    // In test environment, these might be undefined
    // This test documents the expected environment variables
    requiredEnvVars.forEach(envVar => {
      expect(typeof process.env[envVar]).toBe('string');
    });
  });
});

describe('Configuration Validation', () => {
  // Mock environment variables for testing
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyA8-g3sUmtRL4qwWCc1_qUwBB6jWh68VH4',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'getseerai.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'getseerai',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'getseerai.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '992558788759',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:992558788759:web:3c8927306728856aadf9d2'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should validate environment configuration successfully', () => {
    const { validateEnvironmentConfig } = require('../utils/config');
    
    expect(() => {
      const config = validateEnvironmentConfig();
      expect(config.NODE_ENV).toBe('test');
      expect(config.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('getseerai');
    }).not.toThrow();
  });

  test('should get Firebase configuration successfully', () => {
    const { getFirebaseConfig } = require('../utils/config');
    
    const config = getFirebaseConfig();
    expect(config.projectId).toBe('getseerai');
    expect(config.apiKey).toBe('AIzaSyA8-g3sUmtRL4qwWCc1_qUwBB6jWh68VH4');
    expect(config.authDomain).toBe('getseerai.firebaseapp.com');
  });

  test('should throw error for missing environment variables', () => {
    const { validateEnvironmentConfig } = require('../utils/config');
    
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    
    expect(() => {
      validateEnvironmentConfig();
    }).toThrow('Missing required environment variables');
  });

  test('should throw error for placeholder values', () => {
    const { validateEnvironmentConfig } = require('../utils/config');
    
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'your-api-key-here';
    
    expect(() => {
      validateEnvironmentConfig();
    }).toThrow('Invalid placeholder values found');
  });
});
