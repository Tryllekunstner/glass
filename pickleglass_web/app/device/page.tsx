'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function DeviceCodePage() {
  const router = useRouter()
  const search = useSearchParams()
  const [userCode, setUserCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const code = search.get('code') || ''
    if (code) {
      setUserCode(code.trim())
    }
  }, [search])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userCode.trim()) {
      setMessage('Please enter the device code displayed on your desktop app.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setMessage('')
    try {
      const resp = await fetch('/api/device-code/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: userCode.trim() })
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || data?.success === false) {
        const err = data?.error || `HTTP ${resp.status}`
        setStatus('error')
        setMessage(`Verification failed: ${err}`)
        return
      }
      setStatus('success')
      setMessage('Device verified. You can return to the desktop app.')
      // Optionally redirect to home after a short delay
      setTimeout(() => router.push('/'), 1200)
    } catch (e: any) {
      setStatus('error')
      setMessage(`Network error: ${e?.message || e}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Link Your Desktop</h1>
          <p className="text-sm text-gray-600 mt-2">
            Enter the device code shown in the desktop app to complete the sign-in.
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg border ${
              status === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : status === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <p className="text-sm">{message}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <label htmlFor="userCode" className="block text-sm font-medium text-gray-700">
            Device Code
          </label>
          <input
            id="userCode"
            name="userCode"
            type="text"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center"
            autoComplete="one-time-code"
            maxLength={9}
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {status === 'submitting' ? 'Verifying…' : 'Verify'}
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          You must be signed in on the web to complete this step.
        </p>
      </div>
    </div>
  )
}
