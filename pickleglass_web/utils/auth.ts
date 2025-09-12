import { useEffect, useState } from 'react'
import { UserProfile, setUserInfo, findOrCreateUser } from './api'
import { auth as firebaseAuth } from './firebase'
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth'
import { useClientOnly } from '../hooks/useClientOnly'

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  showSidebar: boolean;
  isHydrated: boolean;
}

/**
 * Simplified client-side authentication hook
 * Server-side authentication handles route protection and redirects
 * This hook only manages UI state and Firebase client authentication
 */
export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const { isHydrated } = useClientOnly()
  
  useEffect(() => {
    // Only set up auth listener after hydration is complete
    if (!isHydrated) {
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      setError(null);
      
      if (firebaseUser) {
        console.log('🔥 Firebase user authenticated:', firebaseUser.uid);
        
        try {
          // Get fresh ID token for server-side authentication
          const token = await firebaseUser.getIdToken(true);
          
          // Send token to server for session management
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });

          let profile: UserProfile = {
            uid: firebaseUser.uid,
            display_name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || 'no-email@example.com',
          };
          
          profile = await findOrCreateUser(profile);
          console.log('✅ User profile synchronized:', profile);
          setUser(profile);
          setUserInfo(profile);
        } catch (error) {
          console.error('❌ User profile synchronization failed:', error);
          setError('Failed to initialize user profile');
        }
      } else {
        console.log('🚫 No authenticated user');
        
        // Clear server-side session
        try {
          await fetch('/api/auth/session', {
            method: 'DELETE',
          });
        } catch (error) {
          console.warn('Failed to clear server session:', error);
        }
        
        setUser(null);
        setUserInfo(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isHydrated])

  // Update sidebar visibility based on authentication state and hydration
  useEffect(() => {
    setShowSidebar(!!user && !isLoading && isHydrated);
  }, [user, isLoading, isHydrated]);

  return { 
    user, 
    isLoading, 
    error, 
    showSidebar,
    isAuthenticated: !!user,
    isHydrated
  }
}

/**
 * Sign in with email and password
 * Server-side middleware will handle route protection and redirects
 */
export const signIn = async (email: string, password: string): Promise<UserProfile> => {
  try {
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const firebaseUser = userCredential.user;
    
    // Get ID token for server-side authentication
    const token = await firebaseUser.getIdToken();
    
    // Create session on server
    const sessionResponse = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to create server session');
    }
    
    const profile: UserProfile = {
      uid: firebaseUser.uid,
      display_name: firebaseUser.displayName || 'User',
      email: firebaseUser.email || email,
    };
    
    return await findOrCreateUser(profile);
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * Sign up with email, password, and display name
 */
export const signUp = async (email: string, password: string, displayName: string): Promise<UserProfile> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    const firebaseUser = userCredential.user;
    
    // Update the user's display name
    await updateProfile(firebaseUser, { displayName });
    
    // Get ID token for server-side authentication
    const token = await firebaseUser.getIdToken();
    
    // Create session on server
    const sessionResponse = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to create server session');
    }
    
    const profile: UserProfile = {
      uid: firebaseUser.uid,
      display_name: displayName,
      email: email,
    };
    
    return await findOrCreateUser(profile);
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * Sign out user and clear server session
 */
export const signOutUser = async (): Promise<void> => {
  try {
    // Clear server-side session first
    await fetch('/api/auth/session', {
      method: 'DELETE',
    });
    
    // Then sign out from Firebase
    await signOut(firebaseAuth);
    setUserInfo(null);
    
    console.log('✅ User signed out successfully');
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error('Failed to sign out');
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(firebaseAuth, email);
    console.log('✅ Password reset email sent to:', email);
  } catch (error: any) {
    console.error('Password reset error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * Refresh authentication token
 * Called when server indicates token refresh is needed
 */
export const refreshAuthToken = async (): Promise<void> => {
  try {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    // Force token refresh
    const token = await currentUser.getIdToken(true);
    
    // Update server session with new token
    const response = await fetch('/api/auth/session', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh server session');
    }

    console.log('✅ Authentication token refreshed');
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
};

/**
 * Check if user needs to refresh their token
 * This can be called when server returns X-Token-Refresh-Required header
 */
export const handleTokenRefreshRequired = async (): Promise<void> => {
  try {
    await refreshAuthToken();
  } catch (error) {
    console.error('Failed to refresh token, signing out user:', error);
    await signOutUser();
  }
};

// Helper function to convert Firebase auth error codes to user-friendly messages
const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/operation-not-allowed':
      return 'Email/password authentication is not enabled.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/requires-recent-login':
      return 'Please sign in again to complete this action.';
    case 'auth/missing-email':
      return 'Email address is required.';
    case 'auth/missing-password':
      return 'Password is required.';
    default:
      return 'Authentication failed. Please try again.';
  }
};
