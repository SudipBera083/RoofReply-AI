'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { apiClient } from '@/utils/apiClient'
import { Hammer, AlertCircle } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useStore((state) => state.setAuth)
  const setBusiness = useStore((state) => state.setBusiness)
  const addToast = useStore((state) => state.addToast)

  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('+15555555555')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [website, setWebsite] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Submit Registration
      const data = await apiClient.post('/api/auth/register/', {
        email,
        password,
        company_name: companyName,
        phone_number: phone,
        website,
        timezone
      }, { skipAuth: true })

      // Save tokens and user session in Zustand
      setAuth(data.tokens, data.user)

      // 2. Fetch newly created business profile details
      try {
        const bizData = await apiClient.get('/api/businesses/profile/me/', {
          headers: {
            'Authorization': `Bearer ${data.tokens.access}`,
          },
          skipAuth: true
        })
        setBusiness(bizData)
      } catch (bizErr) {
        console.error(bizErr)
      }

      addToast('Company registered successfully!', 'success')
      
      // Redirect to onboarding flow
      router.push('/onboarding')

    } catch (err: any) {
      setError(err.message || 'Connection refused or backend server offline.')
      addToast(err.message || 'Registration failed. Check validation inputs.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 py-8">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="bg-orange-500 text-slate-950 p-2 rounded">
          <Hammer className="h-6 w-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-white">
          RoofReply <span className="text-orange-500">AI</span>
        </span>
      </Link>

      <div className="w-full max-w-md border border-slate-900 bg-slate-900/20 p-8 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold text-white mb-2 text-center">Create your roofing account</h2>
        <p className="text-xs text-slate-500 mb-6 text-center">Instantly start recovering missed calls</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Roofing Company Name</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
              placeholder="StormShield Roofing"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Company Twilio Phone Number</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
              placeholder="+15555555555"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Owner Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
              placeholder="owner@stormshieldroofing.com"
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
              placeholder="•••••••• (min 6 characters)"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Website URL (Optional)</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
              placeholder="https://stormshieldroofing.com"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-slate-950 font-bold py-3 rounded text-sm hover:bg-orange-600 transition disabled:opacity-50 mt-6"
          >
            {loading ? 'Creating account...' : 'Start Lead Recovery Free'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-900 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link href="/login" className="text-orange-500 hover:underline">
            Log in here
          </Link>
        </div>
      </div>
    </div>
  )
}
