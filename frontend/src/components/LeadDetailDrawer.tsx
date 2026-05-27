'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/utils/apiClient'
import { useStore } from '@/store/useStore'
import { X, Phone, MessageSquare, AlertTriangle, ShieldCheck, Clock, Calendar, CheckSquare, RefreshCw } from 'lucide-react'

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  roof_issue: string;
  urgency: string;
  priority_score: number;
  source: string;
  status: string;
  preferred_inspection_time: string;
  created_at: string;
}

interface Conversation {
  id: string;
  status: string;
  state: string;
  last_ai_confidence: number;
  ai_summary: string;
}

interface LeadDetailDrawerProps {
  lead: Lead | null;
  conversation: Conversation | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function LeadDetailDrawer({ lead, conversation, onClose, onUpdate }: LeadDetailDrawerProps) {
  const addToast = useStore((state) => state.addToast)

  const [activeTab, setActiveTab] = useState<'timeline' | 'chat' | 'scheduling'>('timeline')
  const [timeline, setTimeline] = useState<any[]>([])
  const [transcript, setTranscript] = useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch timeline and transcript when lead changes
  useEffect(() => {
    if (!lead) return

    setTimeline([])
    setTranscript([])
    
    // Fetch timeline
    setLoadingTimeline(true)
    apiClient.get(`/api/leads/${lead.id}/timeline/`)
      .then((data) => {
        setTimeline(data || [])
      })
      .catch((err) => console.error("Error loading lead timeline:", err))
      .finally(() => setLoadingTimeline(false))

    // Fetch conversation replay
    if (conversation) {
      setLoadingTranscript(true)
      apiClient.get(`/api/conversations/${conversation.id}/replay/`)
        .then((data) => {
          setTranscript(data.transcript || [])
        })
        .catch((err) => console.error("Error loading chat transcript:", err))
        .finally(() => setLoadingTranscript(false))
    }
  }, [lead, conversation])

  if (!lead) return null

  // Helpers for relative time
  const getRelativeTime = (isoString: string) => {
    try {
      const now = new Date()
      const diffMs = now.getTime() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      return new Date(isoString).toLocaleDateString()
    } catch (_) {
      return ''
    }
  }

  // Quick Action handlers
  const handleToggleTakeover = async () => {
    if (!conversation) return
    setActionLoading(true)
    const isPaused = conversation.status === 'HUMAN_HANDOFF'
    const endpoint = isPaused ? `/api/conversations/${conversation.id}/resume_ai/` : `/api/conversations/${conversation.id}/takeover/`
    
    try {
      await apiClient.post(endpoint)
      addToast(isPaused ? 'AI Assistant resumed.' : 'AI paused. Takeover mode enabled.', 'success')
      onUpdate()
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkEmergency = async () => {
    setActionLoading(true)
    try {
      await apiClient.patch(`/api/leads/${lead.id}/`, { urgency: 'IMMEDIATE_LEAK' })
      addToast('Lead flagged as IMMEDIATE EMERGENCY.', 'success')
      onUpdate()
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleArchive = async () => {
    setActionLoading(true)
    try {
      await apiClient.patch(`/api/leads/${lead.id}/`, { status: 'ARCHIVED' })
      addToast('Lead archived.', 'success')
      onClose()
      onUpdate()
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const isEmergency = ['IMMEDIATE_LEAK', 'ACTIVE_DAMAGE'].includes(lead.urgency)
  const isLowConfidence = conversation ? conversation.last_ai_confidence < 0.70 : false

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
      {/* Drawer Body - Fullscreen on mobile, half on desktop */}
      <div className="w-full md:w-[600px] bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl relative">
        
        {/* Header */}
        <div className={`p-6 border-b border-slate-800 flex items-center justify-between ${isEmergency ? 'bg-red-950/20 border-red-500/10' : ''}`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded ${
                isEmergency ? 'bg-red-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-300'
              }`}>
                {lead.urgency.replace(/_/g, ' ')}
              </span>
              <span className="bg-slate-800 text-slate-400 font-mono text-[9px] px-2 py-0.5 rounded uppercase">
                {lead.source.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">{lead.name || lead.phone}</h2>
            <p className="text-xs font-mono text-slate-500">{lead.phone}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 border border-slate-800 rounded bg-slate-950"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded border border-slate-800/60">
              <div className="text-[10px] font-mono text-slate-500 uppercase">AI Status</div>
              <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                {conversation?.status === 'AI_ACTIVE' ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping"></span>
                    <span>AI Active</span>
                  </>
                ) : conversation?.status === 'HUMAN_HANDOFF' ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    <span className="text-red-400">Needs Review</span>
                  </>
                ) : (
                  <span>Finished</span>
                )}
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded border border-slate-800/60">
              <div className="text-[10px] font-mono text-slate-500 uppercase">AI Confidence</div>
              <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-2">
                {conversation ? (
                  <>
                    <div className="flex-1 bg-slate-900 h-2 rounded overflow-hidden">
                      <div 
                        className={`h-full rounded ${isLowConfidence ? 'bg-amber-500' : 'bg-orange-500'}`}
                        style={{ width: `${conversation.last_ai_confidence * 100}%` }}
                      ></div>
                    </div>
                    <span className={isLowConfidence ? 'text-amber-500' : 'text-slate-300'}>
                      {Math.round(conversation.last_ai_confidence * 100)}%
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500 font-mono">N/A</span>
                )}
              </div>
            </div>
          </div>

          {/* Warning banner for low confidence */}
          {isLowConfidence && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded text-xs flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
              <span>AI confidence score is low. Human takeover recommended.</span>
            </div>
          )}

          {/* Roof Issue & Address */}
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase">Roof Issue Details</div>
              <p className="text-sm text-slate-300 bg-slate-950/40 border border-slate-900 p-3 rounded mt-1 font-semibold leading-relaxed">
                {lead.roof_issue || 'No roof issue recorded.'}
              </p>
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase">Customer Address</div>
              <p className="text-sm text-slate-300 bg-slate-950/40 border border-slate-900 p-3 rounded mt-1">
                {lead.address || 'Address pending qualification.'}
              </p>
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase">Preferred Inspection Schedule</div>
              <p className="text-sm text-orange-500 bg-slate-950/40 border border-slate-900 p-3 rounded mt-1 font-bold">
                {lead.preferred_inspection_time || 'Schedule slot pending.'}
              </p>
            </div>
          </div>

          {/* Interactive tabs */}
          <div className="space-y-4">
            <div className="border-b border-slate-800 flex gap-4 text-xs font-mono">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`pb-2 ${activeTab === 'timeline' ? 'border-b-2 border-orange-500 text-white font-bold' : 'text-slate-500'}`}
              >
                Timeline
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`pb-2 ${activeTab === 'chat' ? 'border-b-2 border-orange-500 text-white font-bold' : 'text-slate-500'}`}
              >
                SMS Logs
              </button>
            </div>

            {/* TAB: Timeline */}
            {activeTab === 'timeline' && (
              <div className="space-y-3">
                {loadingTimeline ? (
                  <div className="text-center font-mono text-xs text-slate-600 py-4 flex items-center justify-center gap-1.5">
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" /> Loading timeline...
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="text-center text-xs font-mono text-slate-600 py-4">No events logged yet.</div>
                ) : (
                  <div className="relative border-l border-slate-800 pl-4 space-y-4 ml-2">
                    {timeline.map((act) => (
                      <div key={act.id} className="relative">
                        <span className="absolute -left-[21px] top-1 bg-slate-900 border border-slate-800 text-[10px] p-0.5 rounded-full">
                          {act.activity_type.includes('call') ? <Phone className="h-3 w-3 text-red-400" /> : <MessageSquare className="h-3 w-3 text-orange-500" />}
                        </span>
                        <div className="text-xs">
                          <span className="font-bold text-slate-200 capitalize">
                            {act.activity_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 ml-2">
                            {getRelativeTime(act.created_at)}
                          </span>
                        </div>
                        {act.metadata && Object.keys(act.metadata).length > 0 && (
                          <div className="bg-slate-950 p-2 rounded text-[11px] text-slate-400 mt-1 font-mono max-w-md">
                            {JSON.stringify(act.metadata)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Chat logs */}
            {activeTab === 'chat' && (
              <div className="space-y-3">
                {loadingTranscript ? (
                  <div className="text-center font-mono text-xs text-slate-600 py-4 flex items-center justify-center gap-1.5">
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" /> Loading transcript...
                  </div>
                ) : transcript.length === 0 ? (
                  <div className="text-center text-xs font-mono text-slate-600 py-4">No text history.</div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {transcript.map((msg, index) => {
                      const isAI = msg.sender === 'AI'
                      const isHuman = msg.sender === 'HUMAN'
                      return (
                        <div key={index} className={`flex flex-col ${isAI || isHuman ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded text-xs max-w-[85%] ${
                            isAI 
                              ? 'bg-slate-950 border border-slate-900 text-slate-200' 
                              : isHuman 
                                ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
                                : 'bg-slate-800 text-white'
                          }`}>
                            <div className="font-mono text-[9px] text-slate-500 mb-1">
                              {isAI ? 'AI Assistant' : isHuman ? 'Office Takeover' : 'Homeowner'}
                            </div>
                            <p className="leading-normal font-medium">{msg.text}</p>
                          </div>
                          <span className="text-[9px] font-mono text-slate-600 mt-1">{getRelativeTime(msg.timestamp)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer sticky actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-2 flex-wrap items-center justify-between">
          <a
            href={`tel:${lead.phone}`}
            className="flex-1 min-w-[120px] bg-slate-900 border border-slate-800 text-slate-200 p-3 rounded font-bold text-center text-xs hover:border-slate-700 hover:text-white transition flex items-center justify-center gap-1.5"
          >
            <Phone className="h-4 w-4" /> Call Lead
          </a>
          
          <Link
            href={`/dashboard/conversations?lead=${lead.id}`}
            className="flex-1 min-w-[120px] bg-orange-500 text-slate-950 p-3 rounded font-extrabold text-center text-xs hover:bg-orange-600 transition flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="h-4 w-4" /> SMS Chat
          </Link>

          <button
            onClick={handleToggleTakeover}
            disabled={actionLoading || !conversation}
            className={`flex-1 min-w-[120px] p-3 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              conversation?.status === 'HUMAN_HANDOFF'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
            }`}
          >
            {conversation?.status === 'HUMAN_HANDOFF' ? 'Resume AI' : 'Pause AI'}
          </button>

          <div className="w-full flex gap-2 mt-2">
            <button
              onClick={handleMarkEmergency}
              disabled={actionLoading || isEmergency}
              className="flex-1 bg-red-950/20 border border-red-500/30 text-red-400 p-2.5 rounded font-bold text-xs hover:bg-red-900/10 transition"
            >
              Flag Emergency
            </button>
            <button
              onClick={handleArchive}
              disabled={actionLoading || lead.status === 'ARCHIVED'}
              className="flex-1 bg-slate-900 border border-slate-800 text-slate-500 p-2.5 rounded font-bold text-xs hover:text-slate-300 hover:border-slate-700 transition"
            >
              Archive Lead
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
