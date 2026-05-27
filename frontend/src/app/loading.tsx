'use client'

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-2 font-mono text-xs text-slate-500">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
      <span>Loading Mission Control...</span>
    </div>
  )
}
