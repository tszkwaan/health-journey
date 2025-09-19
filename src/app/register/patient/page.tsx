"use client"
import { useState } from 'react'

export default function PatientRegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    
    if (!consent) {
      setMessage('You must agree to the consent terms to register.')
      return
    }
    
    const res = await fetch('/api/register/patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (res.ok) setMessage('Registered successfully. You can now login.')
    else setMessage('Registration failed.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
      fontFamily: 'var(--font-noto-sans)'
    }}>
      <div className="mx-auto max-w-md p-8 bg-white rounded-3xl shadow-2xl border border-purple-100">
        <h1 className="text-3xl font-bold mb-6 text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
          Patient Registration
        </h1>
        <form onSubmit={onSubmit} className="space-y-6">
          <input 
            className="w-full border-2 border-purple-200 p-4 rounded-2xl focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200" 
            placeholder="Name" 
            value={name} 
            onChange={(e)=>setName(e.target.value)} 
            style={{ fontFamily: 'var(--font-noto-sans)' }}
          />
          <input 
            className="w-full border-2 border-purple-200 p-4 rounded-2xl focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200" 
            placeholder="Email" 
            value={email} 
            onChange={(e)=>setEmail(e.target.value)} 
            style={{ fontFamily: 'var(--font-noto-sans)' }}
          />
          <input 
            className="w-full border-2 border-purple-200 p-4 rounded-2xl focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200" 
            placeholder="Password" 
            type="password" 
            value={password} 
            onChange={(e)=>setPassword(e.target.value)} 
            style={{ fontFamily: 'var(--font-noto-sans)' }}
          />
          
          {/* Consent Section */}
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-700 leading-relaxed" style={{ fontFamily: 'var(--font-noto-sans)' }}>
              I consent to the use of VoiceAI throughout the pre-care and during-care process, including intake and consultation processes for recording, transcription, and summarization purposes. I understand my data will be handled securely and that I can revoke my consent at any time.
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <label 
                htmlFor="consent" 
                className="text-sm text-gray-700 cursor-pointer" 
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              >
                I Agree
              </label>
            </div>
          </div>
          
          {message && (
            <p className={`text-sm text-center p-3 rounded-lg ${
              message.includes('must agree') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-purple-50 text-purple-700'
            }`} style={{ fontFamily: 'var(--font-noto-sans)' }}>
              {message}
            </p>
          )}
          
          <button 
            className={`w-full p-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg ${
              consent 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700' 
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            type="submit"
            disabled={!consent}
            style={{ fontFamily: 'var(--font-noto-sans)' }}
          >
            Register
          </button>
        </form>
      </div>
    </div>
  )
}


