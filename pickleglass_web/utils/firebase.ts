// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Import configuration utilities
import { getFirebaseConfig, logConfigurationStatus, isDevelopment } from "./config";

// Get validated Firebase configuration
let firebaseConfig;
try {
  firebaseConfig = getFirebaseConfig();
  
  // Log configuration status for debugging
  if (isDevelopment()) {
    logConfigurationStatus(true); // Include values in development
  } else {
    logConfigurationStatus(false); // Hide values in production
  }
} catch (error) {
  console.error('🚨 Firebase Configuration Error:', error);
  throw new Error(`Firebase configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const firestore = getFirestore(app);

// Enable persistent authentication
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Failed to set auth persistence:', error);
  });
}

// Initialize Analytics only in browser environment and production
let analytics: any = null;
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true') {
  analytics = getAnalytics(app);
}

// Token refresh utilities
export const refreshAuthToken = async () => {
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken(true); // Force refresh
      console.log('🔄 Auth token refreshed successfully');
      return token;
    } catch (error) {
      console.error('❌ Failed to refresh auth token:', error);
      throw error;
    }
  }
  throw new Error('No authenticated user');
};

// Check if user token is valid and refresh if needed
export const ensureValidToken = async () => {
  if (!auth.currentUser) {
    throw new Error('No authenticated user');
  }
  
  try {
    // Get token result to check expiration
    const tokenResult = await auth.currentUser.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime);
    const now = new Date();
    
    // Refresh token if it expires within 5 minutes
    if (expirationTime.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log('🔄 Token expiring soon, refreshing...');
      return await refreshAuthToken();
    }
    
    return tokenResult.token;
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    throw error;
  }
};

export { app, auth, firestore, analytics };
