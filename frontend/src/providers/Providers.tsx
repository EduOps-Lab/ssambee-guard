'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { useState, Suspense } from 'react'
import { ThemeProvider } from './ThemeProvider'
import { AuthProvider } from './AuthProvider'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <AuthProvider>
          <ThemeProvider>
            <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-400">로딩 중...</div>}>
              {children}
            </Suspense>
          </ThemeProvider>
        </AuthProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  )
}
