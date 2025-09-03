'use client'

import { useRouter } from 'next/navigation'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/utils/firebase'
import { Chrome, Shield } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isElectronMode, setIsElectronMode] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const mode = urlParams.get('mode')
    setIsElectronMode(mode === 'electron')
  }, [])

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider()
    provider.addScope('email')
    provider.addScope('profile')
    setIsLoading(true)
    
    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      
      if (user) {
        console.log('✅ Google login successful:', user.uid)

        if (isElectronMode) {
          try {
            const idToken = await user.getIdToken()
            
            const deepLinkUrl = `pickleglass://auth-success?` + new URLSearchParams({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              token: idToken
            }).toString()
            
            console.log('🔗 Return to electron app via deep link:', deepLinkUrl)
            window.location.href = deepLinkUrl
            
          } catch (error) {
            console.error('❌ Deep link processing failed:', error)
            alert('Login was successful but failed to return to app. Please check the app.')
          }
        } 
        else if (typeof window !== 'undefined' && window.require) {
          try {
            const { ipcRenderer } = window.require('electron')
            const idToken = await user.getIdToken()
            
            ipcRenderer.send('firebase-auth-success', {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              idToken
            })
            
            console.log('📡 Auth info sent to electron successfully')
          } catch (error) {
            console.error('❌ Electron communication failed:', error)
          }
        } 
        else {
          router.push('/')
        }
      }
    } catch (error: any) {
      console.error('❌ Google login failed:', error)
      
      if (error.code !== 'auth/popup-closed-by-user') {
        alert('An error occurred during login. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
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
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Sign In Required</h2>
            <p className="text-sm text-gray-600 mt-1">
              All data is securely stored in the cloud and synced across your devices
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
          
          <div className="mt-6 text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <Shield className="h-4 w-4 inline mr-1" />
                Authentication is mandatory for security and data synchronization
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-center text-xs text-gray-500 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
