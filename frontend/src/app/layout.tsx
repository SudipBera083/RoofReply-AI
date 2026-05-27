import type { Metadata } from 'next'
import './globals.css'
import ToastContainer from '@/components/ToastContainer'

export const metadata: Metadata = {
  title: 'RoofReply AI | Missed-Call & SMS Lead Recovery for Roofers',
  description: 'Stop losing roofing leads after hours. RoofReply AI instantly text-backs missed calls, qualifies leads, and schedules roof inspection estimates automatically.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
        {children}
        <ToastContainer />
      </body>
    </html>
  )
}

