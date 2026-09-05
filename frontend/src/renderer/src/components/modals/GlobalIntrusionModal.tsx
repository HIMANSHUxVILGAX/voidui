import React from 'react'
import { ShieldAlert, ShieldX, Eye, Radio, AlertTriangle } from 'lucide-react'

export interface GlobalIntrusionLog {
  id: string
  timestamp: string
  attacker_ip: string
  location: string
  country_code: string
  service: string
  type: string
  plain_english_summary: string
  raw_payload: string
  status: string
}

interface GlobalIntrusionModalProps {
  log: GlobalIntrusionLog | null
  onSecureBlock: (ip: string) => void
  onViewManipulate: (ip: string) => void
}

export const GlobalIntrusionModal: React.FC<GlobalIntrusionModalProps> = ({
  log,
  onSecureBlock,
  onViewManipulate
}) => {
  if (!log) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900/95 border-2 border-red-500/80 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.4)] overflow-hidden font-sans text-slate-100">
        
        {/* Top Pulsating Hazard Banner */}
        <div className="bg-gradient-to-r from-red-950 via-red-900/90 to-red-950 px-6 py-4 border-b border-red-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/50">
              <ShieldAlert className="w-6 h-6 text-red-400 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wider text-red-400 uppercase flex items-center gap-2">
                <span>INTRUSION ATTEMPT DETECTED</span>
              </h2>
              <p className="text-xs text-red-300/80 font-mono">
                Port Gatekeeper Trap Engaged • Socket Held Active
              </p>
            </div>
          </div>
          <div className="px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full flex items-center gap-1.5 text-xs text-red-400 font-mono animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            <span>LIVE INTERCEPT</span>
          </div>
        </div>

        {/* Modal Body Info */}
        <div className="p-6 space-y-5">
          {/* Summary Box */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 font-mono text-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Attacker IP & Origin</span>
              <span className="text-red-400 font-bold text-base flex items-center gap-1.5">
                {log.attacker_ip}
                <span className="text-xs font-normal text-slate-400">({log.location || 'Unknown Location'})</span>
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Target Trap Service</span>
              <span className="text-amber-400 font-semibold px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-xs">
                {log.service} ({log.type})
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-xs uppercase tracking-wider block">Attack Signature</span>
              <p className="text-slate-200 text-xs font-sans bg-slate-900 p-2.5 rounded border border-slate-800">
                {log.plain_english_summary || 'Suspicious payload probed honeypot listener.'}
              </p>
            </div>

            {log.raw_payload && (
              <div className="space-y-1">
                <span className="text-slate-400 text-xs uppercase tracking-wider block">Raw Payload Probed</span>
                <pre className="text-xs text-emerald-400 bg-slate-900/90 p-2.5 rounded border border-slate-800 overflow-x-auto max-h-24">
                  {log.raw_payload}
                </pre>
              </div>
            )}
          </div>

          {/* Action Prompt */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p>
              The attacker is currently stuck in the gatekeeper hold socket. Choose whether to sever connection immediately or enter Deception Control Room to observe and manipulate payload data.
            </p>
          </div>

          {/* Dual Action Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => onSecureBlock(log.attacker_ip)}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-900/30 hover:shadow-red-600/40 border border-red-400/30 transition-all transform active:scale-95 cursor-pointer"
            >
              <ShieldX className="w-5 h-5" />
              <span>SECURE & BLOCK</span>
            </button>

            <button
              onClick={() => onViewManipulate(log.attacker_ip)}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/30 hover:shadow-emerald-600/40 border border-emerald-400/30 transition-all transform active:scale-95 cursor-pointer"
            >
              <Eye className="w-5 h-5" />
              <span>VIEW & MANIPULATE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
