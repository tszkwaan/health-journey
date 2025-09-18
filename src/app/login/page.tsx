"use client"
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await signIn('credentials', { redirect: false, email, password })
    if (res?.error) {
      setError('Invalid credentials')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)'
    }}>
      <div className="mx-auto max-w-md p-8 bg-white rounded-3xl shadow-2xl border border-purple-100">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Login</h1>
        <p className="text-sm text-gray-600 mb-6">Patients and doctors use the same login.</p>
        <form onSubmit={onSubmit} className="space-y-6">
          <input 
            className="w-full border-2 border-purple-200 p-4 rounded-2xl focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200" 
            placeholder="Email" 
            value={email} 
            onChange={(e)=>setEmail(e.target.value)} 
          />
          <input 
            className="w-full border-2 border-purple-200 p-4 rounded-2xl focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200" 
            placeholder="Password" 
            type="password" 
            value={password} 
            onChange={(e)=>setPassword(e.target.value)} 
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-2xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg" 
            type="submit"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}


