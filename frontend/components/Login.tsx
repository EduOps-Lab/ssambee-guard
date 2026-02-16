'use client'

import React, { useState } from 'react'
import axios from 'axios'
import Link from 'next/link'

interface LoginProps {
  onLogin: (token: string) => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await axios.post(`${apiUrl}/login`, { username, password })
      onLogin(response.data.token)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-900">
      <div className="p-8 w-96 rounded-lg border shadow-xl bg-slate-800 border-slate-700">
        <h1 className="mb-6 text-2xl font-bold text-center text-blue-400">Monitoring Central</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-300">Username</label>
            <input
              type="text"
              className="p-2 w-full text-white rounded border bg-slate-700 border-slate-600 focus:outline-none focus:border-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              className="p-2 w-full text-white rounded border bg-slate-700 border-slate-600 focus:outline-none focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-2 w-full font-bold text-white bg-blue-600 rounded transition duration-200 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-blue-400 hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
