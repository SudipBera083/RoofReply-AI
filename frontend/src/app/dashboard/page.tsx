'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { AlertTriangle, PhoneCall, Calendar, MessageSquare, ArrowRight, ClipboardList } from 'lucide-react'

interface Lead {
  id: string;
  name: string;
  phone: string;
  urgency: string;
  status: string;
  priority_score: number;
  source: string;
  roof_issue: string;
  address?: string;
}

interface Conversation {
  id: string;
  status: string;
  state: string;
  lead_name: string;
  lead_phone: string;
}

export default function OverviewPage() {
  const accessToken = useStore((state) => state.accessToken)
  
  const [leads, setLeads] = useState<Lead[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        
        // 1. Fetch Leads
        const leadsRes = await fetch(`${API_URL}/api/leads/`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (!leadsRes.ok) throw new Error("Failed to load leads.")
        const leadsData = await leadsRes.json()
        setLeads(leadsData.results || [])

        // 2. Fetch Conversations
        const convsRes = await fetch(`${API_URL}/api/conversations/`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (!convsRes.ok) throw new Error("Failed to load conversations.")
        const convsData = await convsRes.json()
        setConversations(convsData.results || [])

      } catch (err: any) {
        setError(err.message || 'Failed to fetch backend data.')
      } finally {
        setLoading(false)
      }
    }

    if (accessToken) {
      fetchData()
    }
  }, [accessToken])

  if (loading) {
    return (
      <div className="flex flex-col gap-2 items-center justify-center min-h-[300px] text-xs font-mono text-slate-500">
        Loading operational board...
      </div>
    )
  }

  // Calculate stats based on fetched arrays
  const totalLeads = leads.length
  const emergencyLeads = leads.filter(l => ['IMMEDIATE_LEAK', 'ACTIVE_STORM_DAMAGE', 'EMERGENCY_TARP_REQUIRED'].includes(l.urgency)).length
  const bookedInspections = leads.filter(l => l.status === 'BOOKED').length
  const activeAI = conversations.filter(c => c.status === 'AI_ACTIVE').length
  const recoveredMissedCalls = leads.filter(l => l.source === 'MISSED_CALL').length

  const conversionRate = totalLeads > 0 ? Math.round((bookedInspections / totalLeads) * 100) : 0

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Missed-Call Mission Control</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">Operational view for active roofing campaigns</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-slate-900 border border-slate-800 text-xs font-mono px-3 py-1.5 rounded text-slate-300 hover:border-slate-700 hover:text-white transition"
        >
          REFRESH BOARD
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded text-sm">
          Warning: Could not sync with API gateway. Displaying offline states. Reason: {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Emergency Leads */}
        <div className="border border-red-500/30 bg-red-950/10 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-3 text-red-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Emergency Leads</span>
            <AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{emergencyLeads}</div>
          <div className="text-[10px] text-red-400/80 mt-1">Leaks & storm damage</div>
        </div>

        {/* Missed Calls Recovered */}
        <div className="border border-slate-900 bg-slate-900/20 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-3 text-orange-500">
            <span className="text-[10px] font-mono uppercase tracking-wider">Missed Calls Recovered</span>
            <PhoneCall className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{recoveredMissedCalls}</div>
          <div className="text-[10px] text-slate-500 mt-1">Auto-SMS dispatched</div>
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
            <span className="text-[10px] font-mono uppercase tracking-wider">Booked Estimates</span>
            <Calendar className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{bookedInspections}</div>
          <div className="text-[10px] text-slate-500 mt-1">Inspections scheduled</div>
        </div>

        {/* Conversion Rate */}
        <div className="border border-slate-900 bg-slate-900/20 p-5 rounded-lg col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3 text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Conversion Rate</span>
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{conversionRate}%</div>
          <div className="text-[10px] text-slate-500 mt-1">Estimates booked / leads</div>
        </div>
      </div>

      {/* Emergency Leads Queue (Prioritized Board) */}
      <div className="border border-slate-900 bg-slate-900/10 rounded-lg overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-900 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-red-500 animate-pulse" /> Emergency & High Priority Action Board
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Requires Attention</span>
        </div>
        <div className="divide-y divide-slate-900">
          {leads.filter(l => ['IMMEDIATE_LEAK', 'ACTIVE_STORM_DAMAGE', 'EMERGENCY_TARP_REQUIRED'].includes(l.urgency)).length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-500">
              No emergency leads in queue.
            </div>
          ) : (
            leads
              .filter(l => ['IMMEDIATE_LEAK', 'ACTIVE_STORM_DAMAGE', 'EMERGENCY_TARP_REQUIRED'].includes(l.urgency))
              .slice(0, 3)
              .map(lead => (
                <div key={lead.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/20 transition">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-red-500 text-slate-950 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase">
                        {lead.urgency.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-200 font-bold text-sm">{lead.name || lead.phone}</span>
                      <span className="text-xs font-mono text-slate-500">({lead.phone})</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed font-semibold">{lead.roof_issue}</p>
                    <div className="text-xs text-slate-500">{lead.address || 'Address not provided yet'}</div>
                  </div>
                  <div className="flex items-center gap-3 self-start md:self-center">
                    <span className="bg-slate-950 border border-slate-800 text-xs px-3 py-1.5 rounded font-mono text-orange-500">
                      Priority Score: {lead.priority_score}
                    </span>
                    <a 
                      href={`/dashboard/conversations?lead=${lead.id}`}
                      className="bg-orange-500 text-slate-950 p-2 rounded hover:bg-orange-600 transition"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
}
