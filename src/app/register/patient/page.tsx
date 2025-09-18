"use client"
import { useState } from 'react'

export default function PatientRegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
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
      background: 'linear-gradient(180deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)'
    }}>
      <div className="mx-auto max-w-md p-8 bg-white rounded-3xl shadow-2xl border border-purple-100">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Patient Registration</h1>
        <form onSubmit={onSubmit} className="space-y-6">
          <input 
            className="w-full border-2 border-purple-200 p-4 rounded-2xl focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200" 
            placeholder="Name" 
            value={name} 
            onChange={(e)=>setName(e.target.value)} 
          />
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
          {message && <p className="text-sm text-center p-3 rounded-lg bg-purple-50 text-purple-700">{message}</p>}
          <button 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-2xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg" 
            type="submit"
          >
            Register
          </button>
        </form>
      </div>
    </div>
  )
}


