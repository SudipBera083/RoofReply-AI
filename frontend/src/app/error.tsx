'use client'

import { useEffect } from 'react'
import { AlertOctagon } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Next.js Global Boundary Error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-full mb-4">
        <AlertOctagon className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
        {error.message || 'An unexpected client-side error occurred inside the dashboard application.'}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="bg-orange-500 text-slate-950 font-bold px-6 py-2.5 rounded text-xs hover:bg-orange-600 transition"
        >
          Retry Connection
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-6 py-2.5 rounded text-xs transition"
        >
          Return Home
        </button>
      </div>
    </div>
  )
}
