'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { apiClient } from '@/utils/apiClient'
import { AlertTriangle, Search, Filter, Download, Phone, MessageSquare, Trash2, CheckCircle2, MoreHorizontal, WifiOff, RefreshCw, Calendar } from 'lucide-react'
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

export default function LeadsPage() {
  const accessToken = useStore((state) => state.accessToken)
  const addToast = useStore((state) => state.addToast)

  const [leads, setLeads] = useState<Lead[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'failed'>('connected')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [urgencyFilter, setUrgencyFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')

  // Selected Lead for Detail Drawer
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Bulk operation tracking
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  const fetchData = async (isSilent = false) => {
    if (!accessToken) return
    if (!isSilent) setLoading(true)
    setConnectionStatus('reconnecting')

    try {
      const leadsData = await apiClient.get('/api/leads/')
      const fetchedLeads = leadsData.results || leadsData || []
      // Filter out archived unless filter is set to ARCHIVED
      setLeads(fetchedLeads)

      const convsData = await apiClient.get('/api/conversations/')
      setConversations(convsData.results || convsData || [])

      setConnectionStatus('connected')
      setError('')
      setLastUpdated(new Date())
    } catch (err: any) {
      setConnectionStatus('failed')
      setError(err.message || 'API connection failed.')
    } finally {
      setLoading(false)
    }
  }

  // 1. Initial load
  useEffect(() => {
    if (accessToken) {
      fetchData()
    }
  }, [accessToken])

  // 2. Polling every 10 seconds
  useEffect(() => {
    if (!accessToken) return
    const interval = setInterval(() => {
      fetchData(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [accessToken])

  // Relative timing calculator
  const getRelativeTime = (isoString: string) => {
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

  // CSV Blob Exporter with Auth Headers
  const handleExportCSV = async () => {
    try {
      addToast('Generating leads export document...', 'info')
      const blob = await apiClient.get('/api/leads/export-csv/', { responseType: 'blob' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `roofreply_leads_${new Date().toISOString().slice(0,10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      addToast('CSV export downloaded successfully.', 'success')
    } catch (err: any) {
      addToast(err.message || 'CSV export failed.', 'error')
    }
  }

  // Quick Action handlers
  const handleToggleTakeover = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const conv = conversations.find(c => c.lead === leadId)
    if (!conv) {
      addToast('No conversation thread established yet.', 'warning')
      return
    }
    const isPaused = conv.status === 'HUMAN_HANDOFF'
    const endpoint = isPaused ? `/api/conversations/${conv.id}/resume_ai/` : `/api/conversations/${conv.id}/takeover/`

    try {
      await apiClient.post(endpoint)
      addToast(isPaused ? 'AI replies active.' : 'AI paused. Takeover active.', 'success')
      fetchData(true)
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    }
  }

  const handleMarkEmergency = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await apiClient.patch(`/api/leads/${leadId}/`, { urgency: 'IMMEDIATE_LEAK' })
      addToast('Flagged lead as Immediate Leak.', 'success')
      fetchData(true)
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    }
  }

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

  // Bulk Actions
  const handleBulkSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeadIds(activeFilteredLeads.map(l => l.id))
    } else {
      setSelectedLeadIds([])
    }
  }

  const handleBulkCheckboxChange = (leadId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.target.checked) {
      setSelectedLeadIds(prev => [...prev, leadId])
    } else {
      setSelectedLeadIds(prev => prev.filter(id => id !== leadId))
    }
  }

  const handleBulkAction = async (actionType: 'archive' | 'emergency') => {
    if (selectedLeadIds.length === 0) return
    addToast(`Running bulk update for ${selectedLeadIds.length} leads...`, 'info')
    
    try {
      for (const id of selectedLeadIds) {
        if (actionType === 'archive') {
          await apiClient.patch(`/api/leads/${id}/`, { status: 'ARCHIVED' })
        } else if (actionType === 'emergency') {
          await apiClient.patch(`/api/leads/${id}/`, { urgency: 'IMMEDIATE_LEAK' })
        }
      }
      addToast(`Bulk operations completed successfully.`, 'success')
      setSelectedLeadIds([])
      fetchData(true)
    } catch (err: any) {
      addToast(err.message || 'Bulk operation failed.', 'error')
    }
  }

  // Filtering Logic
  // Pinned Emergency Leads (always visible and sorted highest, not hidden by active filter parameters except search query)
  const emergencyLeads = leads.filter(l => 
    ['IMMEDIATE_LEAK', 'ACTIVE_DAMAGE'].includes(l.urgency) && 
    l.status !== 'ARCHIVED' &&
    (searchQuery === '' || 
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.phone.includes(searchQuery) ||
      l.roof_issue.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const activeFilteredLeads = leads.filter(lead => {
    // Exclude Pinned Emergency Leads from general list to prevent duplication
    const isEmergency = ['IMMEDIATE_LEAK', 'ACTIVE_DAMAGE'].includes(lead.urgency)
    if (isEmergency && lead.status !== 'ARCHIVED') return false

    // Status filter
    if (statusFilter !== 'ALL' && lead.status !== statusFilter) return false
    if (statusFilter === 'ALL' && lead.status === 'ARCHIVED') return false // Default hide archived

    // Urgency filter
    if (urgencyFilter !== 'ALL' && lead.urgency !== urgencyFilter) return false

    // Source filter
    if (sourceFilter !== 'ALL' && lead.source !== sourceFilter) return false

    // Search query matches
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesName = lead.name.toLowerCase().includes(q)
      const matchesPhone = lead.phone.includes(q)
      const matchesIssue = lead.roof_issue.toLowerCase().includes(q)
      const matchesAddress = lead.address.toLowerCase().includes(q)
      
      return matchesName || matchesPhone || matchesIssue || matchesAddress
    }

    return true
  })

  // Sorting
  const sortedLeads = [...activeFilteredLeads].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    if (sortBy === 'priority') {
      return b.priority_score - a.priority_score
    }
    return 0
  })

  return (
    <div className="space-y-6 relative">
      {/* Network Failure Alert */}
      {connectionStatus === 'failed' && (
        <div className="bg-red-500 text-slate-950 font-extrabold px-4 py-3 rounded flex items-center justify-between text-xs tracking-wider animate-pulse sticky top-0 z-40 shadow-lg">
          <span className="flex items-center gap-2">
            <WifiOff className="h-4.5 w-4.5" /> GATEWAY OFFLINE: POLLED RETRIES PENDING. DISPLAYING STALE DATA.
          </span>
          <button 
            onClick={() => fetchData()}
            className="bg-slate-950 text-white font-mono px-3 py-1 rounded hover:bg-slate-900 text-[10px]"
          >
            FORCE SYNC
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Leads Workboard</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">Manage active roofing leads and inspect AI qualifiers</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 font-bold text-xs px-4 py-2.5 rounded flex items-center gap-2 transition"
          >
            <Download className="h-4 w-4 text-orange-500" /> Export CSV
          </button>
          
          <button
            onClick={() => fetchData()}
            className="bg-slate-900 border border-slate-800 p-2.5 rounded text-slate-400 hover:text-white hover:border-slate-700 transition"
            title="Refresh list"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-slate-900/35 border border-slate-900 p-4 rounded-lg flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800/80 rounded pl-9 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 placeholder:text-slate-600"
            placeholder="Search leads by name, phone, address, or issue..."
          />
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          {/* Status */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 px-2 py-1.5 rounded">
            <span className="text-[10px] text-slate-500 uppercase font-mono hidden sm:inline">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none w-full"
            >
              <option value="ALL">All States</option>
              <option value="NEW">New</option>
              <option value="QUALIFYING">Qualifying</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="BOOKED">Booked</option>
              <option value="UNQUALIFIED">Unqualified</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Urgency */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 px-2 py-1.5 rounded">
            <span className="text-[10px] text-slate-500 uppercase font-mono hidden sm:inline">Urgency</span>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none w-full"
            >
              <option value="ALL">All Urgencies</option>
              <option value="IMMEDIATE_LEAK">Emergency Leak</option>
              <option value="ACTIVE_DAMAGE">Storm Damage</option>
              <option value="STANDARD_ESTIMATE">Standard</option>
              <option value="PLANNING">Planning</option>
            </select>
          </div>

          {/* Source */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 px-2 py-1.5 rounded">
            <span className="text-[10px] text-slate-500 uppercase font-mono hidden sm:inline">Source</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none w-full"
            >
              <option value="ALL">All Sources</option>
              <option value="MISSED_CALL">Missed Call</option>
              <option value="WEBSITE">Website Chat</option>
              <option value="GOOGLE_ADS">Google Ads</option>
              <option value="FACEBOOK">Facebook</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 px-2 py-1.5 rounded">
            <span className="text-[10px] text-slate-500 uppercase font-mono hidden sm:inline">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none w-full"
            >
              <option value="newest">Newest</option>
              <option value="priority">Priority Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Bulk Actions Panel (if selection exists) */}
      {selectedLeadIds.length > 0 && (
        <div className="bg-orange-500 text-slate-950 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 font-bold text-xs shadow-2xl tracking-wide">
          <span>{selectedLeadIds.length} leads selected for bulk modifications.</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleBulkAction('emergency')}
              className="flex-1 bg-slate-950 text-red-500 border border-red-500/20 px-3 py-2 rounded text-[10px] uppercase font-bold hover:bg-slate-900 transition"
            >
              Flag Emergency
            </button>
            <button
              onClick={() => handleBulkAction('archive')}
              className="flex-1 bg-slate-950 text-slate-300 border border-slate-800 px-3 py-2 rounded text-[10px] uppercase font-bold hover:bg-slate-900 transition"
            >
              Archive Selected
            </button>
            <button
              onClick={() => setSelectedLeadIds([])}
              className="bg-transparent text-slate-900 underline px-2 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main List Layout */}
      <div className="space-y-4">
        {/* Pinned Emergency Leads Section (Always sorting highest, remains visible during filters) */}
        {emergencyLeads.length > 0 && (
          <div className="border border-red-500/40 bg-red-950/5 rounded-lg p-4 space-y-3">
            <div className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></span>
              Pinned Critical Emergencies ({emergencyLeads.length})
            </div>
            
            <div className="grid gap-3">
              {emergencyLeads.map(lead => {
                const conv = conversations.find(c => c.lead === lead.id)
                const isLowConfidence = conv ? conv.last_ai_confidence < 0.70 : false

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="bg-slate-950 border border-red-500/20 hover:border-red-500/40 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-950/60 transition"
                  >
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleBulkCheckboxChange(lead.id, e)}
                          className="mr-2 accent-orange-500"
                        />
                        <span className="bg-red-500 text-slate-950 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase">
                          EMERGENCY LEAK
                        </span>
                        <span className="text-slate-200 font-extrabold text-sm">{lead.name || lead.phone}</span>
                        <span className="text-xs font-mono text-slate-500">({lead.phone})</span>
                        <span className="text-[10px] font-mono text-orange-500 font-bold">
                          {getRelativeTime(lead.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                        <span className="text-slate-500">Issue:</span> {lead.roof_issue}
                      </p>
                      {lead.address && (
                        <p className="text-[11px] text-slate-400">
                          <span className="text-slate-500 font-mono">Address:</span> {lead.address}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t border-slate-900 pt-3 md:border-t-0 md:pt-0">
                      {conv && (
                        <div className="text-right text-[10px] font-mono text-slate-500 uppercase">
                          <div>AI Confidence</div>
                          <div className={isLowConfidence ? 'text-amber-500 font-bold' : 'text-slate-300'}>
                            {Math.round(conv.last_ai_confidence * 100)}%
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <button
                          onClick={(e) => handleToggleTakeover(lead.id, e)}
                          className="text-[10px] font-mono font-bold bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1.5 rounded hover:bg-red-500/20"
                        >
                          Pause AI
                        </button>
                        <button
                          onClick={(e) => handleArchiveLead(lead.id, e)}
                          className="p-2 rounded bg-slate-900 border border-slate-800 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* General Leads List */}
        <div className="border border-slate-900 bg-slate-900/10 rounded-lg overflow-hidden">
          <div className="bg-slate-900/60 px-6 py-3 border-b border-slate-900 flex items-center justify-between text-xs font-mono text-slate-500 uppercase">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                onChange={handleBulkSelectAll}
                checked={selectedLeadIds.length === activeFilteredLeads.length && activeFilteredLeads.length > 0}
                className="accent-orange-500"
              />
              <span>General Leads Feed ({sortedLeads.length})</span>
            </div>
            <span>Status</span>
          </div>

          <div className="divide-y divide-slate-900">
            {sortedLeads.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono text-slate-500">
                No active leads matching current filters.
              </div>
            ) : (
              sortedLeads.map(lead => {
                const conv = conversations.find(c => c.lead === lead.id)
                const isLowConfidence = conv ? conv.last_ai_confidence < 0.70 : false
                const isUrgent = ['IMMEDIATE_LEAK', 'ACTIVE_DAMAGE'].includes(lead.urgency)

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-900/20 transition cursor-pointer"
                  >
                    {/* Left Block info */}
                    <div className="space-y-1.5 max-w-3xl flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleBulkCheckboxChange(lead.id, e)}
                          className="accent-orange-500"
                        />
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          isUrgent 
                            ? 'bg-red-500 text-slate-950 animate-pulse'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {lead.urgency.replace(/_/g, ' ')}
                        </span>
                        
                        <span className="bg-slate-950 border border-slate-900 text-[9px] font-mono text-slate-400 px-2 py-0.5 rounded">
                          {lead.source.replace(/_/g, ' ')}
                        </span>

                        <span className="text-slate-200 font-bold text-sm">{lead.name || lead.phone}</span>
                        <span className="text-xs font-mono text-slate-500">({lead.phone})</span>
                        
                        <span className="text-[10px] font-mono text-slate-500">
                          {getRelativeTime(lead.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                        <span className="text-slate-500">Roof Issue:</span> {lead.roof_issue || 'No details provided.'}
                      </p>
                      
                      {lead.address && (
                        <p className="text-[11px] text-slate-500">
                          <span className="text-slate-500 font-mono">Address:</span> {lead.address}
                        </p>
                      )}
                    </div>

                    {/* Right Block actions */}
                    <div className="flex items-center justify-between lg:justify-end gap-6 shrink-0 border-t border-slate-900 pt-3 lg:border-t-0 lg:pt-0">
                      {/* Estimator & Appt info */}
                      <div className="text-left lg:text-right text-[10px] font-mono text-slate-500 uppercase space-y-1">
                        <div>Pipeline: <span className="text-orange-500 font-bold">{lead.status}</span></div>
                        {lead.preferred_inspection_time && (
                          <div className="text-[9px] text-orange-400 font-semibold flex items-center gap-1 justify-end">
                            <Calendar className="h-3 w-3" /> {lead.preferred_inspection_time}
                          </div>
                        )}
                      </div>

                      {/* AI Confidence */}
                      {conv && (
                        <div className="text-right text-[10px] font-mono text-slate-500 uppercase space-y-1">
                          <div>AI Confidence</div>
                          <div className={isLowConfidence ? 'text-amber-500 font-bold' : 'text-slate-300'}>
                            {Math.round(conv.last_ai_confidence * 100)}%
                          </div>
                          {isLowConfidence && (
                            <span className="bg-amber-500/10 text-amber-500 text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20">
                              REVIEWS
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        
                        <button
                          onClick={(e) => handleToggleTakeover(lead.id, e)}
                          className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded transition ${
                            conv?.status === 'HUMAN_HANDOFF'
                              ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                              : 'bg-red-500/10 border border-red-500/25 text-red-400'
                          }`}
                        >
                          {conv?.status === 'HUMAN_HANDOFF' ? 'Resume AI' : 'Pause AI'}
                        </button>

                        <button
                          onClick={(e) => handleArchiveLead(lead.id, e)}
                          className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <a
                          href={`/dashboard/conversations?lead=${lead.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded bg-orange-500 text-slate-950 hover:bg-orange-600"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar for mobile layout */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-slate-950/90 backdrop-blur border border-slate-900 p-3 rounded-lg flex items-center justify-around shadow-2xl">
        <button 
          onClick={handleExportCSV}
          className="flex flex-col items-center gap-1 text-[10px] font-mono text-slate-400 font-bold"
        >
          <Download className="h-4.5 w-4.5 text-orange-500" /> Export
        </button>
        <button 
          onClick={() => {
            if (leads.length > 0) {
              const emergencies = leads.filter(l => ['IMMEDIATE_LEAK', 'ACTIVE_DAMAGE'].includes(l.urgency))
              if (emergencies.length > 0) setSelectedLead(emergencies[0])
            }
          }}
          className="flex flex-col items-center gap-1 text-[10px] font-mono text-slate-400 font-bold"
        >
          <AlertTriangle className="h-4.5 w-4.5 text-red-500" /> Next Alarm
        </button>
        <button 
          onClick={() => {
            setSearchQuery('')
            setStatusFilter('ALL')
            setUrgencyFilter('ALL')
            setSourceFilter('ALL')
            addToast('Filters reset.', 'info')
          }}
          className="flex flex-col items-center gap-1 text-[10px] font-mono text-slate-400 font-bold"
        >
          <Filter className="h-4.5 w-4.5 text-slate-400" /> Reset Filters
        </button>
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
