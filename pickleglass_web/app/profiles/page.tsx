'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRedirectIfNotAuth } from '@/utils/auth'
import { 
  getAiProfiles, 
  createAiProfile, 
  updateAiProfile, 
  deleteAiProfile, 
  setDefaultAiProfile,
  AI_MODEL_PRESETS,
  type AiProfile,
  type CreateAiProfileData,
  type UpdateAiProfileData 
} from '@/utils/aiProfiles'
import { 
  Plus, 
  Settings, 
  Trash2, 
  Star, 
  StarOff, 
  Brain, 
  Key, 
  Thermometer, 
  Hash,
  MessageSquare,
  Save,
  X,
  ArrowLeft
} from 'lucide-react'

export default function ProfilesPage() {
  const router = useRouter()
  const user = useRedirectIfNotAuth()
  const [profiles, setProfiles] = useState<AiProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState<AiProfile | null>(null)
  const [formData, setFormData] = useState<CreateAiProfileData>({
    name: '',
    description: '',
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful AI assistant.',
    isDefault: false
  })

  useEffect(() => {
    if (user) {
      loadProfiles()
    }
  }, [user])

  const loadProfiles = async () => {
    try {
      setIsLoading(true)
      const profilesData = await getAiProfiles()
      setProfiles(profilesData)
    } catch (error) {
      console.error('Failed to load AI profiles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProfile = async () => {
    try {
      await createAiProfile(formData)
      await loadProfiles()
      setShowCreateForm(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create profile:', error)
      alert('Failed to create profile. Please try again.')
    }
  }

  const handleUpdateProfile = async () => {
    if (!editingProfile) return
    
    try {
      const updateData: UpdateAiProfileData = {
        name: formData.name,
        description: formData.description,
        model: formData.model,
        provider: formData.provider,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        systemPrompt: formData.systemPrompt,
        isDefault: formData.isDefault
      }
      
      if (formData.apiKey) {
        updateData.apiKey = formData.apiKey
      }
      
      await updateAiProfile(editingProfile.id, updateData)
      await loadProfiles()
      setEditingProfile(null)
      resetForm()
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert('Failed to update profile. Please try again.')
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this AI profile?')) return
    
    try {
      await deleteAiProfile(profileId)
      await loadProfiles()
    } catch (error) {
      console.error('Failed to delete profile:', error)
      alert('Failed to delete profile. Please try again.')
    }
  }

  const handleSetDefault = async (profileId: string) => {
    try {
      await setDefaultAiProfile(profileId)
      await loadProfiles()
    } catch (error) {
      console.error('Failed to set default profile:', error)
      alert('Failed to set default profile. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: 'You are a helpful AI assistant.',
      isDefault: false
    })
  }

  const startEdit = (profile: AiProfile) => {
    setEditingProfile(profile)
    setFormData({
      name: profile.name,
      description: profile.description,
      model: profile.model,
      provider: profile.provider,
      apiKey: '', // Don't pre-fill encrypted API key
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      systemPrompt: profile.systemPrompt,
      isDefault: profile.isDefault
    })
  }

  const cancelEdit = () => {
    setEditingProfile(null)
    setShowCreateForm(false)
    resetForm()
  }

  const applyPreset = (presetKey: string) => {
    const preset = AI_MODEL_PRESETS[presetKey as keyof typeof AI_MODEL_PRESETS]
    if (preset) {
      setFormData(prev => ({
        ...prev,
        model: preset.model,
        provider: preset.provider,
        temperature: preset.defaultTemperature,
        maxTokens: preset.defaultMaxTokens,
        name: prev.name || preset.name,
        description: prev.description || preset.description
      }))
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/')}
              className="mr-4 p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Brain className="h-8 w-8 text-purple-600 mr-3" />
                AI Profiles
              </h1>
              <p className="text-gray-600 mt-1">Manage your AI model configurations and presets</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            New Profile
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading AI profiles...</p>
          </div>
        )}

        {/* Profiles Grid */}
        {!isLoading && !showCreateForm && !editingProfile && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((profile) => (
              <div key={profile.id} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <Brain className="h-6 w-6 text-purple-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                    {profile.isDefault && (
                      <Star className="h-5 w-5 text-yellow-500 ml-2 fill-current" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSetDefault(profile.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title={profile.isDefault ? "Remove as default" : "Set as default"}
                    >
                      {profile.isDefault ? (
                        <StarOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Star className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(profile)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Settings className="h-4 w-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4">{profile.description}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Model:</span>
                    <span className="font-medium">{profile.model}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Provider:</span>
                    <span className="font-medium capitalize">{profile.provider}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Temperature:</span>
                    <span className="font-medium">{profile.temperature}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Max Tokens:</span>
                    <span className="font-medium">{profile.maxTokens}</span>
                  </div>
                </div>
              </div>
            ))}
            
            {profiles.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Profiles</h3>
                <p className="text-gray-600 mb-4">Create your first AI profile to get started</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors mx-auto"
                >
                  <Plus className="h-5 w-5" />
                  Create Profile
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Form */}
        {(showCreateForm || editingProfile) && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingProfile ? 'Edit AI Profile' : 'Create AI Profile'}
                </h2>
                <button
                  onClick={cancelEdit}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6 text-gray-400" />
                </button>
              </div>

              {/* Model Presets */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Start with Preset
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(AI_MODEL_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className="p-3 text-left border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                    >
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{preset.provider}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="My AI Profile"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provider
                    </label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google</option>
                      <option value="local">Local</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Brief description of this profile"
                  />
                </div>

                {/* Model Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Brain className="h-4 w-4 inline mr-1" />
                      Model
                    </label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="gpt-3.5-turbo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Key className="h-4 w-4 inline mr-1" />
                      API Key
                    </label>
                    <input
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={editingProfile ? "Leave empty to keep current" : "Your API key"}
                    />
                  </div>
                </div>

                {/* Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Thermometer className="h-4 w-4 inline mr-1" />
                      Temperature ({formData.temperature})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Focused</span>
                      <span>Creative</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Hash className="h-4 w-4 inline mr-1" />
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={formData.maxTokens}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      min="1"
                      max="8192"
                    />
                  </div>
                </div>

                {/* System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MessageSquare className="h-4 w-4 inline mr-1" />
                    System Prompt
                  </label>
                  <textarea
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="You are a helpful AI assistant..."
                  />
                </div>

                {/* Default Setting */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                    Set as default profile
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingProfile ? handleUpdateProfile : handleCreateProfile}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    {editingProfile ? 'Update Profile' : 'Create Profile'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
