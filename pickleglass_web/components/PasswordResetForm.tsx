'use client'

import { useState } from 'react'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { resetPassword } from '@/utils/auth'
import { validatePasswordResetForm, PasswordResetFormData } from '@/utils/validation'

interface PasswordResetFormProps {
  onBack: () => void
  onError: (error: string) => void
}

export default function PasswordResetForm({ onBack, onError }: PasswordResetFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [formData, setFormData] = useState<PasswordResetFormData>({
    email: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})
    
    try {
      const validation = validatePasswordResetForm(formData)
      
      if (!validation.isValid) {
        setErrors(validation.errors)
        return
      }
      
      await resetPassword(formData.email.trim())
      console.log('✅ Password reset email sent to:', formData.email)
      setIsSuccess(true)
      
    } catch (error: any) {
      console.error('❌ Password reset failed:', error)
      onError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToLogin = () => {
    setIsSuccess(false)
    setFormData({ email: '' })
    setErrors({})
    onBack()
  }

  if (isSuccess) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Check Your Email</h3>
          <p className="text-sm text-gray-600 mt-2">
            We've sent a password reset link to:
          </p>
          <p className="text-sm font-medium text-blue-600 mt-1">
            {formData.email}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">Next steps:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the reset link in the email</li>
              <li>Follow the instructions to create a new password</li>
              <li>Return here to sign in with your new password</li>
            </ul>
          </div>
        </div>

        <button
          onClick={handleBackToLogin}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </button>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Didn't receive the email? Check your spam folder or try again in a few minutes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
        <p className="text-sm text-gray-600">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="reset-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ email: e.target.value })}
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your email address"
              disabled={isLoading}
              autoFocus
            />
          </div>
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
        </button>
      </form>

      {/* Back to Login */}
      <div className="text-center">
        <button
          onClick={handleBackToLogin}
          disabled={isLoading}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center justify-center gap-1 mx-auto"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Sign In
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs text-amber-800">
          <Mail className="h-4 w-4 inline mr-1" />
          Make sure to check your spam folder if you don't see the email within a few minutes.
        </p>
      </div>
    </div>
  )
}
