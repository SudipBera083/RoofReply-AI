'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { apiClient } from '@/utils/apiClient'
import { Hammer, CheckCircle, ShieldAlert, ArrowRight, ArrowLeft } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const accessToken = useStore((state) => state.accessToken)
  const business = useStore((state) => state.business)
  const authHydrated = useStore((state) => state.authHydrated)
  const initializeAuth = useStore((state) => state.initializeAuth)
  const setBusiness = useStore((state) => state.setBusiness)
  const addToast = useStore((state) => state.addToast)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form states
  const [companyName, setCompanyName] = useState('')
  const [twilioNumber, setTwilioNumber] = useState('')
  const [website, setWebsite] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  
  // Working hours
  const [workHours, setWorkHours] = useState<Record<string, { open: string; close: string }>>({
    monday: { open: '08:00', close: '17:00' },
    tuesday: { open: '08:00', close: '17:00' },
    wednesday: { open: '08:00', close: '17:00' },
    thursday: { open: '08:00', close: '17:00' },
    friday: { open: '08:00', close: '17:00' },
  })

  // FAQ state
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([
    { question: 'Do you offer free roof inspections?', answer: 'Yes, we offer 100% free digital roof damage inspections and estimates.' },
    { question: 'Do you work with insurance claims?', answer: 'Yes, we assist with insurance claim adjustments, damage audits, and provide adjusters with documentation.' }
  ])
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')

  // Load session
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // Prepopulate form states once business is retrieved
  useEffect(() => {
    if (business) {
      setCompanyName(business.company_name || '')
      setTwilioNumber(business.phone_number || '')
      setWebsite(business.website || '')
      setTimezone(business.timezone || 'America/New_York')
      if (business.working_hours && Object.keys(business.working_hours).length > 0) {
        setWorkHours(business.working_hours)
      }
    }
  }, [business])

  // Check auth protection
  useEffect(() => {
    if (authHydrated && !accessToken) {
      router.push('/login')
    }
  }, [authHydrated, accessToken, router])

  if (!authHydrated || !accessToken || !business) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-slate-500 gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
        <span>Verifying onboarding credentials...</span>
      </div>
    )
  }

  const handleHourChange = (day: string, field: 'open' | 'close', value: string) => {
    setWorkHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }))
  }

  const addFaq = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return
    setFaqs(prev => [...prev, { question: newQuestion, answer: newAnswer }])
    setNewQuestion('')
    setNewAnswer('')
  }

  const removeFaq = (index: number) => {
    setFaqs(prev => prev.filter((_, i) => i !== index))
  }

  const handleFinishOnboarding = async () => {
    setLoading(true)
    setError('')
    try {
      // 1. Save FAQs to knowledge base
      for (const faq of faqs) {
        await apiClient.post('/api/businesses/knowledge-base/', {
          question: faq.question,
          answer: faq.answer,
          active: true
        })
      }

      // 2. Save Business profile, marking onboarding complete
      const updatedBiz = await apiClient.put('/api/businesses/profile/me/', {
        company_name: companyName,
        phone_number: twilioNumber,
        website: website,
        timezone: timezone,
        working_hours: workHours,
        onboarding_completed: true
      })

      setBusiness(updatedBiz)
      addToast('Onboarding completed successfully!', 'success')
      router.push('/dashboard')

    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding settings.')
      addToast(err.message || 'Onboarding failed to save.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 md:p-12 items-center justify-center">
      <div className="flex items-center gap-2 mb-8">
        <div className="bg-orange-500 text-slate-950 p-2 rounded">
          <Hammer className="h-6 w-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-white">
          RoofReply <span className="text-orange-500">AI</span>
        </span>
      </div>

      <div className="w-full max-w-2xl border border-slate-900 bg-slate-900/10 p-6 md:p-10 rounded-lg shadow-xl relative overflow-hidden">
        {/* Progress header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-900 text-xs font-mono">
          <span className="text-slate-500 uppercase tracking-wider">Onboarding Steps</span>
          <span className="text-orange-500 font-bold">Step {step} of 4</span>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded text-sm mb-6 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Company Profile */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Verify Company Credentials</h2>
              <p className="text-xs text-slate-500">Let's verify your roofing business credentials.</p>
            </div>
            
            <div className="space-y-4">
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
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Connected Twilio Number</label>
                <input
                  type="text"
                  required
                  value={twilioNumber}
                  onChange={(e) => setTwilioNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
                  placeholder="+15555555555"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Company Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 text-sm"
                  placeholder="https://stormshieldroofing.com"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Timezone & Working Hours */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Set Working Hours & Timezone</h2>
              <p className="text-xs text-slate-500">AI relies on these hours to schedule roof inspection slots automatically.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Business Timezone</label>
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

              <div className="border border-slate-900 bg-slate-950/40 p-4 rounded space-y-3">
                <div className="text-xs font-mono uppercase text-slate-400 border-b border-slate-900 pb-2 mb-2">Estimator Work Hours</div>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => (
                  <div key={day} className="flex items-center justify-between text-xs capitalize">
                    <span className="font-semibold text-slate-300 w-24">{day}</span>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={workHours[day]?.open || '08:00'}
                        onChange={(e) => handleHourChange(day, 'open', e.target.value)}
                        className="bg-slate-950 border border-slate-800 w-16 px-1.5 py-1 rounded text-center focus:border-orange-500"
                      />
                      <span className="text-slate-600 font-mono">-</span>
                      <input
                        type="text"
                        value={workHours[day]?.close || '17:00'}
                        onChange={(e) => handleHourChange(day, 'close', e.target.value)}
                        className="bg-slate-950 border border-slate-800 w-16 px-1.5 py-1 rounded text-center focus:border-orange-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Setup FAQs */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Configure AI Roofing Assistant Knowledge Base</h2>
              <p className="text-xs text-slate-500">Provide common questions and answers for qualifying leads.</p>
            </div>

            <div className="space-y-4">
              {/* Existing FAQs */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-slate-950 border border-slate-900 p-3 rounded text-xs space-y-1 relative group">
                    <button
                      onClick={() => removeFaq(i)}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-400 font-mono text-[10px]"
                    >
                      Delete
                    </button>
                    <div className="font-bold text-orange-500">Q: {faq.question}</div>
                    <div className="text-slate-400">A: {faq.answer}</div>
                  </div>
                ))}
              </div>

              {/* Add New FAQ Form */}
              <div className="border border-slate-900 p-4 rounded bg-slate-950/40 space-y-3">
                <div className="text-xs font-mono uppercase text-slate-400">Add Custom Question</div>
                <div>
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                    placeholder="e.g. Do you repair metal roofs?"
                  />
                </div>
                <div>
                  <textarea
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 h-16"
                    placeholder="e.g. Yes, we repair and replace standing seam and corrugated metal roofing."
                  />
                </div>
                <button
                  type="button"
                  onClick={addFaq}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-orange-500 text-xs px-3 py-1.5 rounded font-mono"
                >
                  ADD TO KNOWLEDGE BASE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Finish */}
        {step === 4 && (
          <div className="space-y-6 text-center py-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-orange-500 animate-bounce" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Onboarding Configuration Ready!</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Your AI SMS assistant is configured with your service hours and knowledge base details. Clicking finish will enable Live Lead Recovery.
              </p>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-900">
          <button
            type="button"
            disabled={step === 1 || loading}
            onClick={() => setStep(prev => prev - 1)}
            className="flex items-center gap-1.5 text-xs font-mono uppercase text-slate-400 hover:text-white disabled:opacity-30 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(prev => prev + 1)}
              className="bg-orange-500 text-slate-950 font-bold px-4 py-2 rounded text-xs hover:bg-orange-600 transition flex items-center gap-1.5"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleFinishOnboarding}
              className="bg-orange-500 text-slate-950 font-extrabold px-6 py-2.5 rounded text-xs hover:bg-orange-600 transition disabled:opacity-50"
            >
              {loading ? 'Finalizing Setup...' : 'Finish & Launch Mission Control'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
