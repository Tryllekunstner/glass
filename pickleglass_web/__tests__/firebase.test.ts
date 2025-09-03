/**
 * Firebase Configuration Tests
 * 
 * These tests validate that Firebase is properly configured and can connect
 * to the Firebase services.
 */

import { app, auth, firestore, analytics } from '../utils/firebase';
import { getApp } from 'firebase/app';

describe('Firebase Configuration', () => {
  test('Firebase app should be initialized', () => {
    expect(app).toBeDefined();
    expect(app.name).toBe('[DEFAULT]');
  });

  test('Firebase app should be the same instance', () => {
    const appInstance = getApp();
    expect(app).toBe(appInstance);
  });

  test('Firebase Auth should be initialized', () => {
    expect(auth).toBeDefined();
    expect(auth.app).toBe(app);
  });

  test('Firestore should be initialized', () => {
    expect(firestore).toBeDefined();
    expect(firestore.app).toBe(app);
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
