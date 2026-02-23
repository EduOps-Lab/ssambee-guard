'use client'

import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import Dashboard from '@/components/Dashboard'
import { useAuth } from '@/providers/AuthProvider'

export default function Home() {
  const { token } = useAuth()

  return (
    <AuthenticatedLayout>
      {token && <Dashboard token={token} />}
    </AuthenticatedLayout>
  )
}
