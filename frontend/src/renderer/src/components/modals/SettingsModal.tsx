import React, { useState, useEffect } from 'react'
import { Sliders, X, Volume2, ShieldAlert, Save, AlertOctagon, HelpCircle, RefreshCw } from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  fontSize: string
  setFontSize: (val: string) => void
  windowScale: string
  setWindowScale: (val: string) => void
  systemAccessLevel: string
  setSystemAccessLevel: (val: string) => void
  customScopeFolder: string
  onBrowseCustomScopeFolder: () => void
  scanReportFolder: string
  onBrowseReportFolder: () => void
  onOpenDepWizard: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  fontSize,
  setFontSize,
  windowScale,
  setWindowScale,
  systemAccessLevel,
  setSystemAccessLevel,
  customScopeFolder,
  onBrowseCustomScopeFolder,
  scanReportFolder,
  onBrowseReportFolder,
  onOpenDepWizard
}) => {
  const [autoLockdown, setAutoLockdown] = useState<boolean>(() => {
    return localStorage.getItem('noash-auto-lockdown') !== 'false'
  })
  const [audioAlerts, setAudioAlerts] = useState<boolean>(() => {
    return localStorage.getItem('noash-audio-alerts') !== 'false'
  })
  const [editorAutoSave, setEditorAutoSave] = useState<boolean>(() => {
    return localStorage.getItem('noash-editor-autosave') === 'true'
  })
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'containment' | 'permissions' | 'help'>('general')

  const [systemRemediation, setSystemRemediation] = useState<boolean>(() => {
    return localStorage.getItem('noash-system-remediation') !== 'false'
  })
  const [moderateRiskPrompt, setModerateRiskPrompt] = useState<boolean>(() => {
    return localStorage.getItem('noash-moderate-risk-prompt') !== 'false'
  })

  useEffect(() => {
    localStorage.setItem('noash-auto-lockdown', autoLockdown.toString())
  }, [autoLockdown])

  useEffect(() => {
    localStorage.setItem('noash-audio-alerts', audioAlerts.toString())
  }, [audioAlerts])

  useEffect(() => {
    localStorage.setItem('noash-editor-autosave', editorAutoSave.toString())
  }, [editorAutoSave])

  useEffect(() => {
    localStorage.setItem('noash-system-remediation', systemRemediation.toString())
  }, [systemRemediation])

  useEffect(() => {
    localStorage.setItem('noash-moderate-risk-prompt', moderateRiskPrompt.toString())
  }, [moderateRiskPrompt])

  if (!isOpen) return null;

  return (

    <div
      onClick={() => onClose()}
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-2xl w-full bg-studio-panel border border-studio-border rounded-xl shadow-2xl overflow-hidden flex flex-col h-[480px]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#08080c] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#deb00d]/10 border border-[#deb00d]/30 flex items-center justify-center text-[#deb00d]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">VØID System Settings</h2>
              <p className="text-[10px] text-[#8b9094] font-mono">Configure local workspace security policies and UI scaling</p>
            </div>
          </div>
          <button
            onClick={() => onClose()}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#8b9094] hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body (Tab Layout) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-44 border-r border-white/10 p-3 space-y-1.5 shrink-0 bg-black/40">
            <button
              onClick={() => setActiveSettingsTab('general')}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-mono font-bold transition-all border ${activeSettingsTab === 'general'
                ? 'bg-[#deb00d] text-black border-[#deb00d] shadow-sm shadow-black/50'
                : 'bg-transparent border-transparent text-[#8b9094] hover:text-white hover:bg-white/5'
                }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveSettingsTab('containment')}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-mono font-bold transition-all border ${activeSettingsTab === 'containment'
                ? 'bg-[#deb00d] text-black border-[#deb00d] shadow-sm shadow-black/50'
                : 'bg-transparent border-transparent text-[#8b9094] hover:text-white hover:bg-white/5'
                }`}
            >
              Containment
            </button>
            <button
              onClick={() => setActiveSettingsTab('permissions')}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-mono font-bold transition-all border ${activeSettingsTab === 'permissions'
                ? 'bg-[#deb00d] text-black border-[#deb00d] shadow-sm shadow-black/50'
                : 'bg-transparent border-transparent text-[#8b9094] hover:text-white hover:bg-white/5'
                }`}
            >
              Permissions
            </button>
            <button
              onClick={() => setActiveSettingsTab('help')}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-mono font-bold transition-all border ${activeSettingsTab === 'help'
                ? 'bg-[#deb00d] text-black border-[#deb00d] shadow-sm shadow-black/50'
                : 'bg-transparent border-transparent text-[#8b9094] hover:text-white hover:bg-white/5'
                }`}
            >
              Instructions
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-5 overflow-y-auto min-w-0">
            {activeSettingsTab === 'permissions' && (
              <div className="space-y-5">
                {/* DEPENDENCY WIZARD TRIGGER BUTTON */}
                <div className="flex items-start justify-between bg-black/30 border border-studio-border p-3.5 rounded-lg">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2 text-studio-yellow">
                      <ShieldAlert className="w-4 h-4" />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wide">Security Dependency Wizard</h4>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                      Detect host OS CLI tools (Nmap, ClamAV, Lynis) or toggle built-in Light Mode.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose()
                      onOpenDepWizard()
                    }}
                    className="px-3 py-1.5 rounded font-mono text-xs font-bold uppercase border border-studio-yellow bg-studio-yellow/10 text-studio-yellow hover:bg-studio-yellow hover:text-black transition-all shrink-0"
                  >
                    Run Wizard
                  </button>
                </div>

                {/* GEMINI NETWORK INTEGRATION (DISABLED/LOCKED) */}
                <div className="flex items-start justify-between bg-black/30 border border-studio-border p-3.5 rounded-lg opacity-60">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2 text-zinc-400">
                      <HelpCircle className="w-4 h-4" />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wide text-zinc-300">Gemini Network Fetch</h4>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-sans">
                      Allow integrated Gemini models to fetch remote security configurations, signatures, and context logs.
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <button
                      disabled
                      className="px-2 py-1 rounded font-mono text-[9px] font-bold uppercase bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                    >
                      LOCKED
                    </button>
                    <span className="text-[8px] font-mono text-studio-yellow uppercase tracking-wider font-bold">Awaiting Integration</span>
                  </div>
                </div>

                {/* AUTO-REMEDIATION WRITE PERMISSION */}
                <div className="flex items-start justify-between bg-black/30 border border-studio-border p-3.5 rounded-lg">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2 text-studio-yellow">
                      <ShieldAlert className="w-4 h-4" />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wide">PC Write Remediation</h4>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                      Grant VOID native writing permissions to quarantine, fix, or purge high-risk threat binaries on this host PC.
                    </p>
                  </div>
                  <button
                    onClick={() => setSystemRemediation(prev => !prev)}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-bold uppercase border transition-all ${systemRemediation
                      ? 'border-emerald-700 bg-emerald-950/20 text-emerald-400'
                      : 'border-red-800 bg-red-950/20 text-red-400'
                      }`}
                  >
                    {systemRemediation ? 'GRANTED' : 'DENIED'}
                  </button>
                </div>

                {/* SYSTEM ACCESS LEVEL CONTROL */}
                <div className="space-y-2.5 bg-black/30 border border-studio-border p-3.5 rounded-lg">
                  <div className="flex items-center space-x-2 text-studio-yellow">
                    <Sliders className="w-4 h-4" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wide">System Access Level</h4>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                    Configure the directory depth and shell access limits granted to the security scanner.
                  </p>
                  <div className="flex space-x-1.5 pt-1">
                    {['storage', 'custom', 'full'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setSystemAccessLevel(level)}
                        className={`px-3.5 py-1.5 rounded font-mono text-[10px] font-bold uppercase border transition-all ${systemAccessLevel === level
                          ? 'border-studio-yellow bg-studio-yellowGlow text-studio-yellow font-bold'
                          : 'border-studio-border bg-black/40 text-zinc-400 hover:border-zinc-700 hover:text-white'
                          }`}
                      >
                        {level === 'storage' && 'Storage Only'}
                        {level === 'custom' && 'Custom Folder'}
                        {level === 'full' && 'Full System'}
                      </button>
                    ))}
                  </div>

                  {systemAccessLevel === 'custom' && (
                    <div className="space-y-2 pt-2.5 border-t border-studio-border/30 mt-2.5 animate-fadeIn">
                      <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-wide">Specify Sandboxed Audit Path</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          readOnly
                          value={customScopeFolder}
                          className="flex-1 px-3 py-1.5 bg-black border border-studio-border rounded text-xs font-mono text-zinc-300 min-w-0"
                        />
                        <button
                          onClick={onBrowseCustomScopeFolder}
                          className="px-3.5 py-1.5 bg-studio-yellow hover:bg-studio-yellowHover text-black rounded text-xs font-mono font-bold transition-all uppercase"
                        >
                          Browse
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* MODERATE RISK 10-MIN CONSENT PROMPT */}
                <div className="flex items-start justify-between bg-black/30 border border-studio-border p-3.5 rounded-lg">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2 text-studio-yellow">
                      <AlertOctagon className="w-4 h-4 animate-pulse" />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wide">10-Min Consent Prompts</h4>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                      Prompt a notification confirmation dialog every 10 minutes when moderate threat actions are pending on your host system.
                    </p>
                  </div>
                  <button
                    onClick={() => setModerateRiskPrompt(prev => !prev)}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-bold uppercase border transition-all ${moderateRiskPrompt
                      ? 'border-emerald-700 bg-emerald-950/20 text-emerald-400'
                      : 'border-red-800 bg-red-950/20 text-red-400'
                      }`}
                  >
                    {moderateRiskPrompt ? 'ACTIVE' : 'MUTED'}
                  </button>
                </div>

                {/* SCAN REPORT DIRECTORY SELECTOR */}
                <div className="space-y-2.5 bg-black/30 border border-studio-border p-3.5 rounded-lg">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-studio-yellow block">Vulnerability Scan Report Folder</label>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                    Choose the absolute folder path on this PC where generated security audit reports (JSON/PDF) will be written.
                  </p>
                  <div className="flex space-x-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={scanReportFolder}
                      className="flex-1 px-3 py-1.5 bg-black border border-studio-border rounded text-xs font-mono text-zinc-300 min-w-0"
                    />
                    <button
                      onClick={onBrowseReportFolder}
                      className="px-3.5 py-1.5 bg-studio-yellow hover:bg-studio-yellowHover text-black rounded text-xs font-mono font-bold transition-all uppercase"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSettingsTab === 'general' && (
              <div className="space-y-5">
                {/* SIZING & ZOOMS */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-studio-yellow block">Console Font Size</label>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">Sizing adjustments for editor terminals, chat logs, and audits.</p>
                  <div className="flex space-x-1.5 pt-1">
                    {['small', 'medium', 'large'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={`px-3 py-1.5 rounded font-mono text-xs uppercase border transition-all ${fontSize === size
                          ? 'border-studio-yellow bg-studio-yellowGlow text-studio-yellow font-bold'
                          : 'border-studio-border bg-black/40 text-zinc-400 hover:border-zinc-700 hover:text-white'
                          }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-studio-border"></div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-studio-yellow block">Workspace Scale</label>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">Scale interfaces to match high-resolution screens.</p>
                  <div className="flex space-x-1.5 pt-1">
                    {['80%', '100%', '120%'].map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setWindowScale(scale)}
                        className={`px-3 py-1.5 rounded font-mono text-xs border transition-all ${windowScale === scale
                          ? 'border-studio-yellow bg-studio-yellowGlow text-studio-yellow font-bold'
                          : 'border-studio-border bg-black/40 text-zinc-400 hover:border-zinc-700 hover:text-white'
                          }`}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-studio-border"></div>

                {/* DESTRUCTIVE RESET */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-500 block">Workspace Cleanup</label>
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all local credentials, saved layouts, and safety consents?')) {
                        localStorage.clear()
                        window.location.reload()
                      }
                    }}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-red-950/30 border border-red-800/40 hover:bg-red-900/35 text-red-400 rounded text-xs font-mono font-bold transition-all uppercase"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset System Configurations</span>
                  </button>
                </div>
              </div>
            )}

            {activeSettingsTab === 'containment' && (
              <div className="space-y-5">
                {/* AUTO-LOCKDOWN TOGGLE */}
                <div className="flex items-start justify-between bg-black/30 border border-studio-border p-3.5 rounded-lg">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2 text-studio-yellow">
                      <ShieldAlert className="w-4 h-4 animate-pulse" />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wide">Threat Auto-Lockdown</h4>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                      Lock down navigation headers and sidebar controls instantly when High-Risk scanner anomalies are found.
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoLockdown(prev => !prev)}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-bold uppercase border transition-all ${autoLockdown
                      ? 'border-emerald-700 bg-emerald-950/20 text-emerald-400'
                      : 'border-red-800 bg-red-950/20 text-red-400'
                      }`}
                  >
                    {autoLockdown ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {/* AUDIO WARNINGS TOGGLE */}
                <div className="flex items-start justify-between bg-black/30 border border-studio-border p-3.5 rounded-lg">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2 text-studio-yellow">
                      <Volume2 className="w-4 h-4" />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wide">Scanner Audio Feedback</h4>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                      Emit auditory alert sounds upon scanner initialization, threat logs, and containment release triggers.
                    </p>
                  </div>
                  <button
                    onClick={() => setAudioAlerts(prev => !prev)}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-bold uppercase border transition-all ${audioAlerts
                      ? 'border-emerald-700 bg-emerald-950/20 text-emerald-400'
                      : 'border-red-800 bg-red-950/20 text-red-400'
                      }`}
                  >
                    {audioAlerts ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* EDITOR AUTO-SAVE TOGGLE */}
                <div className="flex items-start justify-between bg-black/30 border border-studio-border p-3.5 rounded-lg">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2 text-studio-yellow">
                      <Save className="w-4 h-4" />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wide">Monaco Auto-Save Buffer</h4>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                      Enable automatic local file writing buffers every 10 seconds inside Yjs peer editor workspaces.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditorAutoSave(prev => !prev)}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-bold uppercase border transition-all ${editorAutoSave
                      ? 'border-emerald-700 bg-emerald-950/20 text-emerald-400'
                      : 'border-red-800 bg-red-950/20 text-red-400'
                      }`}
                  >
                    {editorAutoSave ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            )}

            {activeSettingsTab === 'help' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-studio-yellow pb-1 border-b border-studio-border">
                  <HelpCircle className="w-4 h-4" />
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white font-sans">Workstation FAQ</h4>
                </div>

                <div className="space-y-3 font-sans">
                  <div className="space-y-1 bg-black/25 p-3 rounded border border-studio-border">
                    <span className="text-xs font-bold text-zinc-200">What is active lockdown?</span>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      It isolates the desktop process workspace from tab switching until active threat scanner flags are resolved or remediated.
                    </p>
                  </div>

                  <div className="space-y-1 bg-black/25 p-3 rounded border border-studio-border">
                    <span className="text-xs font-bold text-zinc-200">How to configure lumen?</span>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      Swap prompts or assistant profile configurations inside the AI chat console modules to toggle secure code personas.
                    </p>
                  </div>

                  <div className="space-y-1 bg-black/25 p-3 rounded border border-studio-border">
                    <span className="text-xs font-bold text-zinc-200">Is code stored in any database?</span>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      No. Code operations, shell terminal logs, and scanner records are processed inside sandboxed local memory buffers.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

  )
}
