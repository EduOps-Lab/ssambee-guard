'use client'

import { Activity, LogOut, Moon, Sun, Users, Terminal, LayoutDashboard } from 'lucide-react'
import { useTheme } from '@/providers/ThemeProvider'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { jwtDecode } from 'jwt-decode'

interface HeaderProps {
  token: string
  onLogout: () => void
}

export default function Header({ token, onLogout }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const pathname = usePathname()

  let userRole = 'member'
  try {
    const decoded: any = jwtDecode(token)
    userRole = decoded.role || 'member'
  } catch (e) {
    console.error('Failed to decode token', e)
  }

  const navItems = [
    { name: '대시보드', href: '/', icon: LayoutDashboard },
    { name: '로그 상세', href: '/logs', icon: Terminal },
  ]

  if (userRole === 'admin') {
    navItems.push({ name: '사용자 관리', href: '/users', icon: Users })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b backdrop-blur-md bg-card/80">
      <div className="container flex justify-between items-center px-4 mx-auto h-16">
        <div className="flex gap-6 items-center">
          <Link href="/" className="flex gap-2 items-center">
            <Activity className="w-8 h-8 text-blue-500" />
            <span className="hidden text-xl font-bold md:block">SSAMBEE GUARD</span>
          </Link>

          <nav className="hidden gap-1 items-center md:flex">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-blue-500 bg-blue-500/10'
                      : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  }`}
                >
                  <Icon size={18} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md transition-colors hover:bg-accent text-muted-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <div className="mx-1 w-px h-6 bg-border" />

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </div>
    </header>
  )
}
