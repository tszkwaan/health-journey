"use client"
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [voiceAIConsent, setVoiceAIConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchUserSettings()
  }, [session, status, router])

  async function fetchUserSettings() {
    try {
      const res = await fetch('/api/user/settings')
      if (res.ok) {
        const data = await res.json()
        setVoiceAIConsent(data.voiceAIConsent || false)
      }
    } catch (error) {
      console.error('Error fetching user settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceAIConsent }),
      })
      
      if (res.ok) {
        setMessage('Settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('Failed to save settings. Please try again.')
      }
    } catch (error) {
      setMessage('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
        fontFamily: 'var(--font-noto-sans)'
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
      fontFamily: 'var(--font-noto-sans)'
    }}>
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold mb-8 text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
              Settings
            </h1>

            {/* VoiceAI Settings */}
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                  VoiceAI Preferences
                </h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    I consent to the use of VoiceAI throughout the pre-care and consultation processes, including patient intake, clinical recording, transcription, and summarization. I understand that my personal data will be collected and processed securely in compliance with applicable privacy and healthcare regulations. I acknowledge that this technology is intended to support, but not replace, professional medical judgment. I further understand that I may withdraw my consent at any time, and upon withdrawal, no further VoiceAI services will be provided during my care sessions.                    </p>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="voiceAIConsent"
                      checked={voiceAIConsent}
                      onChange={(e) => setVoiceAIConsent(e.target.checked)}
                      className="mt-1 w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                    />
                    <label 
                      htmlFor="voiceAIConsent" 
                      className="text-sm text-gray-700 cursor-pointer" 
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    >
                      Enable VoiceAI for voice input and recording
                    </label>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => router.back()}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

              {/* Message */}
              {message && (
                <div className={`p-4 rounded-xl ${
                  message.includes('successfully') 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`} style={{ fontFamily: 'var(--font-noto-sans)' }}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
