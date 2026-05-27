'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { apiClient } from '@/utils/apiClient'
import { 
  AlertTriangle, Calendar, Clock, User, Phone, MapPin, 
  Navigation, CheckCircle2, XCircle, ArrowRight, CloudLightning, 
  RefreshCw, ChevronRight, UserCheck, Play, WifiOff, MessageSquare 
} from 'lucide-react'

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  urgency: string;
  status: string;
  roof_issue: string;
}

interface Appointment {
  id: string;
  lead: string; // UUID
  start_time: string; // ISO
  end_time: string; // ISO
  status: string; // Backend status: PENDING, CONFIRMED, etc.
  notes: string;
  lead_name?: string;
  lead_phone?: string;
  lead_email?: string;
}

// ----------------------------------------------------
// Isolated Local Managers (For MVP local persistence)
// ----------------------------------------------------
const EstimatorManager = {
  getEstimator: (apptId: string): string => {
    if (typeof window === 'undefined') return 'Unassigned'
    return localStorage.getItem(`roofreply_est_${apptId}`) || 'Unassigned'
  },
  setEstimator: (apptId: string, name: string): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`roofreply_est_${apptId}`, name)
  }
}

const StatusManager = {
  getStatus: (apptId: string, backendStatus: string): string => {
    if (typeof window === 'undefined') return backendStatus
    const local = localStorage.getItem(`roofreply_status_${apptId}`)
    return local || backendStatus
  },
  setStatus: (apptId: string, status: string): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`roofreply_status_${apptId}`, status)
  }
}

