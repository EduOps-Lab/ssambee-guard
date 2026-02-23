'use client'

import React from 'react'
import { useAuth } from '@/providers/AuthProvider'
import Login from './Login'
import Header from './Header'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { token, login, logout, isLoading } = useAuth()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-blue-500">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!token) {
    return <Login onLogin={login} />
  }

  return (
    <div className="min-h-screen bg-background">
      <Header token={token} onLogout={logout} />
      <main className="container mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  )
}
