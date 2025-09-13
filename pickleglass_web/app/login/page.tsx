'use client'

import { useRouter, useSearchParams } from 'next/navigation'

// Force dynamic rendering - disable static generation
export const dynamic = 'force-dynamic'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/utils/firebase'
import { Chrome, Shield, Mail } from 'lucide-react'
import { useState, useEffect } from 'react'
import EmailPasswordForm from '@/components/EmailPasswordForm'
import PasswordResetForm from '@/components/PasswordResetForm'
import { ClientOnly } from '@/components/ClientOnly'
import { isElectronEnvironment, navigateToUrl } from '@/utils/clientUtils'
import { useClientOnly } from '@/hooks/useClientOnly'

type AuthMode = 'google' | 'email' | 'reset'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isHydrated } = useClientOnly()
  const [isLoading, setIsLoading] = useState(false)
  const [isElectronMode, setIsElectronMode] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('google')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only process URL parameters after hydration is complete
    if (!isHydrated) {
      return;
    }

    const mode = searchParams.get('mode')
    setIsElectronMode(mode === 'electron')
  }, [searchParams, isHydrated])

  const handleAuthSuccess = async (user: any) => {
    console.log('✅ Authentication successful:', user.uid)
    setError(null)

    if (isElectronMode) {
      try {
        // Get Firebase user to access getIdToken method
        const firebaseUser = auth.currentUser
        if (!firebaseUser) {
          throw new Error('No authenticated user found')
        }
        
        const idToken = await firebaseUser.getIdToken()

        // Build deep link via server to include a cryptographic nonce (Phase 1 hardening)
        const returnTo = (searchParams.get('returnUrl') || '/') as string;
        const cn = (searchParams.get('cn') || undefined) as string | undefined;

        const resp = await fetch('/api/auth/deep-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'auth-success',
            token: idToken,
            returnTo,
            // Propagate client nonce (cn) so server deep link includes it for desktop verification
            extra: cn ? { cn } : undefined,
          }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Deep link generation failed: ${resp.status} ${text}`);
        }

        const data = await resp.json() as { url: string; nonce: string };
        console.log('🔗 Return to electron app via deep link (server-generated):', data.url)
        navigateToUrl(data.url)
        
      } catch (error) {
        console.error('❌ Deep link processing failed:', error)
        setError('Login was successful but failed to return to app. Please check the app.')
      }
    } 
    else if (isElectronEnvironment()) {
      try {
        const { ipcRenderer } = (window as any).require('electron')
        const firebaseUser = auth.currentUser
        if (!firebaseUser) {
          throw new Error('No authenticated user found')
        }
        
        const idToken = await firebaseUser.getIdToken()
        
        ipcRenderer.send('firebase-auth-success', {
          uid: user.uid,
          displayName: user.display_name,
          email: user.email,
          idToken
        })
        
        console.log('📡 Auth info sent to electron successfully')
      } catch (error) {
        console.error('❌ Electron communication failed:', error)
        setError('Failed to communicate with desktop app')
      }
    } 
    else {
      router.push('/')
    }
  }

  const handleAuthError = (errorMessage: string) => {
    setError(errorMessage)
  }

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider()
    provider.addScope('email')
    provider.addScope('profile')
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      
      if (user) {
        // Convert Firebase user to UserProfile format
        const userProfile = {
          uid: user.uid,
          display_name: user.displayName || 'User',
          email: user.email || ''
        }
        
        await handleAuthSuccess(userProfile)
      }
    } catch (error: any) {
      console.error('❌ Google login failed:', error)
      
      if (error.code !== 'auth/popup-closed-by-user') {
        setError('Google login failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Loading fallback for server-side rendering
  const loadingFallback = (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <Shield className="h-12 w-12 text-blue-600 mr-3" />
          <h1 className="text-4xl font-bold text-gray-900">Pickle Glass</h1>
        </div>
        <p className="text-gray-600 mt-2 text-lg">Secure cloud-based AI assistant</p>
        <p className="text-gray-500 mt-1">Loading authentication...</p>
      </div>
      
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ClientOnly fallback={loadingFallback}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Pickle Glass</h1>
          </div>
          <p className="text-gray-600 mt-2 text-lg">Secure cloud-based AI assistant</p>
          <p className="text-gray-500 mt-1">Authentication required to access all features</p>
          {isElectronMode && (
            <p className="text-sm text-blue-600 mt-2 font-medium bg-blue-50 px-3 py-1 rounded-full inline-block">
              🔗 Login requested from Desktop App
            </p>
          )}
        </div>
        
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Authentication Mode Tabs */}
            {authMode !== 'reset' && (
              <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setAuthMode('google')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    authMode === 'google'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Chrome className="h-4 w-4 inline mr-1" />
                  Google
                </button>
                <button
                  onClick={() => setAuthMode('email')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    authMode === 'email'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email
                </button>
              </div>
            )}

            {/* Google Authentication */}
            {authMode === 'google' && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Sign In with Google</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Quick and secure authentication with your Google account
                  </p>
                </div>
                
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Chrome className="h-5 w-5" />
                  <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>
              </>
            )}

            {/* Email/Password Authentication */}
            {authMode === 'email' && (
              <>
                <EmailPasswordForm
                  isElectronMode={isElectronMode}
                  onSuccess={handleAuthSuccess}
                  onError={handleAuthError}
                />
                
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setAuthMode('reset')}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Forgot your password?
                  </button>
                </div>
              </>
            )}

            {/* Password Reset */}
            {authMode === 'reset' && (
              <PasswordResetForm
                onBack={() => setAuthMode('email')}
                onError={handleAuthError}
              />
            )}

            {/* Security Notice */}
            {authMode !== 'reset' && (
              <div className="mt-6 text-center">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <Shield className="h-4 w-4 inline mr-1" />
                    Authentication is mandatory for security and data synchronization
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-center text-xs text-gray-500 mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </ClientOnly>
  )
}
