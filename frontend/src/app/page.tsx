'use client'

import { useState, useEffect } from 'react'
import Login from '@/components/Login'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const [token, setToken] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('token') : null
  )

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }, [token])

  if (!token) {
    return <Login onLogin={setToken} />
  }

  return <Dashboard token={token} onLogout={() => setToken(null)} />
}
