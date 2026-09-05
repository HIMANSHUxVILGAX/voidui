import React, { useState } from 'react'
import { ShieldAlert, CheckCircle2, XCircle, Terminal, Zap, RefreshCw, X, Copy, Check, AlertTriangle } from 'lucide-react'

interface ToolsStatus {
  nmap: boolean
  clamav: boolean
  lynis: boolean
}

interface DependencySetupModalProps {
  isOpen: boolean
  toolsStatus: ToolsStatus | null
  platform: string
  onClose: () => void
  onSelectLightMode: () => void
  onRecheck: () => void
}

export const DependencySetupModal: React.FC<DependencySetupModalProps> = ({
  isOpen,
  toolsStatus,
  platform,
  onClose,
  onSelectLightMode,
  onRecheck
}) => {
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false)
  const isWindows = platform.toLowerCase().includes('win')

  if (!isOpen) return null

  const linuxInstallCmd = 'sudo apt update && sudo apt install -y nmap clamav lynis'
  const windowsInstallCmd = 'winget install Insecure.Nmap'

  const activeCmd = isWindows ? windowsInstallCmd : linuxInstallCmd

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(activeCmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  const isBackendOffline = toolsStatus === null
  const nmapInstalled = toolsStatus?.nmap ?? false
  const clamavInstalled = toolsStatus?.clamav ?? false
  const lynisInstalled = toolsStatus?.lynis ?? false

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="max-w-xl w-full bg-zinc-900 border border-studio-yellow/40 rounded-xl shadow-2xl overflow-hidden font-mono flex flex-col text-zinc-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-black/50">
          <div className="flex items-center space-x-3 text-studio-yellow">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                Security Dependencies Setup
              </h2>
              <p className="text-[10px] text-zinc-400 font-sans">
                Host OS Security Tools Detection ({platform})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs">
          {isBackendOffline ? (
            <div className="bg-red-950/30 border border-red-500/40 p-4 rounded-lg space-y-2.5 text-zinc-300">
              <div className="flex items-center space-x-2 font-bold text-red-400 text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Backend Service Offline</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                Could not connect to Python FastAPI service at <code className="text-studio-yellow">http://127.0.0.1:8000</code>. Please start the backend service in your terminal to detect installed tools:
              </p>
              <code className="block bg-black px-3 py-2 rounded text-[11px] text-studio-yellow font-mono border border-zinc-800 select-all">
                cd backend && uvicorn app.main:app --reload --port 8000
              </code>
            </div>
          ) : (
            <>
              <p className="text-zinc-400 font-sans leading-relaxed">
                NO-ASH can run real CLI security tools on your host machine or fall back to native
                built-in Python tools. Here is your current environment status:
              </p>

              {/* Tools Status List */}
              <div className="space-y-2 bg-black/50 border border-zinc-800 p-4 rounded-lg">
                {/* Nmap */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Terminal className="w-4 h-4 text-zinc-400" />
                    <span className="font-bold text-white">Nmap Port Scanner</span>
                  </div>
                  {nmapInstalled ? (
                    <div className="flex items-center space-x-1 text-emerald-400 text-[11px] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>INSTALLED</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-amber-400 text-[11px] font-bold">
                      <XCircle className="w-4 h-4" />
                      <span>NOT DETECTED</span>
                    </div>
                  )}
                </div>

                {/* ClamAV */}
                <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2">
                  <div className="flex items-center space-x-2.5">
                    <Terminal className="w-4 h-4 text-zinc-400" />
                    <span className="font-bold text-white">ClamAV Antivirus Scanner</span>
                  </div>
                  {clamavInstalled ? (
                    <div className="flex items-center space-x-1 text-emerald-400 text-[11px] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>INSTALLED</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-amber-400 text-[11px] font-bold">
                      <XCircle className="w-4 h-4" />
                      <span>NOT DETECTED</span>
                    </div>
                  )}
                </div>

                {/* Lynis / Windows Security Auditor */}
                <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2">
                  <div className="flex items-center space-x-2.5">
                    <Terminal className="w-4 h-4 text-zinc-400" />
                    <span className="font-bold text-white">{isWindows ? 'System Security Auditor' : 'Lynis Auditor'}</span>
                  </div>
                  {isWindows ? (
                    <div className="flex items-center space-x-1 text-emerald-400 text-[11px] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>WINDOWS NATIVE</span>
                    </div>
                  ) : lynisInstalled ? (
                    <div className="flex items-center space-x-1 text-emerald-400 text-[11px] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>INSTALLED</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-amber-400 text-[11px] font-bold">
                      <XCircle className="w-4 h-4" />
                      <span>NOT DETECTED</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Installation Instructions Box */}
              {(!nmapInstalled || !clamavInstalled || (!lynisInstalled && !isWindows)) && (
                <div className="bg-amber-950/20 border border-amber-500/30 p-3.5 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-amber-400 text-[11px] font-bold">
                    <span>INSTALLATION COMMAND ({platform.toUpperCase()}):</span>
                    <button
                      onClick={handleCopyCmd}
                      className="flex items-center space-x-1 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition-all text-amber-300"
                    >
                      {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                  <code className="block bg-black px-3 py-2 rounded text-[11px] text-zinc-300 font-mono overflow-x-auto border border-zinc-800">
                    {activeCmd}
                  </code>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={onSelectLightMode}
              className="w-full sm:flex-1 py-2.5 bg-studio-yellow hover:bg-studio-yellowHover text-black font-bold text-xs tracking-wider rounded transition-all uppercase flex items-center justify-center space-x-2 shadow-lg shadow-studio-yellowGlow"
            >
              <Zap className="w-4 h-4" />
              <span>Continue in Built-in Light Mode</span>
            </button>

            <button
              onClick={onRecheck}
              className="w-full sm:w-auto px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs tracking-wider rounded transition-all flex items-center justify-center space-x-1.5 border border-zinc-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-check Connection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
