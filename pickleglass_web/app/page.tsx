'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/utils/auth'
import { Shield, Activity, Settings, MessageSquare, Brain } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // No user authenticated - redirect to login
        console.log('🔄 No authenticated user, redirecting to login');
        router.push('/login');
      }
      // If user is authenticated, stay on this page (dashboard)
    }
  }, [user, isLoading, router])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Authenticating...</p>
          <p className="text-sm text-gray-500 mt-1">Verifying your identity</p>
        </div>
      </div>
    )
  }

  // If no user, don't render anything (will redirect to login)
  if (!user) {
    return null;
  }

  // Authenticated user - show dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Pickle Glass Dashboard</h1>
          </div>
          <p className="text-xl text-gray-600">Welcome back, {user.display_name}!</p>
          <p className="text-gray-500 mt-1">Secure cloud-based AI assistant</p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Activity Card */}
          <div 
            onClick={() => router.push('/activity')}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <Activity className="h-8 w-8 text-green-600 group-hover:text-green-700" />
              <h3 className="text-xl font-semibold text-gray-900 ml-3">Activity</h3>
            </div>
            <p className="text-gray-600">View your conversation history and AI interactions</p>
            <div className="mt-4 text-sm text-green-600 font-medium">View Activity →</div>
          </div>

          {/* AI Profiles Card */}
          <div 
            onClick={() => router.push('/profiles')}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <Brain className="h-8 w-8 text-purple-600 group-hover:text-purple-700" />
              <h3 className="text-xl font-semibold text-gray-900 ml-3">AI Profiles</h3>
            </div>
            <p className="text-gray-600">Configure AI models, API keys, and behavior settings</p>
            <div className="mt-4 text-sm text-purple-600 font-medium">Manage Profiles →</div>
          </div>

          {/* Settings Card */}
          <div 
            onClick={() => router.push('/settings')}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <Settings className="h-8 w-8 text-blue-600 group-hover:text-blue-700" />
              <h3 className="text-xl font-semibold text-gray-900 ml-3">Settings</h3>
            </div>
            <p className="text-gray-600">Account settings, preferences, and privacy controls</p>
            <div className="mt-4 text-sm text-blue-600 font-medium">Manage Settings →</div>
          </div>

          {/* Personalize Card */}
          <div 
            onClick={() => router.push('/personalize')}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow cursor-pointer group"
          >
            <div className="flex items-center mb-4">
              <MessageSquare className="h-8 w-8 text-indigo-600 group-hover:text-indigo-700" />
              <h3 className="text-xl font-semibold text-gray-900 ml-3">Personalize</h3>
            </div>
            <p className="text-gray-600">Customize prompts and AI behavior preferences</p>
            <div className="mt-4 text-sm text-indigo-600 font-medium">Personalize →</div>
          </div>
        </div>

        {/* Status Section */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">✓</div>
                <p className="text-sm text-gray-600 mt-1">Authenticated</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">☁</div>
                <p className="text-sm text-gray-600 mt-1">Cloud Sync</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">🔒</div>
                <p className="text-sm text-gray-600 mt-1">Secure</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
