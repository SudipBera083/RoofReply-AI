'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { apiClient } from '@/utils/apiClient'
import { Hammer, AlertCircle, Play } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useStore((state) => state.setAuth)
  const setBusiness = useStore((state) => state.setBusiness)
  const addToast = useStore((state) => state.addToast)
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDemoFill = () => {
    setEmail('demo@stormshieldroofing.com')
    setPassword('password123')
    addToast('Demo credentials filled.', 'success')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Authenticate with backend API
      const tokens = await apiClient.post('/api/auth/login/', { email, password }, { skipAuth: true })

      // 2. Fetch User Info
      const userData = await apiClient.get('/api/auth/me/', {
        headers: {
          'Authorization': `Bearer ${tokens.access}`,
        },
        skipAuth: true
      })
      
      // Save tokens and user session in Zustand
      setAuth(tokens, userData)

      // 3. Fetch Business profile details
      try {
        const bizData = await apiClient.get('/api/businesses/profile/me/', {
          headers: {
            'Authorization': `Bearer ${tokens.access}`,
          },
          skipAuth: true
        })
        setBusiness(bizData)
        
        addToast(`Welcome back, ${userData.email}!`, 'success')

        // Redirect based on onboarding state
        if (!bizData.onboarding_completed) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      } catch (bizErr) {
        // Business profile missing or not created yet
        console.error(bizErr)
        addToast('Login successful, routing to onboarding settings...', 'info')
        router.push('/onboarding')
      }

    } catch (err: any) {
      setError(err.message || 'Connection refused or backend server offline.')
      addToast(err.message || 'Login failed.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="bg-orange-500 text-slate-950 p-2 rounded">
          <Hammer className="h-6 w-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-white">
          RoofReply <span className="text-orange-500">AI</span>
        </span>
      </Link>

      <div className="w-full max-w-md border border-slate-900 bg-slate-900/20 p-8 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold text-white mb-2 text-center">Log in to your dashboard</h2>
        <p className="text-xs text-slate-500 mb-6 text-center">Manage your missed calls & estimator scheduler</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
              placeholder="demo@stormshieldroofing.com"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-orange-500 text-slate-950 font-bold py-3 rounded text-sm hover:bg-orange-600 transition disabled:opacity-50 mt-4"
            >
              {loading ? 'Logging in...' : 'Access Mission Control'}
            </button>
            
            <button
              type="button"
              onClick={handleDemoFill}
              className="bg-slate-900 border border-slate-800 text-orange-500 hover:border-slate-700 px-4 py-3 rounded text-sm font-mono mt-4 flex items-center gap-1 transition"
              title="Auto-fill Demo Credentials"
            >
              <Play className="h-4 w-4" /> DEMO
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-900 text-center text-xs text-slate-500">
          New to RoofReply AI?{' '}
          <Link href="/register" className="text-orange-500 hover:underline">
            Register your company
          </Link>
        </div>
      </div>
    </div>
  )
}
