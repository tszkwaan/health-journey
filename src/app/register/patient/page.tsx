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
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">Patient Registration</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input className="w-full border p-2 rounded" placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        {message && <p className="text-sm">{message}</p>}
        <button className="w-full bg-black text-white p-2 rounded" type="submit">Register</button>
      </form>
    </div>
  )
}


