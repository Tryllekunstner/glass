'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

type AgentConfig = {
  id: string
  uid: string
  orgId?: string
  name: string
  type: 'ask' | 'listen' | 'custom'
  modelProvider: 'openai' | 'anthropic' | 'google' | 'local'
  modelId: string
  temperature?: number | null
  maxTokens?: number | null
  systemPrompt?: string | null
  tools?: string[] | null
  active: boolean
  updatedAt?: any
}

type ListResponse = {
  success: boolean
  uid: string
  orgId?: string | null
  items: AgentConfig[]
  count: number
  timestamp: string
}

type CreateResponse = {
  success: boolean
  uid: string
  agentConfig: AgentConfig
  timestamp: string
}

const PROVIDERS: Array<AgentConfig['modelProvider']> = ['openai', 'anthropic', 'google', 'local']
const TYPES: Array<AgentConfig['type']> = ['ask', 'listen', 'custom']

export default function AgentsSettingsPage() {
  const sp = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AgentConfig[]>([])
  const [creating, setCreating] = useState(false)
  const [orgMode, setOrgMode] = useState<boolean>(false)

  // Simple create form state
  const [name, setName] = useState('')
  const [type, setType] = useState<AgentConfig['type']>('ask')
  const [provider, setProvider] = useState<AgentConfig['modelProvider']>('openai')
  const [modelId, setModelId] = useState('')
  const [active, setActive] = useState(true)

  // Read orgId from query (?orgId=xyz). When preset, force org mode ON.
  const queryOrgId = useMemo(() => {
    const v = sp.get('orgId')
    return v && v.trim() ? v.trim() : null
  }, [sp])

  useEffect(() => {
    if (queryOrgId) setOrgMode(true)
  }, [queryOrgId])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/agent-configs', window.location.origin)
      if (orgMode && queryOrgId) {
        url.searchParams.set('orgId', queryOrgId)
      }
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      })
      const data: ListResponse = await resp.json().catch(() => ({ success: false } as any))
      if (!resp.ok || !data?.success) {
        throw new Error(data as any as string || `HTTP ${resp.status}`)
      }
      setItems(data.items || [])
    } catch (e: any) {
      setError(`Failed to load agent configs: ${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgMode, queryOrgId])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      if (!name.trim()) throw new Error('Name is required')
      if (!modelId.trim()) throw new Error('Model ID is required')

      const body: any = {
        name: name.trim(),
        type,
        modelProvider: provider,
        modelId: modelId.trim(),
        active,
      }
      if (orgMode && queryOrgId) {
        body.orgId = queryOrgId
      }

      const resp = await fetch('/api/agent-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data: CreateResponse = await resp.json().catch(() => ({ success: false } as any))
      if (!resp.ok || !data?.success) {
        // Try surface server provided error
        throw new Error((data as any)?.error || `HTTP ${resp.status}`)
      }

      // Reset form and refresh list
      setName('')
      setType('ask')
      setProvider('openai')
      setModelId('')
      setActive(true)
      await refresh()
    } catch (e: any) {
      setError(`Failed to create agent config: ${e?.message || e}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Agent Configurations</h1>
          <p className="text-sm text-gray-600">
            Manage personal or organization-wide agent configurations. Org configs require owner/admin role.
          </p>
        </div>

        {/* Scope selector */}
        <div className="mb-6 flex items-center gap-3">
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={orgMode}
              onChange={(e) => setOrgMode(e.target.checked)}
              disabled={!!queryOrgId} // forced by URL
            />
            <span className="text-sm text-gray-800">Organization scope</span>
          </label>
          {orgMode && (
            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
              orgId={queryOrgId || '(not set)'}
            </span>
          )}
        </div>

        {/* Create form */}
        <form onSubmit={onCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Assistant name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Model ID</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g., gpt-4o-mini"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <label className="inline-flex items-center space-x-2">
              <input type="checkbox" className="h-4 w-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="text-sm">Active</span>
            </label>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}
        </form>

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Existing Configs</h2>
            <button
              onClick={refresh}
              className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">No agent configs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Scope</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Model</th>
                    <th className="py-2 pr-3">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-900">{it.name}</td>
                      <td className="py-2 pr-3">
                        {it.orgId ? (
                          <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                            org:{it.orgId}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-700 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                            personal
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{it.type}</td>
                      <td className="py-2 pr-3">{it.modelProvider}</td>
                      <td className="py-2 pr-3">{it.modelId}</td>
                      <td className="py-2 pr-3">{it.active ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
