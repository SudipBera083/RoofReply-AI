'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { apiClient } from '@/utils/apiClient'
import { Hammer, Users, MessageSquare, Calendar, Settings, LogOut, Menu, X } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  
  const accessToken = useStore((state) => state.accessToken)
  const user = useStore((state) => state.user)
  const business = useStore((state) => state.business)
  const authHydrated = useStore((state) => state.authHydrated)
  const initializeAuth = useStore((state) => state.initializeAuth)
  const clearAuth = useStore((state) => state.clearAuth)
  const setBusiness = useStore((state) => state.setBusiness)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // 1. Initialize session on mount
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // 2. Fetch business profile if authenticated but business data is missing
  useEffect(() => {
    if (authHydrated && accessToken && !business && !loadingProfile) {
      setLoadingProfile(true)
      apiClient.get('/api/businesses/profile/me/')
        .then((bizData) => {
          setBusiness(bizData)
        })
        .catch((err) => {
          console.error("Failed to restore business profile details:", err)
        })
        .finally(() => {
          setLoadingProfile(false)
        })
    }
  }, [authHydrated, accessToken, business, setBusiness, loadingProfile])

  // 3. Authorization & Onboarding Redirect Guard
  useEffect(() => {
    if (authHydrated) {
      if (!accessToken) {
        router.push('/login')
      } else if (business && !business.onboarding_completed && pathname !== '/onboarding') {
        router.push('/onboarding')
      }
    }
  }, [authHydrated, accessToken, business, pathname, router])

  if (!authHydrated || !accessToken || (business && !business.onboarding_completed && pathname !== '/onboarding') || loadingProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-slate-500 gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
        <span>Syncing session details...</span>
      </div>
    )
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const menuItems = [
    { name: 'Overview', href: '/dashboard', icon: Hammer },
    { name: 'Leads Feed', href: '/dashboard/leads', icon: Users },
    { name: 'Conversations', href: '/dashboard/conversations', icon: MessageSquare },
    { name: 'Inspections', href: '/dashboard/appointments', icon: Calendar },
    { name: 'Company Setup', href: '/dashboard/settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-900 bg-slate-900/10 shrink-0">
        <div className="p-6 border-b border-slate-900 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="bg-orange-500 text-slate-950 p-1.5 rounded">
              <Hammer className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              RoofReply <span className="text-orange-500 text-sm font-mono">AI</span>
            </span>
          </Link>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-semibold transition ${
                  isActive
                    ? 'bg-orange-500 text-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* User profile box / Logout */}
        <div className="p-4 border-t border-slate-900 space-y-3">
          <div className="bg-slate-900/30 border border-slate-900 p-3 rounded">
            <div className="text-xs font-mono text-slate-500 uppercase">Tenant Scope</div>
            <div className="text-sm font-bold text-white truncate">{business?.company_name || 'Loading company...'}</div>
            <div className="text-[10px] font-mono text-slate-400 truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/5 transition"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Header - Mobile */}
      <header className="md:hidden border-b border-slate-900 bg-slate-950 p-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="bg-orange-500 text-slate-950 p-1.5 rounded">
            <Hammer className="h-4 w-4" />
          </div>
          <span className="text-md font-bold tracking-tight text-white">
            RoofReply <span className="text-orange-500">AI</span>
          </span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-400 hover:text-white p-2 border border-slate-900 rounded"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Sidebar overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[65px] bg-slate-950 z-40 flex flex-col p-6 space-y-6">
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 px-4 py-4 rounded text-md font-bold transition ${
                    isActive
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
          
          <div className="pt-6 border-t border-slate-900 space-y-4">
            <div className="bg-slate-900/40 p-4 rounded border border-slate-900">
              <div className="text-xs font-mono text-slate-500 uppercase mb-1">Company Scope</div>
              <div className="text-md font-bold text-white">{business?.company_name}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 w-full px-4 py-4 rounded text-md font-bold text-red-400"
            >
              <LogOut className="h-6 w-6 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main dashboard content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
