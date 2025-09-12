import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Types for server-side authentication
export interface VerifiedUser {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
}

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // For Firebase App Hosting, credentials are automatically provided
    // For local development, you can use a service account key
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is required');
    }

    // Check if we're running in Firebase App Hosting or have service account credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Use service account key for local development
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } else {
      // Use default credentials (works in Firebase App Hosting and Google Cloud environments)
      initializeApp({
        projectId,
      });
    }
  }
}

// Initialize the admin app
initializeFirebaseAdmin();

// Get Auth instance
export const adminAuth = getAuth();

/**
 * Verify a Firebase ID token and return user information
 * @param token - Firebase ID token from client
 * @returns Verified user information or null if invalid
 */
export async function verifyAuthToken(token: string): Promise<VerifiedUser | null> {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name,
      emailVerified: decodedToken.email_verified || false,
    };
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
}

/**
 * Get user information by UID
 * @param uid - User ID
 * @returns User information or null if not found
 */
export async function getUserByUid(uid: string): Promise<VerifiedUser | null> {
  try {
    const userRecord = await adminAuth.getUser(uid);
    
    return {
      uid: userRecord.uid,
      email: userRecord.email || '',
      displayName: userRecord.displayName,
      emailVerified: userRecord.emailVerified,
    };
  } catch (error) {
    console.error('Error getting user by UID:', error);
    return null;
  }
}
