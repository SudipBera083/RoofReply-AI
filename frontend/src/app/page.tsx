'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Hammer, AlertTriangle, PhoneCall, Calendar, ShieldCheck, Check } from 'lucide-react'

export default function LandingPage() {
  const [missedCalls, setMissedCalls] = useState(6)
  const [averageTicket, setAverageTicket] = useState(12000)
  const [conversionRate, setConversionRate] = useState(30) // 30% conversion

  // ROI Math
  const recoveredLeads = Math.round(missedCalls * 12)
  const bookedEstimates = Math.round(recoveredLeads * (conversionRate / 100))
  const potentialRevenue = bookedEstimates * averageTicket

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 text-slate-950 p-2 rounded">
              <Hammer className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
              RoofReply <span className="text-orange-500">AI</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
            <a href="#how-it-works" className="hover:text-white transition">How it Works</a>
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#roi-calculator" className="hover:text-white transition">ROI Calculator</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white transition">
              Log In
            </Link>
            <Link href="/register" className="bg-orange-500 text-slate-950 font-bold px-4 py-2 rounded text-sm hover:bg-orange-600 transition shadow-[0_0_15px_rgba(249,115,22,0.3)]">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
          <AlertTriangle className="h-4 w-4" /> Lost Leads Cost Thousands
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-4xl mx-auto">
          Stop Losing Roofing Leads <br className="hidden md:inline" />
          <span className="text-orange-500">After Hours & to Voicemail.</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          We instantly text back missed calls, qualify the homeowner with AI, and schedule storm inspections and shingle replacement estimates automatically.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register" className="w-full sm:w-auto bg-orange-500 text-slate-950 font-extrabold px-8 py-4 rounded text-lg hover:bg-orange-600 transition shadow-[0_0_20px_rgba(249,115,22,0.4)]">
            Start Missed Call Recovery
          </Link>
          <a href="#roi-calculator" className="w-full sm:w-auto border border-slate-800 hover:border-slate-700 bg-slate-900/50 text-slate-200 px-8 py-4 rounded text-lg transition">
            Calculate your ROI
          </a>
        </div>
        
        {/* Mockup Dashboard Shell Preview */}
        <div className="mt-16 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40 shadow-2xl max-w-4xl mx-auto">
          <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-orange-500" /> StormShield Roofing - Missed-Call Recovery Feed</span>
            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">LIVE RECOVERY ACTIVE</span>
          </div>
          <div className="p-6 text-left space-y-4">
            <div className="border border-red-500/30 bg-red-950/20 rounded p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-red-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded uppercase">EMERGENCY LEAK</span>
                  <span className="text-slate-200 font-bold">Alice J. (+14045550110)</span>
                </div>
                <p className="text-sm text-slate-400">“Water pouring in ceiling. Shingle damage on roof ridge after wind storm.”</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 mb-1">Status callback: SMS recovery sent</div>
                <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs px-3 py-1 rounded font-mono">WAITING FOR ADDRESS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="border-t border-slate-900 bg-slate-900/10 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold tracking-tight text-white text-center mb-12">
            Built for the Truck, the Roof, and the Storm
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="border border-slate-900 bg-slate-950 p-6 rounded-lg">
              <div className="h-12 w-12 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded flex items-center justify-center mb-6">
                <PhoneCall className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">1. You Miss a Call</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                When you're busy nailing shingles, estimating commercial slopes, or dealing with adjusters, calls go to voicemail. We capture them instantly.
              </p>
            </div>
            <div className="border border-slate-900 bg-slate-950 p-6 rounded-lg">
              <div className="h-12 w-12 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded flex items-center justify-center mb-6">
                <Hammer className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">2. AI Initiates SMS Response</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Within 10 seconds, our system sends a text back. It qualifies the issue (replacement vs. repair), determines insurance involvement, and logs the details.
              </p>
            </div>
            <div className="border border-slate-900 bg-slate-950 p-6 rounded-lg">
              <div className="h-12 w-12 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded flex items-center justify-center mb-6">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">3. Inspection Booked</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                AI checks your working hours and available slots, prompting the homeowner for their preferred day, which queues a booking alert straight to your phone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section id="roi-calculator" className="border-t border-slate-900 py-20 bg-slate-900/20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold tracking-tight text-white text-center mb-4">
            How Much Money Are You Leaving on the Table?
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Most roofing contractors lose 4 to 10 leads a month simply from missed calls. Let's calculate your recovered revenue.
          </p>
          <div className="grid md:grid-cols-2 gap-8 border border-slate-800 bg-slate-900/30 p-8 rounded-lg">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Missed Calls / Month: <span className="text-orange-500 font-bold">{missedCalls}</span>
                </label>
                <input 
                  type="range" 
                  min="2" 
                  max="30" 
                  value={missedCalls} 
                  onChange={(e) => setMissedCalls(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Average Roof Contract Value: <span className="text-orange-500 font-bold">${averageTicket.toLocaleString()}</span>
                </label>
                <input 
                  type="range" 
                  min="3000" 
                  max="25000" 
                  step="500" 
                  value={averageTicket} 
                  onChange={(e) => setAverageTicket(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Estimate Conversion Rate: <span className="text-orange-500 font-bold">{conversionRate}%</span>
                </label>
                <input 
                  type="range" 
                  min="10" 
                  max="70" 
                  value={conversionRate} 
                  onChange={(e) => setConversionRate(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
            </div>
            <div className="flex flex-col justify-between p-6 bg-slate-950 rounded border border-slate-800">
              <div className="space-y-4">
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-sm text-slate-400">Recovered Leads / Year</span>
                  <span className="font-bold text-white">{recoveredLeads} leads</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-sm text-slate-400">Booked Roof Contracts</span>
                  <span className="font-bold text-white">{bookedEstimates} contracts</span>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-800">
                <div className="text-xs font-mono uppercase text-slate-500 mb-1">Potential Recovered Revenue</div>
                <div className="text-3xl font-extrabold text-orange-500 tracking-tight">
                  ${potentialRevenue.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-slate-900 py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold tracking-tight text-white text-center mb-4">
            Transparent Pricing. Pays for itself with 1 lead.
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-md mx-auto">
            Choose the plan that fits your roofing crews. Start recovering leads today.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Starter Plan */}
            <div className="border border-slate-800 bg-slate-900/20 p-8 rounded-lg flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Starter Plan</h3>
                <p className="text-sm text-slate-400 mb-6">Perfect for small local roofing crews and independent estimators.</p>
                <div className="text-4xl font-extrabold text-white mb-6">
                  $199<span className="text-lg text-slate-500 font-normal"> /mo</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Missed-Call SMS Auto-Text Back</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Website Chat Widget</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Core AI Qualification Flow</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Internal Inspection Scheduler</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Owner Email Notifications</li>
                </ul>
              </div>
              <Link href="/register" className="mt-8 block w-full text-center bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold py-3 rounded transition">
                Start Starter Trial
              </Link>
            </div>

            {/* Growth Plan */}
            <div className="border-2 border-orange-500 bg-slate-900/30 p-8 rounded-lg relative flex flex-col justify-between shadow-[0_0_30px_rgba(249,115,22,0.1)]">
              <div className="absolute top-0 right-6 -translate-y-1/2 bg-orange-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider px-3 py-1 rounded">
                MOST POPULAR FOR CREWS
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Growth Plan</h3>
                <p className="text-sm text-slate-400 mb-6">For multi-crew roofing outfits spending on Google/FB Local Service Ads.</p>
                <div className="text-4xl font-extrabold text-orange-500 mb-6">
                  $399<span className="text-lg text-slate-500 font-normal"> /mo</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-200">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Everything in Starter</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Advanced Insurance Claims AI filters</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Automated Lead Follow-up Campaigns</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Owner SMS & Call Notifications</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-orange-500" /> Priority Support (Storm event onboarding)</li>
                </ul>
              </div>
              <Link href="/register" className="mt-8 block w-full text-center bg-orange-500 text-slate-950 font-extrabold py-3 rounded hover:bg-orange-600 transition shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                Start Growth Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500">
          <span className="flex items-center gap-1.5 font-bold text-slate-300">
            <Hammer className="h-4 w-4 text-orange-500" /> RoofReply AI
          </span>
          <p>© 2026 RoofReply AI. All rights reserved. Missed call estimate automation systems.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-300">Terms</a>
            <a href="#" className="hover:text-slate-300">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
