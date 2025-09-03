import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserProfile, setUserInfo, findOrCreateUser } from './api'
import { auth as firebaseAuth } from './firebase'
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth'

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  showSidebar: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      setError(null);
      
      if (firebaseUser) {
        console.log('🔥 Firebase user authenticated:', firebaseUser.uid);
        
        let profile: UserProfile = {
          uid: firebaseUser.uid,
          display_name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || 'no-email@example.com',
        };
        
        try {
          profile = await findOrCreateUser(profile);
          console.log('✅ Firestore user created/verified:', profile);
          setUser(profile);
          setUserInfo(profile);
        } catch (error) {
          console.error('❌ Firestore user creation/verification failed:', error);
          setError('Failed to initialize user profile');
        }
      } else {
        console.log('🚫 No authenticated user');
        setUser(null);
        setUserInfo(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [])

  // Update sidebar visibility based on authentication state
  useEffect(() => {
    setShowSidebar(!!user && !isLoading);
  }, [user, isLoading]);

  return { 
    user, 
    isLoading, 
    error, 
    showSidebar,
    isAuthenticated: !!user 
  }
}

export const useRedirectIfNotAuth = () => {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      console.log('🔄 Redirecting to login - no authenticated user');
      router.push('/login');
    }
  }, [user, isLoading, router])

  return user
}

// Authentication helper functions
export const signIn = async (email: string, password: string): Promise<UserProfile> => {
  try {
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const firebaseUser = userCredential.user;
    
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

export const signUp = async (email: string, password: string, displayName: string): Promise<UserProfile> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    const firebaseUser = userCredential.user;
    
    // Update the user's display name
    await updateProfile(firebaseUser, { displayName });
    
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

export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(firebaseAuth);
    setUserInfo(null);
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error('Failed to sign out');
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(firebaseAuth, email);
    console.log('✅ Password reset email sent to:', email);
  } catch (error: any) {
    console.error('Password reset error:', error);
    throw new Error(getAuthErrorMessage(error.code));
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
