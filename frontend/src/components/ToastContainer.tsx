'use client'

import { useStore } from '@/store/useStore'
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'

export default function ToastContainer() {
  const toasts = useStore((state) => state.toasts)
  const removeToast = useStore((state) => state.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        let Icon = Info
        let borderClass = 'border-slate-800 bg-slate-900 text-slate-100'
        let iconClass = 'text-slate-400'

        if (toast.type === 'error') {
          Icon = AlertTriangle
          borderClass = 'border-red-500/30 bg-slate-900 shadow-[0_0_15px_rgba(239,68,68,0.1)] text-red-200'
          iconClass = 'text-red-500'
        } else if (toast.type === 'success') {
          Icon = CheckCircle
          borderClass = 'border-orange-500/30 bg-slate-900 shadow-[0_0_15px_rgba(249,115,22,0.1)] text-slate-100'
          iconClass = 'text-orange-500'
        } else if (toast.type === 'warning') {
          Icon = AlertCircle
          borderClass = 'border-amber-500/30 bg-slate-900 text-amber-200'
          iconClass = 'text-amber-500'
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded border text-xs font-semibold shadow-xl transition-all duration-300 transform translate-y-0 ${borderClass}`}
          >
            <Icon className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${iconClass}`} />
            <div className="flex-1 leading-normal">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