export default function AppointmentsPage() {
  const accessToken = useStore((state) => state.accessToken)
  const addToast = useStore((state) => state.addToast)

  // Collections
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  
  // UI states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'failed'>('connected')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Storm Surge Mode
  const [stormSurgeMode, setStormSurgeMode] = useState(false)

  // Selected Appointment for detail drawer
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  
  // Edit/Reschedule states inside drawer
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')

  // Active estimators list
  const estimators = ['Dave Johnson', 'John Miller', 'Steve Henderson', 'Mark Reynolds']

  const isTabVisible = useRef(true)
  const pollingActiveRef = useRef(true)

  // 1. Polling and Tab Visibility hooks
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisible.current = document.visibilityState === 'visible'
      if (isTabVisible.current) fetchSchedule(true)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      pollingActiveRef.current = false
    }
  }, [])

  const fetchSchedule = async (isSilent = false) => {
    if (!accessToken || !pollingActiveRef.current) return
    if (!isSilent) setLoading(true)
    if (isSilent) setConnectionStatus('reconnecting')

    try {
      // Fetch appointments
      const apptsData = await apiClient.get('/api/appointments/')
      const fetchedAppts = apptsData.results || apptsData || []
      setAppointments(fetchedAppts)

      // Fetch leads
      const leadsData = await apiClient.get('/api/leads/')
      const fetchedLeads = leadsData.results || leadsData || []
      setLeads(fetchedLeads)

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

  // Initial load
  useEffect(() => {
    if (accessToken) {
      fetchSchedule()
    }
  }, [accessToken])

  // Polling every 10 seconds
  useEffect(() => {
    if (!accessToken) return
    const interval = setInterval(() => {
      if (isTabVisible.current) fetchSchedule(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [accessToken])

  // ----------------------------------------------------
  // Hardened Conflicts & Warnings Analyzer
  // ----------------------------------------------------
  interface ScheduleConflict {
    apptId: string;
    type: 'overlap' | 'after-hours' | 'overload' | 'time-gap';
    message: string;
  }

  const analyzeConflicts = (): ScheduleConflict[] => {
    const conflicts: ScheduleConflict[] = []
    const estimatorDays: Record<string, string[]> = {} // tracks estimator -> array of dates

    appointments.forEach((appt, i) => {
      const start = new Date(appt.start_time)
      const end = new Date(appt.end_time)
      const dateStr = start.toDateString()
      const est = EstimatorManager.getEstimator(appt.id)

      if (appt.status === 'CANCELLED' || appt.status === 'Completed') return

      // 1. After-hours validation (Work hours: 8 AM to 5 PM)
      const startHour = start.getHours()
      const endHour = end.getHours()
      if (startHour < 8 || endHour > 17 || start.getDay() === 0 || start.getDay() === 6) {
        conflicts.push({
          apptId: appt.id,
          type: 'after-hours',
          message: 'After-hours inspection warning: Slot scheduled outside Mon-Fri 8 AM - 5 PM.'
        })
      }

      // 2. Estimator Overload (Max 3 appointments per estimator per day)
      if (est !== 'Unassigned') {
        const key = `${est}_${dateStr}`
        if (!estimatorDays[key]) estimatorDays[key] = []
        estimatorDays[key].push(appt.id)
        if (estimatorDays[key].length > 3) {
          conflicts.push({
            apptId: appt.id,
            type: 'overload',
            message: `Overload warning: ${est} has ${estimatorDays[key].length} inspections scheduled for today.`
          })
        }
      }

      // 3. Double-bookings & Unrealistic Time Gaps
      appointments.forEach((otherAppt, j) => {
        if (i === j || otherAppt.status === 'CANCELLED' || otherAppt.status === 'Completed') return

        const otherStart = new Date(otherAppt.start_time)
        const otherEnd = new Date(otherAppt.end_time)
        const otherEst = EstimatorManager.getEstimator(otherAppt.id)

        // Double-booking check: same estimator or same lead slot overlap
        if (est !== 'Unassigned' && est === otherEst) {
          const overlaps = start < otherEnd && end > otherStart
          if (overlaps) {
            conflicts.push({
              apptId: appt.id,
              type: 'overlap',
              message: `Double-booking: Overlaps with another job assigned to ${est}.`
            })
          }

          // Unrealistic time gap: less than 30 mins between jobs for different leads
          if (appt.lead !== otherAppt.lead) {
            const timeDiff = Math.abs(start.getTime() - otherEnd.getTime()) / 60000 // difference in minutes
            if (timeDiff > 0 && timeDiff < 30) {
              conflicts.push({
                apptId: appt.id,
                type: 'time-gap',
                message: `Tight Schedule: Less than 30m transfer gap from previous job for ${est}.`
              })
            }
          }
        }
      })
    })

    return conflicts
  }

  const conflictsList = analyzeConflicts()

  // ----------------------------------------------------
  // Filtering & Prioritization
  // ----------------------------------------------------
  const getInspectionPriority = (appt: Appointment) => {
    const lead = leads.find(l => l.id === appt.lead)
    const opStatus = StatusManager.getStatus(appt.id, appt.status)
    
    let score = 0
    if (!lead) return score

    if (lead.urgency === 'IMMEDIATE_LEAK') score += 100
    if (lead.urgency === 'ACTIVE_DAMAGE') score += 60
    if (opStatus === 'Running Late') score += 40
    if (EstimatorManager.getEstimator(appt.id) === 'Unassigned') score += 20
    
    return score
  }

  const activeAppointments = appointments.filter(appt => {
    const lead = leads.find(l => l.id === appt.lead)
    if (!lead) return false

    // Storm Surge mode compresses standard visits, showing only emergencies and storm damage jobs
    if (stormSurgeMode) {
      return ['IMMEDIATE_LEAK', 'ACTIVE_DAMAGE'].includes(lead.urgency)
    }

    return true
  })

  // Prioritize dispatches: Emergency, Storm, Late, Unassigned, Standard
  const sortedAppointments = [...activeAppointments].sort((a, b) => {
    return getInspectionPriority(b) - getInspectionPriority(a)
  })

  // Action methods
  const handleAssignEstimator = async (apptId: string, name: string) => {
    EstimatorManager.setEstimator(apptId, name)
    addToast(`Assigned ${name} to inspection.`, 'success')
    fetchSchedule(true)
  }

  const handleUpdateStatus = async (apptId: string, newStatus: string) => {
    StatusManager.setStatus(apptId, newStatus)
    
    // Sync backend status mappings if matches standard states
    const backendStatusMap: Record<string, string> = {
      'Scheduled': 'CONFIRMED',
      'Completed': 'COMPLETED',
      'Cancelled': 'CANCELLED'
    }
    
    const backendState = backendStatusMap[newStatus]
    try {
      if (backendState) {
        await apiClient.patch(`/api/appointments/${apptId}/`, { status: backendState })
      }
      addToast(`Status updated to ${newStatus}.`, 'success')
      fetchSchedule(true)
    } catch (err: any) {
      addToast(err.message || 'Failed to update backend status.', 'error')
    }
  }

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAppt || !rescheduleDate || !rescheduleTime) return

    const newStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`)
    const newEnd = new Date(newStart.getTime() + 60 * 60000) // Default 1 hour slot

    try {
      await apiClient.patch(`/api/appointments/${selectedAppt.id}/`, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        status: 'RESCHEDULED'
      })
      StatusManager.setStatus(selectedAppt.id, 'Scheduled')
      addToast('Inspection rescheduled successfully.', 'success')
      setSelectedAppt(null)
      fetchSchedule(true)
    } catch (err: any) {
      addToast(err.message || 'Reschedule conflict detected.', 'error')
    }
  }

  if (loading && appointments.length === 0) {
    return (
      <div className="flex flex-col gap-2 items-center justify-center min-h-[400px] text-xs font-mono text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
        <span>Syncing inspection dispatches...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative pb-16">
      
      {/* Network Alert */}
      {connectionStatus === 'failed' && (
        <div className="bg-red-500 text-slate-950 font-extrabold px-4 py-3 rounded flex items-center justify-between text-xs tracking-wider animate-pulse z-40 shadow-lg shrink-0">
          <span className="flex items-center gap-2">
            <WifiOff className="h-4.5 w-4.5" /> SCHEDULER DISCONNECTED: OFFLINE. RETRYING SYNC...
          </span>
          <button onClick={() => fetchSchedule()} className="bg-slate-950 text-white font-mono px-3 py-1 rounded text-[10px]">
            FORCE SYNC
          </button>
        </div>
      )}

      {/* Storm Surge Banner placeholder */}
      <div className={`p-4 rounded-lg border transition ${
        stormSurgeMode 
          ? 'bg-red-950/20 border-red-500/40 text-red-400' 
          : 'bg-slate-900/10 border-slate-900 text-slate-500'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <CloudLightning className={`h-6 w-6 ${stormSurgeMode ? 'text-red-500 animate-bounce' : 'text-slate-650'}`} />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {stormSurgeMode ? 'STORM SURGE MODE ACTIVE' : 'Storm Readiness Monitor'}
              </div>
              <p className="text-[10px] leading-normal mt-0.5">
                {stormSurgeMode 
                  ? 'Severe storm dispatches prioritized. Standard planning visits are compressed.'
                  : 'Toggle Storm Surge mode to lock slot schedules for emergency roof leaks during severe weather.'
                }
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setStormSurgeMode(!stormSurgeMode)}
            className={`font-mono text-xs px-4 py-2 rounded font-extrabold uppercase transition ${
              stormSurgeMode 
                ? 'bg-red-500 text-slate-950 hover:bg-red-600'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            {stormSurgeMode ? 'Deactivate Surge' : 'Activate Surge'}
          </button>
        </div>
      </div>

      {/* Header and sync status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Inspection Dispatch Workspace</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">Coordinate estimator visits and prevent scheduling conflicts</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
          <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
          <button 
            onClick={() => fetchSchedule()}
            className="bg-slate-900 border border-slate-800 p-2 rounded text-slate-300 hover:border-slate-700 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Layout Split: Left Schedule List, Right Quick Estimators Panel */}
      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Schedule list */}
        <div className="flex-1 space-y-4">
          <div className="bg-slate-900/60 px-6 py-3.5 border border-slate-900 rounded-t-lg flex items-center justify-between text-xs font-mono text-slate-500 uppercase">
            <span>Operational Schedule ({sortedAppointments.length} Active)</span>
            <span>Priority</span>
          </div>

          <div className="grid gap-3">
            {sortedAppointments.length === 0 ? (
              <div className="bg-slate-900/10 border border-slate-900 p-12 text-center text-xs font-mono text-slate-500 rounded-b-lg">
                No inspections scheduled.
              </div>
            ) : (
              sortedAppointments.map((appt) => {
                const lead = leads.find(l => l.id === appt.lead)
                const est = EstimatorManager.getEstimator(appt.id)
                const opStatus = StatusManager.getStatus(appt.id, appt.status)
                const apptConflicts = conflictsList.filter(c => c.apptId === appt.id)

                const isEmergency = lead?.urgency === 'IMMEDIATE_LEAK'
                const isLate = opStatus === 'Running Late'

                return (
                  <div
                    key={appt.id}
                    onClick={() => {
                      setSelectedAppt(appt)
                      // Prepopulate date/time in reschedule inputs
                      try {
                        const d = new Date(appt.start_time)
                        setRescheduleDate(d.toISOString().slice(0, 10))
                        setRescheduleTime(d.toTimeString().slice(0, 5))
                      } catch (_) {}
                    }}
                    className={`p-5 rounded-lg border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none ${
                      isEmergency 
                        ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50' 
                        : isLate 
                          ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50'
                          : 'bg-slate-950 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    {/* Left Info block */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          isEmergency ? 'bg-red-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {lead?.urgency?.replace(/_/g, ' ') || 'STANDARD'}
                        </span>
                        
                        <span className="text-slate-200 font-extrabold text-sm">
                          {lead?.name || appt.lead_name || 'Qualifying client'}
                        </span>

                        <span className="text-xs font-mono text-slate-500">
                          ({lead?.phone || appt.lead_phone})
                        </span>

                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                          opStatus === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' :
                          opStatus === 'Running Late' ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
                          opStatus === 'En Route' ? 'bg-orange-500/10 text-orange-400' :
                          'bg-slate-900 text-slate-400'
                        }`}>
                          {opStatus}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        <span className="text-slate-500 font-mono">Address:</span> {lead?.address || 'Address pending...'}
                      </div>

                      <div className="text-xs text-slate-300 leading-normal font-semibold">
                        <span className="text-slate-500">Issue:</span> {lead?.roof_issue || appt.notes}
                      </div>

                      {/* Display Warnings */}
                      {apptConflicts.map((conf, index) => (
                        <div key={index} className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-500/5 p-2 rounded border border-amber-500/10 max-w-xl">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>{conf.message}</span>
                        </div>
                      ))}
                    </div>

                    {/* Right Info block */}
                    <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 border-t border-slate-900 pt-3 md:border-t-0 md:pt-0">
                      
                      {/* Time slot and Estimator assignment */}
                      <div className="text-left md:text-right font-mono text-xs uppercase space-y-1 text-slate-400">
                        <div className="flex items-center gap-1 text-orange-500 font-bold justify-end">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {new Date(appt.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                            {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 justify-end">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                          <span className={est === 'Unassigned' ? 'text-amber-500 font-bold' : 'text-slate-200'}>
                            {est}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-slate-650 hidden md:block" />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right quick estimators assigner panel */}
        <div className="w-full xl:w-72 bg-slate-950 border border-slate-900 p-4 rounded-lg shrink-0 h-fit space-y-4">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-900">
            Active Estimator Dispatcher
          </div>

          <div className="space-y-3">
            {estimators.map((est) => {
              const activeJobs = appointments.filter(a => 
                EstimatorManager.getEstimator(a.id) === est && 
                a.status !== 'CANCELLED' && 
                a.status !== 'Completed'
              ).length

              return (
                <div key={est} className="bg-slate-900/40 border border-slate-900 p-3 rounded flex items-center justify-between text-xs font-semibold">
                  <div>
                    <div className="text-slate-200">{est}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {activeJobs} dispatches assigned today
                    </div>
                  </div>

                  {activeJobs >= 3 ? (
                    <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase">
                      Overloaded
                    </span>
                  ) : (
                    <span className="bg-slate-950 text-slate-500 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase">
                      Available
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="bg-slate-900/10 border border-slate-900 p-3 rounded text-[10px] text-slate-500 font-mono leading-relaxed">
            <span className="text-orange-500 font-bold">Route placeholders active:</span> territory boundaries are mapped to Atlanta Metro. Estimator coordinates synchronized.
          </div>
        </div>

      </div>

      {/* Appointment Detail Drawer Overlay */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
          <div className="w-full md:w-[500px] bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl relative">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-slate-500 uppercase">Inspection Details</div>
                <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                  {selectedAppt.lead_name || 'Lead details'}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedAppt(null)}
                className="text-slate-400 hover:text-white p-2 border border-slate-800 rounded bg-slate-950"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* Customer details */}
              <div className="space-y-3">
                <div className="bg-slate-950 p-4 rounded border border-slate-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-500" />
                    <span className="font-mono text-slate-300 font-semibold">{selectedAppt.lead_phone}</span>
                  </div>
                  {leads.find(l => l.id === selectedAppt.lead)?.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                      <span className="text-slate-300">
                        {leads.find(l => l.id === selectedAppt.lead)?.address}
                      </span>
                    </div>
                  )}
                </div>

                {/* Map integration hook */}
                {leads.find(l => l.id === selectedAppt.lead)?.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(leads.find(l => l.id === selectedAppt.lead)?.address || '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white p-3 rounded font-bold flex items-center justify-center gap-1.5 transition text-center"
                  >
                    <Navigation className="h-4 w-4 text-orange-500" /> Launch Map Navigator
                  </a>
                )}
              </div>

              {/* Status Update & Estimator Assigner */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Set Status</label>
                  <select
                    value={StatusManager.getStatus(selectedAppt.id, selectedAppt.status)}
                    onChange={(e) => handleUpdateStatus(selectedAppt.id, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="En Route">En Route</option>
                    <option value="On Site">On Site</option>
                    <option value="Running Late">Running Late</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Emergency Escalated">Emergency Escalated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Assign Estimator</label>
                  <select
                    value={EstimatorManager.getEstimator(selectedAppt.id)}
                    onChange={(e) => handleAssignEstimator(selectedAppt.id, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-orange-500 font-semibold"
                  >
                    <option value="Unassigned">Unassigned</option>
                    {estimators.map(est => (
                      <option key={est} value={est}>{est}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reschedule parameters */}
              <form onSubmit={handleRescheduleSubmit} className="bg-slate-950 p-4 rounded border border-slate-900 space-y-4">
                <div className="text-[10px] font-mono font-bold text-orange-500 uppercase border-b border-slate-900 pb-2">
                  Reschedule Dispatch Time
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Time</label>
                    <input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-orange-500 text-slate-950 font-extrabold py-2.5 rounded hover:bg-orange-600 transition"
                >
                  Confirm Date Reschedule
                </button>
              </form>

              {/* Conversation redirect */}
              <div className="pt-4 border-t border-slate-800 flex gap-2">
                <Link
                  href={`/dashboard/conversations?lead=${selectedAppt.lead}`}
                  onClick={() => setSelectedAppt(null)}
                  className="flex-1 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white p-3 rounded font-bold flex items-center justify-center gap-1.5 transition text-center"
                >
                  <MessageSquare className="h-4 w-4" /> Open Conversation
                </Link>
                
                <a
                  href={`tel:${selectedAppt.lead_phone}`}
                  className="flex-1 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white p-3 rounded font-bold flex items-center justify-center gap-1.5 transition text-center"
                >
                  <Phone className="h-4 w-4" /> Call Homeowner
                </a>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky action info */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-slate-950 border border-slate-900 p-3 rounded-lg flex items-center justify-between shadow-2xl">
        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
          Weather alert active
        </span>
        <button
          onClick={() => {
            setStormSurgeMode(!stormSurgeMode)
            addToast(stormSurgeMode ? 'Surge disabled.' : 'Surge mode enabled.', 'info')
          }}
          className="bg-red-500 text-slate-950 font-extrabold text-[9px] px-3 py-1 rounded uppercase animate-pulse"
        >
          {stormSurgeMode ? 'Surge active' : 'Toggle surge'}
        </button>
      </div>

    </div>
  )
}
