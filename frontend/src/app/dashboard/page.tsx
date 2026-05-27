'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { apiClient } from '@/utils/apiClient'
import { AlertTriangle, PhoneCall, Calendar, MessageSquare, ArrowRight, ClipboardList, Wifi, WifiOff, RefreshCw, Volume2 } from 'lucide-react'
import LeadDetailDrawer from '@/components/LeadDetailDrawer'

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  urgency: string;
  status: string;
  priority_score: number;
  source: string;
  roof_issue: string;
  preferred_inspection_time: string;
  created_at: string;
}

interface Conversation {
  id: string;
  status: string;
  state: string;
  lead: string;
  last_ai_confidence: number;
  ai_summary: string;
}

export default function OverviewPage() {
  const accessToken = useStore((state) => state.accessToken)
  const addToast = useStore((state) => state.addToast)
  
  const [leads, setLeads] = useState<Lead[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'failed'>('connected')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Selected Lead for Detail Drawer
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  
  // Track emergency lead counts to trigger sound hook
  const prevEmergencyCountRef = useRef<number>(0)

  // Sound generator using Web Audio API
  const playEmergencySound = () => {
    if (typeof window === 'undefined') return
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.3)
    } catch (e) {
      console.warn('AudioContext blocked or unsupported:', e)
    }
  }

  const fetchData = async (isSilent = false) => {
    if (!accessToken) return
    if (!isSilent) setLoading(true)
    setConnectionStatus('reconnecting')

    try {
      // 1. Fetch active Leads
      const leadsData = await apiClient.get('/api/leads/')
      const fetchedLeads = leadsData.results || leadsData || []
      setLeads(fetchedLeads)

      // 2. Fetch Conversations
      const convsData = await apiClient.get('/api/conversations/')
      const fetchedConvs = convsData.results || convsData || []
      setConversations(fetchedConvs)

      // Sound alert check
      const currentEmergencyCount = fetchedLeads.filter((l: Lead) => 
        ['IMMEDIATE_LEAK', 'ACTIVE_DAMAGE'].includes(l.urgency) && l.status !== 'ARCHIVED'
      ).length
      
      if (isSilent && currentEmergencyCount > prevEmergencyCountRef.current) {
        playEmergencySound()
        addToast('NEW EMERGENCY LEAD INCOMING!', 'error')
      }
      
      prevEmergencyCountRef.current = currentEmergencyCount
      setConnectionStatus('connected')
      setError('')
      setLastUpdated(new Date())
    } catch (err: any) {
      setConnectionStatus('failed')
      setError(err.message || 'Gateway offline. Displaying stale data.')
    } finally {
      setLoading(false)
    }
  }

  // 1. Initial Load
  useEffect(() => {
    if (accessToken) {
      fetchData()
    }
  }, [accessToken])

  // 2. Polling Setup (every 10 seconds)
  useEffect(() => {
    if (!accessToken) return
    const interval = setInterval(() => {
      fetchData(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [accessToken])

  // Calculate stats based on fetched arrays
  const totalLeads = leads.length
  const emergencyLeadsList = leads.filter(l => ['IMMEDIATE_LEAK', 'ACTIVE_DAMAGE'].includes(l.urgency) && l.status !== 'ARCHIVED')
  const emergencyLeadsCount = emergencyLeadsList.length
  const bookedInspections = leads.filter(l => l.status === 'BOOKED').length
  const activeAI = conversations.filter(c => c.status === 'AI_ACTIVE').length
  const recoveredMissedCalls = leads.filter(l => l.source === 'MISSED_CALL').length
  const pendingFollowups = leads.filter(l => ['NEW', 'QUALIFYING'].includes(l.status)).length

  // Quick timing helper
  const getWaitingDuration = (isoString: string) => {
    try {
      const diffMs = new Date().getTime() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Waiting <1m'
      if (diffMins < 60) return `Waiting ${diffMins}m`
      const diffHours = Math.floor(diffMins / 60)
      return `Waiting ${diffHours}h`
    } catch (_) {
      return ''
    }
  }

  // Action handlers
  const handleArchiveLead = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await apiClient.patch(`/api/leads/${leadId}/`, { status: 'ARCHIVED' })
      addToast('Lead archived.', 'success')
      fetchData(true)
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    }
  }

  const handleTakeover = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await apiClient.post(`/api/conversations/${convId}/takeover/`)
      addToast('AI paused. Handed over to office.', 'success')
      fetchData(true)
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    }
  }

  if (loading && leads.length === 0) {
    return (
      <div className="flex flex-col gap-2 items-center justify-center min-h-[400px] text-xs font-mono text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
        <span>Syncing Mission Control metrics...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 relative">
      {/* Network Status / Connection lost banners */}
      {connectionStatus === 'failed' && (
        <div className="bg-red-500 text-slate-950 font-extrabold px-4 py-3 rounded flex items-center justify-between text-xs tracking-wider animate-pulse sticky top-0 z-40 shadow-lg">
          <span className="flex items-center gap-2">
            <WifiOff className="h-4.5 w-4.5 animate-bounce" /> CONNECTION LOST: DETECTING NETWORK FAILURES. RECONNECTING...
          </span>
          <button 
            onClick={() => fetchData()}
            className="bg-slate-950 text-white font-mono px-3 py-1 rounded hover:bg-slate-900 text-[10px] transition"
          >
            FORCE RE-SYNC
          </button>
        </div>
      )}

      {/* Sticky top mini-banner for Emergency alerts */}
      {emergencyLeadsCount > 0 && (
        <div className="bg-red-950/20 border border-red-500/30 p-3.5 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-xs font-bold text-red-400">
              CRITICAL STATE: {emergencyLeadsCount} active emergency inquiries need immediate response.
            </span>
          </div>
          <button 
            onClick={playEmergencySound}
            className="text-slate-400 hover:text-red-400 p-1 rounded"
            title="Test Alert Sound"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Roofing Lead Recovery Mission Control</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">Operational view for active roofing campaigns</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'reconnecting' ? 'bg-amber-500 animate-ping' : 'bg-red-500'
            }`}></span>
            <span className="capitalize">{connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'reconnecting' ? 'Syncing...' : 'Disconnected'}</span>
          </div>
          <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
          <button 
            onClick={() => fetchData()}
            className="bg-slate-900 border border-slate-800 p-2 rounded text-slate-300 hover:border-slate-700 hover:text-white transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Emergency Leads */}
        <div className={`p-5 rounded-lg border ${
          emergencyLeadsCount > 0 ? 'border-red-500/50 bg-red-950/10 shadow-[0_0_15px_rgba(239,68,68,0.05)]' : 'border-slate-900 bg-slate-900/20'
        }`}>
          <div className="flex items-center justify-between mb-3 text-red-500">
            <span className="text-[10px] font-mono uppercase tracking-wider">Emergency Leads</span>
            <AlertTriangle className={`h-5 w-5 ${emergencyLeadsCount > 0 ? 'animate-pulse text-red-500' : 'text-slate-500'}`} />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{emergencyLeadsCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Immediate storm & leaks</div>
        </div>

        {/* Missed Calls Recovered */}
        <div className="border border-slate-900 bg-slate-900/20 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-3 text-orange-500">
            <span className="text-[10px] font-mono uppercase tracking-wider">Missed Call Dispatches</span>
            <PhoneCall className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{recoveredMissedCalls}</div>
          <div className="text-[10px] text-slate-500 mt-1">Auto-SMS callback alerts</div>
        </div>

        {/* Active AI chats */}
        <div className="border border-slate-900 bg-slate-900/20 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Active AI Chats</span>
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{activeAI}</div>
          <div className="text-[10px] text-slate-500 mt-1">AI replying automatically</div>
        </div>

        {/* Inspections Booked */}
        <div className="border border-slate-900 bg-slate-900/20 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Inspections Scheduled</span>
            <Calendar className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{bookedInspections}</div>
          <div className="text-[10px] text-slate-500 mt-1">Assigned estimator slots</div>
        </div>

        {/* Pending Follow-ups */}
        <div className="border border-slate-900 bg-slate-900/20 p-5 rounded-lg col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Pending Follow-ups</span>
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{pendingFollowups}</div>
          <div className="text-[10px] text-slate-500 mt-1">New & qualifying pipeline</div>
        </div>
      </div>

      {/* Pinned Emergency Action Board - visual dominance */}
      <div className={`rounded-lg overflow-hidden border ${
        emergencyLeadsCount > 0 ? 'border-red-500/50 bg-slate-900/25 shadow-xl' : 'border-slate-900 bg-slate-900/10'
      }`}>
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          emergencyLeadsCount > 0 ? 'bg-red-950/20 border-red-500/30 text-red-400' : 'bg-slate-900 border-slate-900 text-slate-400'
        }`}>
          <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className={`h-4.5 w-4.5 ${emergencyLeadsCount > 0 ? 'animate-pulse' : ''}`} /> 
            Pinned Emergency Leads Queue
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded text-red-500 font-bold">
            {emergencyLeadsCount} Critical
          </span>
        </div>
        <div className="divide-y divide-slate-900">
          {emergencyLeadsList.length === 0 ? (
            <div className="p-10 text-center text-xs font-mono text-slate-500">
              No emergency leads in queue. All systems operating normally.
            </div>
          ) : (
            emergencyLeadsList.map(lead => {
              const conv = conversations.find(c => c.lead === lead.id)
              const isLowConfidence = conv ? conv.last_ai_confidence < 0.70 : false

              return (
                <div 
                  key={lead.id} 
                  onClick={() => setSelectedLead(lead)}
                  className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-900/30 transition cursor-pointer relative"
                >
                  {/* Left block info */}
                  <div className="space-y-2 max-w-3xl flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="bg-red-500 text-slate-950 font-extrabold text-[9px] px-2.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                        {lead.urgency.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-200 font-extrabold text-sm">{lead.name || lead.phone}</span>
                      <span className="text-xs font-mono text-slate-500">({lead.phone})</span>
                      <span className="text-xs font-mono text-orange-500 font-bold bg-orange-500/5 px-2 py-0.5 border border-orange-500/15 rounded">
                        {getWaitingDuration(lead.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-normal font-semibold">
                      <span className="text-slate-500">Issue:</span> {lead.roof_issue}
                    </p>
                    {lead.address && (
                      <p className="text-xs text-slate-400">
                        <span className="text-slate-500 font-mono">Address:</span> {lead.address}
                      </p>
                    )}
                    {conv?.ai_summary && (
                      <div className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded border border-slate-900 max-w-2xl leading-relaxed">
                        <span className="text-orange-500 font-bold">AI Status:</span> {conv.ai_summary}
                      </div>
                    )}
                  </div>

                  {/* Right block Actions & AI Confidence */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 shrink-0 mt-3 lg:mt-0">
                    {conv && (
                      <div className="space-y-1 w-full max-w-[200px] text-right">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase">
                          <span>AI Confidence</span>
                          <span className={isLowConfidence ? 'text-amber-500 font-bold' : 'text-slate-300'}>
                            {Math.round(conv.last_ai_confidence * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-slate-950 h-2 rounded overflow-hidden">
                            <div 
                              className={`h-full rounded ${isLowConfidence ? 'bg-amber-500' : 'bg-orange-500'}`}
                              style={{ width: `${conv.last_ai_confidence * 100}%` }}
                            ></div>
                          </div>
                          {isLowConfidence && (
                            <span className="bg-amber-500/10 text-amber-500 text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20 tracking-wider">
                              REVIEWS
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 w-full justify-end">
                      {conv?.status === 'AI_ACTIVE' && (
                        <button
                          onClick={(e) => handleTakeover(conv.id, e)}
                          className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded hover:bg-red-500/20 transition font-bold"
                        >
                          Pause AI
                        </button>
                      )}
                      <button
                        onClick={(e) => handleArchiveLead(lead.id, e)}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs px-3 py-2 rounded transition font-bold"
                      >
                        Archive
                      </button>
                      <a 
                        href={`/dashboard/conversations?lead=${lead.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-orange-500 text-slate-950 p-2 rounded hover:bg-orange-600 transition flex items-center justify-center"
                      >
                        <ArrowRight className="h-4.5 w-4.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Link shortcut to leads feed */}
      <div className="flex justify-end pt-4">
        <Link 
          href="/dashboard/leads"
          className="bg-orange-500 text-slate-950 hover:bg-orange-600 px-6 py-3.5 rounded font-extrabold text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.2)] transition"
        >
          View All Active Leads Feed <ArrowRight className="h-4.5 w-4.5" />
        </Link>
      </div>

      {/* Lead Detail Panel Overlay */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          conversation={conversations.find(c => c.lead === selectedLead.id) || null}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => fetchData(true)}
        />
      )}
    </div>
  )
}
