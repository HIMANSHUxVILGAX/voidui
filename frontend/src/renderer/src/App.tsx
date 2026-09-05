import React, { useState, useEffect } from 'react'
import { Header } from './components/layout/Header'
import { WorkstationNav } from './components/layout/WorkstationNav'
import { LandingModule } from './modules/landing/LandingModule'
import { AshCodeModule } from './modules/ash-code/AshCodeModule'
import { SuperForgeModule } from './modules/super-forge/SuperForgeModule'
import { AvangerModule } from './modules/avanger/AvangerModule'
import { ElumPotModule } from './modules/elum-pot/ElumPotModule'
import { AshFinderModule } from './modules/ash-finder/AshFinderModule'
import { CommandPalette } from './components/modals/CommandPalette'
import { DependencySetupModal } from './components/modals/DependencySetupModal'
import { GlobalIntrusionModal, GlobalIntrusionLog } from './components/modals/GlobalIntrusionModal'
import { ShieldAlert } from 'lucide-react'
import { SettingsModal } from './components/modals/SettingsModal'

function App(): React.JSX.Element {
  const [activeMod, setActiveMod] = useState<string>('front')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false)
  const [lockdown, setLockdown] = useState<boolean>(false)
  const [showConsent, setShowConsent] = useState<boolean>(() => {
    return !localStorage.getItem('noash-sec-consent')
  })

  // Synchronize lockdown state with Electron main process
  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('set-lockdown', lockdown)
    }
  }, [lockdown])

  // Global Settings Modal States
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('noash-font-size') || 'medium'
  })
  const [windowScale, setWindowScale] = useState<string>(() => {
    return localStorage.getItem('noash-window-scale') || '100%'
  })

  const [scanReportFolder, setScanReportFolder] = useState<string>(() => {
    return localStorage.getItem('noash-scan-report-folder') || ''
  })

  const [systemAccessLevel, setSystemAccessLevel] = useState<string>(() => {
    return localStorage.getItem('noash-system-access-level') || 'storage'
  })
  const [customScopeFolder, setCustomScopeFolder] = useState<string>(() => {
    return localStorage.getItem('noash-custom-scope-folder') || ''
  })

  // Security Dependency Setup Wizard State
  const [showDepWizard, setShowDepWizard] = useState<boolean>(false)
  const [toolsStatus, setToolsStatus] = useState<{ nmap: boolean; clamav: boolean; lynis: boolean } | null>(null)
  const [toolsPlatform, setToolsPlatform] = useState<string>('Linux')

  const checkToolsStatus = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/system/check-tools')
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'success') {
          setToolsStatus(data.tools)
          setToolsPlatform(data.platform || 'Linux')
          if (data.show_wizard) {
            setShowDepWizard(true)
          }
        }
      }
    } catch (err) {
      console.log('Tools check check-tools offline:', err)
    }
  }

  useEffect(() => {
    checkToolsStatus()
  }, [])

  // --- SYSTEM-WIDE GLOBAL INTRUSION ALERT HOOK & AUDIO SYNTHESIZER ---
  const [globalAlertLog, setGlobalAlertLog] = useState<GlobalIntrusionLog | null>(null)
  const seenAlertIdsRef = React.useRef<Set<string>>(new Set())
  const monitoredIpsRef = React.useRef<Set<string>>(new Set())

  useEffect(() => {
    let isMounted = true

    // Single funnel for both the main-process push and the renderer poll. Dedup is
    // shared via seenAlertIdsRef so a given intrusion only raises the alert once.
    const handleActiveLog = (activeLog: GlobalIntrusionLog | null | undefined): void => {
      if (!activeLog || !activeLog.id) return
      const ip = activeLog.attacker_ip || (activeLog as any).attackerIp || ''
      if (seenAlertIdsRef.current.has(activeLog.id)) return
      if (ip && monitoredIpsRef.current.has(ip) && activeLog.type !== 'emergency_block') return

      seenAlertIdsRef.current.add(activeLog.id)
      if (!isMounted) return

      setGlobalAlertLog(activeLog)

      // Audio Warning Tone Synthesizer (HTML5 Web Audio API)
      try {
        if (localStorage.getItem('noash-audio-alerts') !== 'false') {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
          if (AudioContextClass) {
            const ctx = new AudioContextClass()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sawtooth'
            osc.frequency.setValueAtTime(520, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25)
            gain.gain.setValueAtTime(0.15, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.25)
          }
        }
      } catch (e) {
        // audio context blocked by browser policy until interaction
      }
    }

    // PRIMARY trigger: main-process push. Fires even when the window is closed-to-tray,
    // minimized, or sitting behind other apps (renderer timers are throttled there).
    if (window.api?.onIntrusionAlert) {
      window.api.onIntrusionAlert((log) => handleActiveLog(log as GlobalIntrusionLog))
    }

    // FALLBACK trigger: renderer poll — retained for dev mode and extra resiliency.
    const pollHoneypotLogs = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/honeypot/logs')
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'success' && Array.isArray(data.logs)) {
            if (data.logs.length === 0) {
              seenAlertIdsRef.current.clear()
              monitoredIpsRef.current.clear()
            }
            const activeLog = data.logs.find(
              (l: GlobalIntrusionLog) => l.status === 'active'
            )
            handleActiveLog(activeLog)
          }
        }
      } catch {
        // silent catch
      }
    }

    const interval = setInterval(pollHoneypotLogs, 500)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const handleGlobalSecureBlock = async (ip: string) => {
    try {
      await fetch('http://127.0.0.1:8000/api/honeypot/block-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      })
    } catch (err) {
      console.error('Error blocking IP:', err)
    } finally {
      setGlobalAlertLog(null)
    }
  }

  const handleGlobalViewManipulate = async (ip: string) => {
    if (ip) monitoredIpsRef.current.add(ip)
    try {
      await fetch('http://127.0.0.1:8000/api/honeypot/allow-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      })
    } catch (err) {
      console.error('Error allowing IP:', err)
    } finally {
      setActiveMod('bento') // Automatically switch tab to elumPot Deception Control Room!
      setGlobalAlertLog(null)
    }
  }

    // Native Windows notification actions return through the main process.
  // Route them through the same handlers as the in-app global intrusion modal.
  useEffect(() => {
    window.api?.onIntrusionAction?.(({ action, ip }) => {
      if (action === 'block') {
        void handleGlobalSecureBlock(ip)
      } else if (action === 'view') {
        if (ip) monitoredIpsRef.current.add(ip)
        void handleGlobalViewManipulate(ip)
      }
    })
  }, [])

  const handleSelectLightMode = () => {

    localStorage.setItem('noash-light-mode-selected', 'true')
    setShowDepWizard(false)
  }

  // Dynamically resolve system home path on mount
  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer
        .invoke('get-user-home')
        .then((userHome: string) => {
          if (userHome) {
            const separator = userHome.includes('\\') ? '\\' : '/'
            if (!localStorage.getItem('noash-scan-report-folder')) {
              setScanReportFolder(`${userHome}${separator}Desktop${separator}NoAsh${separator}reports`)
            }
            if (!localStorage.getItem('noash-custom-scope-folder')) {
              setCustomScopeFolder(`${userHome}${separator}Desktop${separator}NoAsh`)
            }
          }
        })
        .catch((err: unknown) => {
          console.error('Failed to resolve home directory:', err)
        })
    }
  }, [])

  // Apply font-size configuration dynamically to html tag to scale REM sizes
  useEffect(() => {
    const docHtml = document.documentElement
    if (fontSize === 'small') {
      docHtml.style.fontSize = '14px'
    } else if (fontSize === 'large') {
      docHtml.style.fontSize = '18px'
    } else {
      docHtml.style.fontSize = '16px' // default medium
    }
    localStorage.setItem('noash-font-size', fontSize)
  }, [fontSize])

  // Reset documentElement zoom on mount to clean up old scaling code and force black bg
  useEffect(() => {
    document.documentElement.style.zoom = '1.0'
    document.documentElement.style.backgroundColor = '#050507'
    document.body.style.backgroundColor = '#050507'
  }, [])

  // Save window scaling to localStorage
  useEffect(() => {
    localStorage.setItem('noash-window-scale', windowScale)
  }, [windowScale])






  useEffect(() => {
    localStorage.setItem('noash-scan-report-folder', scanReportFolder)
  }, [scanReportFolder])

  useEffect(() => {
    localStorage.setItem('noash-system-access-level', systemAccessLevel)
  }, [systemAccessLevel])

  useEffect(() => {
    localStorage.setItem('noash-custom-scope-folder', customScopeFolder)
  }, [customScopeFolder])

  const handleBrowseCustomScopeFolder = async () => {
    if (window.electron?.ipcRenderer) {
      try {
        const path = await window.electron.ipcRenderer.invoke('select-directory')
        if (path) {
          setCustomScopeFolder(path)
        }
      } catch (err) {
        console.error('Failed to select directory:', err)
      }
    } else {
      alert('Directory selector is only available in native Electron application mode.')
    }
  }

  const handleBrowseFolder = async () => {
    if (window.electron?.ipcRenderer) {
      try {
        const path = await window.electron.ipcRenderer.invoke('select-directory')
        if (path) {
          setScanReportFolder(path)
        }
      } catch (err) {
        console.error('Failed to select directory:', err)
      }
    } else {
      alert('Directory selector is only available in native Electron application mode.')
    }
  }

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (lockdown) return // Disable shortcuts in lockdown mode

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [lockdown])

  const handleAcceptConsent = (): void => {
    localStorage.setItem('noash-sec-consent', 'true')
    setShowConsent(false)
  }

  const getContainerStyle = () => {
    if (windowScale === '80%') {
      return {
        transform: 'scale(0.85)',
        transformOrigin: 'top left',
        width: '117.65vw',
        height: '117.65vh',
      }
    }
    if (windowScale === '120%') {
      return {
        transform: 'scale(1.15)',
        transformOrigin: 'top left',
        width: '86.95vw',
        height: '86.95vh',
      }
    }
    return {
      transform: 'none',
      width: '100vw',
      height: '100vh',
    }
  }

  return (
    <div 
      style={getContainerStyle()}
      className="h-screen w-screen flex flex-col overflow-hidden bg-studio-bg text-white font-sans antialiased select-none"
    >
        {/* ----------------- FIRST TIME SEC PROTECT CONSENT MODAL ----------------- */}
        {showConsent && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-[#0c0c10] border border-[#c89b3c]/50 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_25px_rgba(200,155,60,0.2)] font-mono text-[#e8e4dc] space-y-5">
              <div className="flex items-center space-x-3 text-[#c89b3c] border-b border-white/10 pb-3">
                <div className="w-8 h-8 rounded-xl bg-[#c89b3c]/10 border border-[#c89b3c]/30 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-[#c89b3c]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-wider uppercase font-display text-white">VØID Security Protocol</h2>
                  <span className="text-[10px] text-[#8b9094] font-mono">ZERO-TRUST AIR-GAP RUNTIME</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-[#8b9094] font-sans">
                Welcome to <strong className="text-white">VØID Studio Workspace</strong>. To protect your host environment from malicious binaries and memory corruption, this system includes the <strong className="text-[#c89b3c]">Avanger Threat Defense & Sandbox Protocol</strong>.
              </p>

              <div className="bg-black/50 border border-white/10 p-3.5 rounded-xl text-[11px] leading-relaxed space-y-2 font-sans">
                <span className="font-bold text-white block font-mono text-[10px] uppercase text-[#c89b3c]">SECURITY ASSURANCES:</span>
                <ul className="list-disc list-inside space-y-1.5 text-[#8b9094]">
                  <li>Automated real-time AST audits and kernel memory isolation.</li>
                  <li>
                    <span className="text-[#c89b3c] font-semibold">Zero-Trust Lockdown:</span> When severe anomalies are detected, the workspace isolates the offending process until resolved.
                  </li>
                </ul>
              </div>

              <button
                onClick={handleAcceptConsent}
                className="w-full py-3 bg-[#c89b3c] hover:bg-white text-black font-bold text-xs tracking-widest rounded-xl transition-all uppercase shadow-lg hover:scale-[1.02]"
              >
                Authorize & Enter VØID Studio
              </button>
            </div>
          </div>
        )}

        {/* Master Custom Window Titlebar */}
        {!lockdown && (
          <Header
            activeMod={activeMod}
            onSwitchModule={setActiveMod}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Activity Sidebar Navigation */}
          {!lockdown && (
            <WorkstationNav
              activeMod={activeMod}
              onSwitchModule={setActiveMod}
              onToggleCommandPalette={() => setCommandPaletteOpen(true)}
            />
          )}

          {/* Workstation Stage (Contains Modules 1 to 5 - Stabs) */}
          <main
            id="workstation-stage"
            className={`${
              activeMod === 'front' && !lockdown ? 'hidden' : 'flex'
            } flex-1 bg-black flex-col min-w-0 overflow-hidden relative`}
          >
            {/* Module 1: ashCode */}
            {(!lockdown && (activeMod === 'nodes' || activeMod === 'code')) && <AshCodeModule activeMod={activeMod} />}

            {/* Module 2: SuperForge Config Console */}
            {(!lockdown && (activeMod === 'ide' || activeMod === 'forge')) && <SuperForgeModule activeMod={activeMod} />}

            {/* Module 3: Avanger Scanner Lockdown */}
            {(activeMod === 'timeline' || lockdown) && (
              <AvangerModule
                activeMod={activeMod}
                lockdown={lockdown}
                setLockdown={setLockdown}
                systemAccessLevel={systemAccessLevel}
                setSystemAccessLevel={setSystemAccessLevel}
                customScopeFolder={customScopeFolder}
                setCustomScopeFolder={setCustomScopeFolder}
              />
            )}

            {/* Module 4: elumPot Deception System */}
            {(!lockdown && (activeMod === 'bento' || activeMod === 'elum')) && <ElumPotModule activeMod={activeMod} />}

            {/* Module 5: AshFinder Career Roadmap */}
            {(!lockdown && activeMod === 'settings') && <AshFinderModule activeMod={activeMod} />}
          </main>

          {/* Front / Landing Page View */}
          {(!lockdown && activeMod === 'front') && (
            <LandingModule
              activeMod={activeMod}
              onSwitchModule={setActiveMod}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
        </div>

        {/* Command Palette Modal */}
        {!lockdown && (
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onSwitchModule={setActiveMod}
          />
        )}

        {/* Global Workstation Settings Overlay Modal */}
      <SettingsModal 
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fontSize={fontSize}
        setFontSize={setFontSize}
        windowScale={windowScale}
        setWindowScale={setWindowScale}
        systemAccessLevel={systemAccessLevel}
        setSystemAccessLevel={setSystemAccessLevel}
        customScopeFolder={customScopeFolder}
        onBrowseCustomScopeFolder={handleBrowseCustomScopeFolder}
        scanReportFolder={scanReportFolder}
        onBrowseReportFolder={handleBrowseFolder}
        onOpenDepWizard={() => setShowDepWizard(true)}
      />

      {/* Security Dependency Setup Wizard Modal */}
        <DependencySetupModal
          isOpen={showDepWizard}
          toolsStatus={toolsStatus}
          platform={toolsPlatform}
          onClose={() => setShowDepWizard(false)}
          onSelectLightMode={handleSelectLightMode}
          onRecheck={checkToolsStatus}
        />

        {/* System-Wide Global Intrusion Alert Overlay Modal */}
        <GlobalIntrusionModal
          log={globalAlertLog}
          onSecureBlock={handleGlobalSecureBlock}
          onViewManipulate={handleGlobalViewManipulate}
        />
      </div>
  )
}

export default App
