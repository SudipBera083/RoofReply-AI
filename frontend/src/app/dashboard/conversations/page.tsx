'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useStore } from '@/store/useStore'
import { apiClient } from '@/utils/apiClient'
import { 
  AlertTriangle, Phone, ShieldAlert, MessageSquare, Send, ArrowLeft, 
  User, Sparkles, RefreshCw, CheckCircle, Clock, WifiOff, Volume2 
} from 'lucide-react'

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
  channel: string;
  status: string; // AI_ACTIVE, HUMAN_HANDOFF, COMPLETED
  state: string; // NEW, QUALIFYING, etc.
  lead: string; // Lead UUID
  last_ai_confidence: number;
  ai_summary: string;
  created_at: string;
  updated_at: string;
  
  // Serializer injected fields
  lead_name?: string;
  lead_phone?: string;
  lead_urgency?: string;
  lead_priority_score?: number;
  lead_address?: string;
  lead_roof_issue?: string;
  lead_preferred_inspection_time?: string;
}

interface Message {
  id: string;
  conversation: string;
  sender_type: 'LEAD' | 'AI' | 'HUMAN';
  content: string;
  delivery_status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  error_message?: string;
  created_at: string;
}

// ----------------------------------------------------
// Isolated Internal Notes Manager Layer
// ----------------------------------------------------
const NotesManager = {
  getNotes: (leadId: string): string[] => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(`roofreply_notes_${leadId}`)
      return raw ? JSON.parse(raw) : []
    } catch (_) {
      return []
    }
  },
  addNote: (leadId: string, text: string): string[] => {
    if (typeof window === 'undefined') return []
    try {
      const notes = NotesManager.getNotes(leadId)
      notes.push(text)
      localStorage.setItem(`roofreply_notes_${leadId}`, JSON.stringify(notes))
      return notes
    } catch (_) {
      return []
    }
  }
}

// ----------------------------------------------------
// Messages Reconciliation Helper
// ----------------------------------------------------
const mergeMessages = (prev: Message[], next: Message[]) => {
  if (prev.length === next.length) {
    const isIdentical = prev.every((msg, idx) => 
      msg.id === next[idx].id && 
      msg.delivery_status === next[idx].delivery_status &&
      msg.content === next[idx].content
    )
    if (isIdentical) return prev
  }
  return next
}

function ConversationsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const accessToken = useStore((state) => state.accessToken)
  const addToast = useStore((state) => state.addToast)

  // Core collections
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  
  // Selected state
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [notes, setNotes] = useState<string[]>([])
  
  // Interface states
  const [noteInput, setNoteInput] = useState('')
  const [composerInput, setComposerInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'failed'>('connected')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Mobile layout state: controls if mobile view displays Queue list or Active Thread view
  const [mobileShowThread, setMobileShowThread] = useState(false)

  // References for scrolling & focus
  const chatScrollContainerRef = useRef<HTMLDivElement>(null)
  const isTabVisible = useRef(true)
  const pollingActiveRef = useRef<boolean>(true)

  // 1. Visbility-aware polling setup
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisible.current = document.visibilityState === 'visible'
      if (isTabVisible.current) {
        // Force refresh on tab focus
        fetchQueue(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      pollingActiveRef.current = false
    }
  }, [])

  // 2. Fetch queue logic (conversations and matching leads)
  const fetchQueue = async (isSilent = false) => {
    if (!accessToken || !pollingActiveRef.current) return
    if (!isSilent) setLoading(true)
    if (isSilent) setConnectionStatus('reconnecting')

    try {
      const leadsData = await apiClient.get('/api/leads/')
      const fetchedLeads = leadsData.results || leadsData || []
      setLeads(fetchedLeads)

      const convsData = await apiClient.get('/api/conversations/')
      const fetchedConvs = convsData.results || convsData || []
      setConversations(fetchedConvs)

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

  // 3. Fetch active thread messages
  const fetchActiveMessages = async (isSilent = false) => {
    if (!activeConvId || !accessToken || !isTabVisible.current || !pollingActiveRef.current) return

    try {
      const messagesData = await apiClient.get(`/api/conversations/${activeConvId}/messages/`)
      setMessages((prev) => mergeMessages(prev, messagesData || []))
      
      // Load internal notes corresponding to this lead
      const activeConv = conversations.find(c => c.id === activeConvId)
      if (activeConv) {
        setNotes(NotesManager.getNotes(activeConv.lead))
      }
      setConnectionStatus('connected')
    } catch (err: any) {
      console.warn("Message sync fail:", err.message)
    }
  }

  // 4. Initial page load
  useEffect(() => {
    if (accessToken) {
      fetchQueue().then(() => {
        // Check if there is an initial lead from searchParams
        const initialLeadId = searchParams.get('lead')
        if (initialLeadId) {
          // Find corresponding conversation
          const matchedConv = conversations.find(c => c.lead === initialLeadId)
          if (matchedConv) {
            setActiveConvId(matchedConv.id)
            setMobileShowThread(true)
          }
        }
      })
    }
  }, [accessToken, searchParams])

  // 5. Query parameters sync when selecting active conversation
  useEffect(() => {
    if (activeConvId) {
      const activeConv = conversations.find(c => c.id === activeConvId)
      if (activeConv) {
        router.replace(`/dashboard/conversations?lead=${activeConv.lead}`)
        fetchActiveMessages()
      }
    }
  }, [activeConvId])

  // 6. Polling triggers
  useEffect(() => {
    if (!accessToken) return

    // 10s Queue polling
    const queueInterval = setInterval(() => {
      if (isTabVisible.current) {
        fetchQueue(true)
      }
    }, 10000)

    return () => clearInterval(queueInterval)
  }, [accessToken])

  useEffect(() => {
    if (!activeConvId || !accessToken) return

    // 5s Active thread polling
    const threadInterval = setInterval(() => {
      if (isTabVisible.current) {
        fetchActiveMessages(true)
      }
    }, 5000)

    return () => clearInterval(threadInterval)
  }, [activeConvId, accessToken])

  // 7. Auto-scroll logic (preserves position if scrolled up)
  useEffect(() => {
    const el = chatScrollContainerRef.current
    if (!el) return

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom || messages.length <= 1) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // 8. Heat score calculator for priority sorting
  const calculateHeatScore = (conv: Conversation) => {
    const lead = leads.find(l => l.id === conv.lead)
    let score = 0

    if (!lead) return score

    // Urgency weights
    if (lead.urgency === 'IMMEDIATE_LEAK') score += 100
    if (lead.urgency === 'ACTIVE_DAMAGE') score += 60
    if (lead.urgency === 'STANDARD_ESTIMATE') score += 20

    // Takeover state
    if (conv.status === 'HUMAN_HANDOFF') score += 40

    // Low confidence risk
    if (conv.last_ai_confidence < 0.70) score += 30

    // Waiting elapsed time calculation (1 point per 3 minutes up to 40 max)
    try {
      const elapsedMins = Math.floor((new Date().getTime() - new Date(conv.updated_at).getTime()) / 60000)
      score += Math.min(Math.floor(elapsedMins / 3), 40)
    } catch (_) {}

    return score
  }

  // Sorted Queue list
  const sortedQueue = [...conversations]
    .filter(c => {
      const l = leads.find(lead => lead.id === c.lead)
      return l ? l.status !== 'ARCHIVED' : true
    })
    .sort((a, b) => {
      // Pinned Immediate leaks strictly sort highest
      const aLead = leads.find(l => l.id === a.lead)
      const bLead = leads.find(l => l.id === b.lead)
      
      const aIsEmergency = aLead?.urgency === 'IMMEDIATE_LEAK'
      const bIsEmergency = bLead?.urgency === 'IMMEDIATE_LEAK'

      if (aIsEmergency && !bIsEmergency) return -1
      if (!aIsEmergency && bIsEmergency) return 1

      // Otherwise sort by heat score
      return calculateHeatScore(b) - calculateHeatScore(a)
    })

  const activeConv = conversations.find(c => c.id === activeConvId)
  const activeLead = activeConv ? leads.find(l => l.id === activeConv.lead) : null

  // Timings
  const getWaitingTime = (isoString: string) => {
    try {
      const diffMs = new Date().getTime() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Waiting <1m'
      if (diffMins < 60) return `${diffMins}m`
      const diffHours = Math.floor(diffMins / 60)
      return `${diffHours}h`
    } catch (_) {
      return ''
    }
  }

  // Escalation scanning alerts
  const detectEscalations = () => {
    if (messages.length === 0) return null

    const textDump = messages.map(m => m.content.toLowerCase()).join(' ')
    
    if (textDump.includes('lawsuit') || textDump.includes('sue') || textDump.includes('legal') || textDump.includes('court') || textDump.includes('attorney')) {
      return { type: 'danger', msg: 'LEGAL ESCALATION: Customer reference to lawsuit/attorney detected. Human takeover immediate.' }
    }
    if (textDump.includes('angry') || textDump.includes('furious') || textDump.includes('terrible') || textDump.includes('scam') || textDump.includes('worst')) {
      return { type: 'warning', msg: 'CUSTOMER DISTRESS: Hostile keywords detected. Takeover recommended.' }
    }
    if (activeLead?.urgency === 'IMMEDIATE_LEAK') {
      return { type: 'emergency', msg: 'EMERGENCY DISPATCH: Immediate active roof leak reported. Action required.' }
    }
    return null
  }

  const activeAlert = detectEscalations()

  // Actions
  const handleToggleTakeover = async () => {
    if (!activeConv) return
    const isPaused = activeConv.status === 'HUMAN_HANDOFF'
    const endpoint = isPaused ? `/api/conversations/${activeConv.id}/resume_ai/` : `/api/conversations/${activeConv.id}/takeover/`

    try {
      const data = await apiClient.post(endpoint)
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status: data.status } : c))
      addToast(isPaused ? 'AI replies active.' : 'AI paused. Takeover active.', 'success')
      fetchQueue(true)
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    }
  }

  const handleMarkEmergency = async () => {
    if (!activeLead) return
    try {
      await apiClient.patch(`/api/leads/${activeLead.id}/`, { urgency: 'IMMEDIATE_LEAK' })
      addToast('Flagged lead as Immediate Emergency.', 'success')
      fetchQueue(true)
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    }
  }

  const handleArchiveLead = async () => {
    if (!activeLead) return
    try {
      await apiClient.patch(`/api/leads/${activeLead.id}/`, { status: 'ARCHIVED' })
      addToast('Lead archived.', 'success')
      setActiveConvId(null)
      setMobileShowThread(false)
      fetchQueue(true)
    } catch (err: any) {
      addToast(err.message || 'Action failed.', 'error')
    }
  }

  const handleAddNote = () => {
    if (!activeLead || !noteInput.trim()) return
    const updated = NotesManager.addNote(activeLead.id, noteInput.trim())
    setNotes(updated)
    setNoteInput('')
    addToast('Internal note saved.', 'success')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeConv || !composerInput.trim() || sendingMsg) return

    setSendingMsg(true)
    const content = composerInput.trim()
    setComposerInput('')

    try {
      // 1. Post human reply (will auto-trigger SMS back if SMS channel, pauses AI)
      const newMsg = await apiClient.post(`/api/conversations/${activeConv.id}/reply/`, { content })
      
      // Update local state instantly
      setMessages(prev => [...prev, newMsg])
      
      // Mark conversation as human handoff locally
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status: 'HUMAN_HANDOFF' } : c))
      
      addToast('Message dispatched.', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to dispatch text.', 'error')
      // Restore input on failure
      setComposerInput(content)
    } finally {
      setSendingMsg(false)
    }
  }

  const quickReplies = [
    "We can inspect tomorrow afternoon.",
    "Are you experiencing active leaking?",
    "Can you send photos of the damaged area?",
    "Do you have an active insurance claim?"
  ]

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col relative overflow-hidden">
      
      {/* Network Lost Notice */}
      {connectionStatus === 'failed' && (
        <div className="bg-red-500 text-slate-950 font-extrabold px-4 py-3 rounded flex items-center justify-between text-xs tracking-wider animate-pulse z-40 shadow-lg shrink-0 mb-4">
          <span className="flex items-center gap-2">
            <WifiOff className="h-4.5 w-4.5" /> DISPATCH DISCONNECTED: RETRYING CONNECTION...
          </span>
          <button 
            onClick={() => fetchQueue()}
            className="bg-slate-950 text-white font-mono px-3 py-1 rounded text-[10px]"
          >
            RE-SYNC
          </button>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex bg-slate-900/10 border border-slate-900 rounded-lg overflow-hidden h-full">
        
        {/* SIDEBAR QUEUE: visible on desktop, or on mobile when thread is hidden */}
        <div className={`w-full md:w-80 border-r border-slate-900 bg-slate-900/10 flex flex-col shrink-0 ${
          mobileShowThread ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-900 bg-slate-950 flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Lead Dispatch Queue</span>
            <span className="bg-orange-500/10 text-orange-500 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
              {sortedQueue.length} Active
            </span>
          </div>

          {/* Queue List scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-900/50">
            {sortedQueue.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-600">No active threads.</div>
            ) : (
              sortedQueue.map((conv) => {
                const lead = leads.find(l => l.id === conv.lead)
                const isSelected = conv.id === activeConvId
                const isEmergency = lead?.urgency === 'IMMEDIATE_LEAK'
                const isHandoff = conv.status === 'HUMAN_HANDOFF'
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id)
                      setMobileShowThread(true)
                    }}
                    className={`p-4 cursor-pointer transition select-none ${
                      isSelected 
                        ? 'bg-slate-950 border-l-4 border-orange-500' 
                        : isEmergency 
                          ? 'bg-red-500/5 hover:bg-slate-900/40 border-l-4 border-red-500' 
                          : 'hover:bg-slate-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        {isEmergency && (
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                        )}
                        <span className={`font-extrabold text-xs truncate max-w-[130px] ${
                          isEmergency ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {lead?.name || lead?.phone || conv.lead_phone}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500">
                        {getWaitingTime(conv.updated_at)}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 truncate max-w-[200px] mb-2 font-medium">
                      {lead?.roof_issue || 'Qualifying roof replacement...'}
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                        isHandoff 
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                          : 'bg-orange-500/10 text-orange-500'
                      }`}>
                        {isHandoff ? 'Paused (Review)' : 'AI Qualifying'}
                      </span>
                      
                      {conv.last_ai_confidence < 0.70 && (
                        <span className="bg-amber-500/10 text-amber-500 text-[8px] px-1.5 rounded font-mono">
                          Risk {Math.round(conv.last_ai_confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* THREAD VIEW: visible on desktop, or on mobile when thread is shown */}
        <div className={`flex-1 flex flex-col bg-slate-950/40 relative ${
          mobileShowThread ? 'flex' : 'hidden md:flex'
        }`}>
          {activeConv && activeLead ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-900 bg-slate-950 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileShowThread(false)}
                    className="md:hidden text-slate-400 hover:text-white p-1 border border-slate-800 rounded bg-slate-900"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">{activeLead.name || activeLead.phone}</span>
                      <span className="text-xs font-mono text-slate-500">({activeLead.phone})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[300px]">
                      {activeLead.address || 'Address pending qualification'}
                    </div>
                  </div>
                </div>

                {/* Takeover Control buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleTakeover}
                    className={`text-[10px] font-mono font-bold px-3 py-2 rounded transition border ${
                      activeConv.status === 'HUMAN_HANDOFF'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    {activeConv.status === 'HUMAN_HANDOFF' ? 'Resume AI' : 'Pause AI'}
                  </button>
                  
                  <button
                    onClick={handleMarkEmergency}
                    disabled={activeLead.urgency === 'IMMEDIATE_LEAK'}
                    className="bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold px-3 py-2 rounded text-red-400 hover:border-slate-700 disabled:opacity-30"
                  >
                    Emergency
                  </button>

                  <button
                    onClick={handleArchiveLead}
                    className="bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold px-3 py-2 rounded text-slate-500 hover:text-white hover:border-slate-700"
                  >
                    Archive
                  </button>
                </div>
              </div>

              {/* Escalation Warning Banners */}
              {activeAlert && (
                <div className={`p-3 text-xs font-semibold flex items-center gap-2 border-b shrink-0 ${
                  activeAlert.type === 'danger' 
                    ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                    : activeAlert.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-red-950/20 border-red-500/20 text-red-300'
                }`}>
                  <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                  <span>{activeAlert.msg}</span>
                </div>
              )}

              {/* Split Body: Left Chat Log, Right Internal Notes */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* Chat Log Feed */}
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div 
                    ref={chatScrollContainerRef}
                    className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/10"
                  >
                    {messages.length === 0 ? (
                      <div className="text-center font-mono text-xs text-slate-600 py-12">No messages exchanged.</div>
                    ) : (
                      messages.map((msg) => {
                        const isLead = msg.sender_type === 'LEAD'
                        const isAI = msg.sender_type === 'AI'
                        const isHuman = msg.sender_type === 'HUMAN'

                        return (
                          <div key={msg.id} className={`flex flex-col ${isLead ? 'items-start' : 'items-end'}`}>
                            <div className={`p-3 rounded text-xs max-w-[85%] border font-medium ${
                              isLead 
                                ? 'bg-slate-900 border-slate-800/80 text-white' 
                                : isAI 
                                  ? 'bg-slate-950 border-slate-900 text-slate-300'
                                  : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                            }`}>
                              <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500 mb-1">
                                {isLead ? (
                                  <>
                                    <User className="h-3 w-3 text-slate-400" />
                                    <span>Homeowner</span>
                                  </>
                                ) : isAI ? (
                                  <>
                                    <Sparkles className="h-3 w-3 text-orange-500" />
                                    <span>AI Assistant</span>
                                  </>
                                ) : (
                                  <>
                                    <User className="h-3 w-3 text-orange-500" />
                                    <span>Representative</span>
                                  </>
                                )}
                              </div>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] font-mono text-slate-600">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {!isLead && (
                                <span className={`text-[8px] font-mono uppercase font-bold ${
                                  msg.delivery_status === 'failed' ? 'text-red-500' : 'text-slate-600'
                                }`}>
                                  {msg.delivery_status}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Message Composer & Suggestions */}
                  <div className="p-4 border-t border-slate-900 bg-slate-950 shrink-0">
                    
                    {/* Suggested Replies */}
                    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none select-none">
                      {quickReplies.map((reply, i) => (
                        <button
                          key={i}
                          onClick={() => setComposerInput(reply)}
                          className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={composerInput}
                        onChange={(e) => setComposerInput(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 placeholder:text-slate-650"
                        placeholder={activeConv.status === 'HUMAN_HANDOFF' ? "AI is paused. Send manual text back..." : "AI active. Typing pauses AI..."}
                      />
                      <button
                        type="submit"
                        disabled={sendingMsg || !composerInput.trim()}
                        className="bg-orange-500 text-slate-950 font-bold px-5 rounded hover:bg-orange-600 transition disabled:opacity-40 flex items-center justify-center"
                      >
                        <Send className="h-4.5 w-4.5" />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Right panel: Internal Notes */}
                <div className="hidden lg:flex w-64 border-l border-slate-900 bg-slate-950/20 flex-col overflow-hidden">
                  <div className="p-3 border-b border-slate-900 bg-slate-950 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    Internal Dispatch Notes
                  </div>
                  
                  {/* Notes list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {notes.length === 0 ? (
                      <div className="text-center font-mono text-[10px] text-slate-600 py-6">No notes added.</div>
                    ) : (
                      notes.map((note, idx) => (
                        <div key={idx} className="bg-orange-500/5 border border-orange-500/10 p-2.5 rounded text-[11px] text-slate-300 leading-normal font-medium">
                          {note}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add note composer */}
                  <div className="p-3 border-t border-slate-900 bg-slate-950 flex flex-col gap-2">
                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 h-16 placeholder:text-slate-600"
                      placeholder="Add estimator details or claim numbers..."
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!noteInput.trim()}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-orange-500 font-bold py-2 rounded text-[10px] uppercase font-mono transition"
                    >
                      Save Internal Note
                    </button>
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-full text-slate-600 mb-3">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="text-md font-bold text-white mb-1">Dispatch Active</h2>
              <p className="text-xs text-slate-500 max-w-sm">
                Select an active conversation thread from the dispatch queue to recover missed calls and inspect responses.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-slate-500 gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
        <span>Syncing conversations workspace...</span>
      </div>
    }>
      <ConversationsContent />
    </Suspense>
  )
}
