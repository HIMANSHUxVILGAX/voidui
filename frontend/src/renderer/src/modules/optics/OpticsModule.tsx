import React, { useState, useEffect } from 'react'
import ThreatMap, { resolveLatLon } from './ThreatMap'

import { AttackerTerminal } from './AttackerTerminal'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Globe,
  Cpu,
  Trash2,
  Eye,
  Lock,
  Server,
  FileCode,
  Database,
  Key,
  Activity,
  X,
  Zap,
  Clock,
  Monitor,
  MapPin
} from 'lucide-react'

export interface OpticsModuleProps {
  activeMod: string
}
export type ElumPotModuleProps = OpticsModuleProps

export interface IntrusionLog {
  id: string
  timestamp: string
  attackerIp: string
  location: string
  service: string
  type: 'auth_attempt' | 'command_exec' | 'file_access' | 'port_probe' | 'emergency_block'
  plainEnglishSummary: string
  rawPayload: string
  status: 'active' | 'blocked' | 'monitored'
  countryCode: string
  lat?: number
  lon?: number
}

export interface WebRequestTrace {
  id: string
  timestamp: string
  clientApp: string
  clientIp: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  requestedPath: string
  statusCode: number
  statusText: string
  decoyAction: string
  responseMs: number
}

export interface DecoyVaultItem {
  id: string
  filename: string
  fileType: string
  accessedByIp: string
  timestamp: string
  aiGenerator: string
  contentPreview: string
}

const API_BASE = 'http://127.0.0.1:8000/api'

// React Error Boundary to protect dashboard from any map crashes
class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ThreatMap error caught by boundary:', error, errorInfo)
  }
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-[350px] w-full bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400 font-mono text-xs">
          <Globe className="w-8 h-8 text-amber-400 animate-pulse" />
          <span>Interactive Threat Map Initializing...</span>
        </div>
      )
    }
    return this.props.children
  }
}

export const OpticsModule: React.FC<OpticsModuleProps> = ({ activeMod }) => {
  const [daemonActive, setDaemonActive] = useState<boolean>(true)
  const [livePorts, setLivePorts] = useState<{ ssh: number; web: number }>({ ssh: 2222, web: 8080 })
  const [activeTab, setActiveTab] = useState<'all' | 'ssh' | 'web' | 'vault'>('all')
  const [simulating, setSimulating] = useState<boolean>(false)
  const [selectedVaultItem, setSelectedVaultItem] = useState<DecoyVaultItem | null>(null)
  const [blockedIps, setBlockedIps] = useState<string[]>([])

  const [selectedPinIp, setSelectedPinIp] = useState<string | null>(null)

  // Live Auto-Synchronized Time State (IST & World UTC)
  const [timeState, setTimeState] = useState<{ istTime: string; utcTime: string }>({
    istTime: '',
    utcTime: ''
  })

  // Web Decoy HTTP Request-Response Trace Stream State
  const [webTraces, setWebTraces] = useState<WebRequestTrace[]>([])

  // Intrusion Logs (Plain-English Format)
  const [logs, setLogs] = useState<IntrusionLog[]>([])

  // Gemini AI Synthetic Decoy Vault Items
  const [decoyVault, setDecoyVault] = useState<DecoyVaultItem[]>([])

  // Live Auto-Synchronized Time Ticker (IST & World UTC)
  useEffect(() => {
    const updateClocks = (): void => {
      try {
        const now = new Date()
        const istFormatted = now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
        const utcFormatted = now.toISOString().slice(11, 19)

        setTimeState({
          istTime: istFormatted,
          utcTime: utcFormatted
        })
      } catch {
        const now = new Date()
        setTimeState({
          istTime: now.toLocaleTimeString(),
          utcTime: now.toUTCString()
        })
      }
    }

    updateClocks()
    const timer = setInterval(updateClocks, 1000)
    return () => clearInterval(timer)
  }, [])

  // OPTIMIZED CONSOLIDATED SINGLE-FETCH POLLING HOOK (1500ms interval for ultra-low CPU load)
  useEffect(() => {
    let isMounted = true

    const fetchLiveData = async (): Promise<void> => {
      try {
        const summary = await fetch(`${API_BASE}/honeypot/dashboard-summary`)
          .then((r) => r.json())
          .catch(() => null)
        if (!isMounted || !summary || summary.status !== 'success') return

        setDaemonActive(summary.daemon_active)
        setLivePorts({
          ssh: summary.ssh_port || 2222,
          web: summary.web_port || 8080
        })

        if (Array.isArray(summary.logs)) {
          const mappedLogs: IntrusionLog[] = summary.logs.map((item: Record<string, unknown>) => ({
            id: (item?.id as string) || `log-${Math.random()}`,
            timestamp: (item?.timestamp as string) || new Date().toISOString(),
            attackerIp: (item?.attacker_ip as string) || '127.0.0.1',
            location: (item?.location as string) || 'Local Network',
            countryCode: (item?.country_code as string) || 'LOCAL',
            lat: (item?.lat as number) ?? 0,
            lon: (item?.lon as number) ?? 0,
            service: (item?.service as string) || 'Web Decoy (Port 8080)',
            type: (item?.type as 'ssh_login' | 'web_probe' | 'file_access' | 'command_exec') || 'file_access',
            plainEnglishSummary:
              (item?.plain_english_summary as string) || 'Suspicious network probe detected.',
            rawPayload: (item?.raw_payload as string) || 'GET / HTTP/1.1',
            status: (item?.status as 'active' | 'monitored' | 'blocked') || 'active'
          }))
          setLogs(mappedLogs)
        }

        if (Array.isArray(summary.traces)) {
          const mappedTraces: WebRequestTrace[] = summary.traces.map((item: Record<string, unknown>) => ({
            id: (item?.id as string) || `trace-${Math.random()}`,
            timestamp: (item?.timestamp as string) || 'Just now',
            clientApp: (item?.client_app as string) || 'Unknown Client',
            clientIp: (item?.client_ip as string) || '127.0.0.1',
            method: (item?.method as string) || 'GET',
            requestedPath: (item?.requested_path as string) || '/',
            statusCode: (item?.status_code as number) || 200,
            statusText: (item?.status_text as string) || '200 OK',
            decoyAction: (item?.decoy_action as string) || 'Served Dynamic AI Synthetic Decoy',
            responseMs: (item?.response_ms as number) || 10
          }))
          setWebTraces(mappedTraces)
        }

        if (Array.isArray(summary.decoys)) {
          const mappedDecoys: DecoyVaultItem[] = summary.decoys.map((item: Record<string, unknown>, idx: number) => {
            const filePath = (item.file_path as string) || ''
            return {
              id: `decoy-${idx}-${filePath}`,
              filename: filePath,
              fileType: filePath.endsWith('.json')
                ? 'JSON Config'
                : filePath.endsWith('.sql')
                  ? 'SQL Backup'
                  : 'Document',
              accessedByIp: (item.ip as string) || '127.0.0.1',
              timestamp: (item.created_at as string) || 'Just now',
              aiGenerator: 'Google Gemini 2.5 Flash',
              contentPreview: (item.content as string) || ''
            }
          })
          setDecoyVault(mappedDecoys)
        }
      } catch {
        // Backend not available or temporary poll error
      }
    }

    fetchLiveData()
    const pollInterval = setInterval(fetchLiveData, 1500) // Optimized 1.5s poll interval
    return () => {
      isMounted = false
      clearInterval(pollInterval)
    }
  }, [])

  if (activeMod !== 'bento' && activeMod !== 'optics' && activeMod !== 'elum') return null

  // Toggle Honeypot Daemon
  const handleToggleDaemon = async (): Promise<void> => {
    const targetEndpoint = daemonActive ? '/honeypot/stop' : '/honeypot/start'
    try {
      const res = await fetch(`${API_BASE}${targetEndpoint}`, { method: 'POST' }).then((r) =>
        r.json()
      )
      if (res.status === 'success' || res.status === 'already_running') {
        setDaemonActive(!daemonActive)
      }
    } catch {
      setDaemonActive(!daemonActive)
    }
  }

  // Trigger Simulated Attack Demo via Backend API
  const handleSimulateAttack = async (): Promise<void> => {
    setSimulating(true)
    fetch(`${API_BASE}/honeypot/simulate-attack`, { method: 'POST' }).catch(() => { })
    setTimeout(() => {
      setSimulating(false)
    }, 400)
  }

  // Execute Real Firewall IP Block via Backend API
  const handleBlockIp = async (ip: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE}/honeypot/block-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      })
      if (!response.ok) return
    } catch {
      return
    }

    setBlockedIps((prev) => (prev.includes(ip) ? prev : [...prev, ip]))
    setLogs((prev) =>
      prev.map((item) => (item.attackerIp === ip ? { ...item, status: 'blocked' } : item))
    )
  }

  // Release the held socket into the isolated virtual mirror / decoy environment.
  const handleViewManipulate = async (ip: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE}/honeypot/allow-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      })
      if (!response.ok) return
    } catch {
      return
    }

    setLogs((prev) =>
      prev.map((item) =>
        item.attackerIp === ip && item.status === 'active' ? { ...item, status: 'monitored' } : item
      )
    )
  }

  const handleClearLogs = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/honeypot/logs`, { method: 'DELETE' })
    } catch {
      // Ignored
    }
    setLogs([])
    setWebTraces([])
    setDecoyVault([])
    setBlockedIps([])
  }

  const filteredLogs = (logs || []).filter((log) => {
    if (!log || !log.service) return false
    if (activeTab === 'ssh') return log.service.includes('SSH')
    if (activeTab === 'web') return log.service.includes('Web')
    return true
  })

  // DYNAMIC 1-TO-1 MAP RED PINS: Exactly 1 Red Dot per unique IP in active `logs` (No extra fake dots!)
  const uniqueAttackerLogsMap: { [ip: string]: IntrusionLog } = {}
  for (const log of logs || []) {
    if (log && log.attackerIp && !uniqueAttackerLogsMap[log.attackerIp]) {
      uniqueAttackerLogsMap[log.attackerIp] = log
    }
  }
  const activeAttackerLogs = Object.values(uniqueAttackerLogsMap)

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-200 h-full w-full overflow-y-auto relative select-none">
      {/* BACKGROUND DECORATIVE GRID */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>

      {/* TOP HEADER TOOLBAR */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 z-10 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 shadow-sm shadow-amber-500/20">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-wider text-slate-100 font-mono">optics</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40">
                Module 4
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Active Deception Engine & Sandboxed Traps Framework
            </p>
          </div>
        </div>

        {/* Status Badges & Controls */}
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          {/* Always-On Status Toggle */}
          <button
            onClick={handleToggleDaemon}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${daemonActive
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-900/50'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${daemonActive ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                }`}
            ></span>
            <span>{daemonActive ? 'Daemon: Active' : 'Daemon: Stopped'}</span>
          </button>

          {/* Port Indicators — Dynamically bound from backend status */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-300">
            <Server className="w-3.5 h-3.5 text-amber-400" />
            <span>
              SSH: <strong className="text-amber-300">{livePorts.ssh}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              WEB: <strong className="text-amber-300">{livePorts.web}</strong>
            </span>
          </div>

          {/* Live Synchronized Clocks (IST / Regional & World UTC) */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <div className="flex items-center space-x-2">
              <span
                className="text-emerald-400 font-bold"
                title="Indian Standard Time (Asia/Kolkata)"
              >
                {timeState.istTime || 'Syncing...'} IST
              </span>
              <span className="text-slate-600">|</span>
              <span
                className="text-cyan-300 font-medium"
                title="Universal Coordinated Time (World Standard)"
              >
                {timeState.utcTime || 'Syncing...'} UTC
              </span>
            </div>
          </div>

          {/* 1-Click Demo Simulator Button */}
          <button
            onClick={handleSimulateAttack}
            disabled={simulating}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold shadow-md shadow-amber-900/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
            <span>{simulating ? 'Simulating Attack...' : 'Trigger Simulated Attack'}</span>
          </button>

          {/* Clear Logs */}
          <button
            onClick={handleClearLogs}
            title="Clear Feed Logs"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* METRICS QUICK CARDS BAR */}
      <section className="px-6 py-3 bg-slate-900/40 border-b border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 z-10">
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Intrusions</p>
            <p className="text-xl font-bold text-slate-100 font-mono mt-0.5">{logs.length}</p>
          </div>
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Honeypot Ports</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">2 Ports</p>
          </div>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Probed Web Requests</p>
            <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">
              {webTraces.length} Requests
            </p>
          </div>
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Monitor className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Decoy Files Served</p>
            <p className="text-xl font-bold text-cyan-400 font-mono mt-0.5">
              {decoyVault.length} Decoys
            </p>
          </div>
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <FileCode className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* MAIN TWO-COLUMN DASHBOARD CONTENT */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden z-10">
        {/* LEFT COLUMN: HTTP Request Trace Inspector, Geolocation Threat Map & AI Decoy Vault (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto pr-1">
          {/* DETAILED HTTP REQUEST & RESPONSE STATUS INSPECTOR TRACE STREAM */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Monitor className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Probed Web Requests (Live)
                </h2>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                Port 8080 Listener
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Real-time browser / client app request reporting with HTTP return status codes:
            </p>

            {/* List of HTTP Request Traces */}
            <div className="flex flex-col gap-2.5 max-h-[170px] overflow-y-auto pr-1">
              {webTraces.map((trace) => {
                const is200 = trace.statusCode === 200
                const is403 = trace.statusCode === 403
                const is401 = trace.statusCode === 401

                return (
                  <div
                    key={trace.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 flex flex-col gap-1.5"
                  >
                    {/* Header line: Client App + Status Code Badge */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 truncate">
                        <Monitor className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-semibold text-slate-200 truncate">
                          {trace.clientApp}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${is200
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : is403
                              ? 'bg-rose-950 text-rose-400 border-rose-800'
                              : is401
                                ? 'bg-purple-950 text-purple-400 border-purple-800'
                                : 'bg-amber-950 text-amber-400 border-amber-800'
                          }`}
                      >
                        {trace.statusText}
                      </span>
                    </div>

                    {/* Request Path Line */}
                    <div className="flex items-center space-x-2 text-[11px] font-mono bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span className="text-amber-400 font-bold">{trace.method}</span>
                      <span className="text-slate-200 truncate">{trace.requestedPath}</span>
                    </div>

                    {/* Decoy Action + Latency Footer */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="text-slate-300 italic truncate">{trace.decoyAction}</span>
                      <span className="font-mono text-slate-400 flex-shrink-0">
                        {trace.responseMs}ms
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* REAL INTERACTIVE WORLD MAP (LEAFLET + DARK TILES) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Attacker Live Location Map
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-rose-400 font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">
                  <MapPin className="w-3 h-3 inline-block mr-1" />
                  {activeAttackerLogs.length} Live Pins
                </span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  Scroll to Zoom • Drag to Pan
                </span>
              </div>
            </div>

            {/* LEAFLET MAP CONTAINER WITH CLEAN SLATE DESIGN */}
            <MapErrorBoundary>
              <ThreatMap
                pins={activeAttackerLogs.map((log) => {
                  let lat = typeof log.lat === 'number' && !isNaN(log.lat) ? log.lat : 0
                  let lon = typeof log.lon === 'number' && !isNaN(log.lon) ? log.lon : 0
                  if (lat === 0 && lon === 0) {
                    const c = resolveLatLon(log.attackerIp, log.location)
                    lat = c.lat
                    lon = c.lon
                  }
                  return {
                    ip: log.attackerIp,
                    location: log.location,
                    countryCode: log.countryCode,
                    service: log.service,
                    summary: log.plainEnglishSummary,
                    lat,
                    lon
                  }
                })}
              />
            </MapErrorBoundary>

            {/* SELECTED PIN INTRUSION CARD DRAWER */}
            {selectedPinIp && (
              <div className="p-3 bg-slate-950 rounded-lg border border-rose-500/50 text-xs flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-rose-400 font-mono">
                      Attacker IP: {selectedPinIp}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-300 mt-0.5">
                    {(logs || []).find((l) => l?.attackerIp === selectedPinIp)
                      ?.plainEnglishSummary || 'Active intruder trapped in sandbox.'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPinIp(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* GEMINI AI SYNTHETIC DECOY VAULT */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 flex-1 min-h-[170px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Gemini AI Synthetic Decoy Vault
                </h2>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                Gemini 2.5 Flash
              </span>
            </div>

            <p className="text-xs text-slate-400">
              When intruders attempt file downloads or data exfiltration, Gemini AI dynamically
              generates safe, synthetic fake files to mislead attackers.
            </p>

            {/* Decoy File Items List */}
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[150px] pr-1">
              {decoyVault.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedVaultItem(item)}
                  className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="p-1.5 rounded bg-slate-900 text-cyan-400 group-hover:text-cyan-300">
                      {item.filename.endsWith('.sql') ? (
                        <Database className="w-4 h-4" />
                      ) : item.filename.endsWith('.env') ? (
                        <Key className="w-4 h-4" />
                      ) : (
                        <FileCode className="w-4 h-4" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-mono text-slate-200 font-semibold truncate">
                        {item.filename}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Requested by:{' '}
                        <span className="font-mono text-slate-300">{item.accessedByIp}</span>
                      </p>
                    </div>
                  </div>
                  <button className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-800/60">
                    <Eye className="w-3 h-3" />
                    <span>Inspect</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Keystroke Terminal & Plain-English Log Feed (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6 overflow-y-auto pr-1">
          {/* LIVE ATTACKER KEYSTROKE TERMINAL VIEWER */}
          <AttackerTerminal apiBase={API_BASE} />

          {/* PLAIN-ENGLISH LOG FEED CARD CONTAINER */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 overflow-hidden">
            {/* Feed Header & Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Intrusion History & Commands Log
                </h2>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-md transition-all font-mono ${activeTab === 'all'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  All ({logs.length})
                </button>
                <button
                  onClick={() => setActiveTab('ssh')}
                  className={`px-2.5 py-1 rounded-md transition-all font-mono ${activeTab === 'ssh'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  SSH (2222)
                </button>
                <button
                  onClick={() => setActiveTab('web')}
                  className={`px-2.5 py-1 rounded-md transition-all font-mono ${activeTab === 'web'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Web (8080)
                </button>
              </div>
            </div>

            {/* Log Cards List Container */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
              {filteredLogs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                  <ShieldCheck className="w-10 h-10 text-slate-400 mb-2" />
                  <p className="text-sm font-medium">No intrusions logged in this category</p>
                  <p className="text-xs text-slate-400">
                    Continuous monitoring on ports 2222 & 8080 is active.
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isBlocked = blockedIps.includes(log.attackerIp) || log.status === 'blocked'

                  return (
                    <div
                      key={log.id}
                      className={`p-4 rounded-xl border transition-all ${isBlocked
                          ? 'bg-rose-950/20 border-rose-900/40 opacity-75'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                    >
                      {/* Log Card Header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${log.service.includes('SSH')
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              }`}
                          >
                            {log.service}
                          </span>
                          <span className="text-xs font-mono text-slate-100 font-bold">
                            {log.attackerIp}
                          </span>
                          <span className="text-[11px] text-slate-400 font-sans">
                            ({log.location})
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {log.timestamp}
                        </span>
                      </div>

                      {/* Plain-English Human Readable Summary */}
                      <p className="text-xs text-slate-200 font-medium mb-3 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                        {log.plainEnglishSummary}
                      </p>

                      {/* Card Footer: Raw Payload Snippet + Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                        <code className="text-[10px] font-mono text-slate-400 truncate max-w-[280px]">
                          {log.rawPayload}
                        </code>

                        <div className="flex items-center space-x-2">
                          {isBlocked ? (
                            <span className="flex items-center space-x-1 text-[11px] text-rose-400 font-mono bg-rose-950/60 px-2.5 py-1 rounded border border-rose-800">
                              <Lock className="w-3 h-3" />
                              <span>IP Firewall Blocked</span>
                            </span>
                          ) : log.status === 'monitored' ? (
                            <span className="flex items-center space-x-1 text-[11px] text-amber-300 font-mono bg-amber-950/60 px-2.5 py-1 rounded border border-amber-800">
                              <Eye className="w-3 h-3 text-amber-400" />
                              <span>AI Decoy Monitored</span>
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleViewManipulate(log.attackerIp)}
                                className="flex items-center space-x-1 text-[11px] font-semibold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 px-2.5 py-1 rounded transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                <span>VIEW & MANIPULATE</span>
                              </button>
                              <button
                                onClick={() => handleBlockIp(log.attackerIp)}
                                className="flex items-center space-x-1 text-[11px] font-semibold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 px-2.5 py-1 rounded transition-colors"
                              >
                                <Shield className="w-3 h-3" />
                                <span>SECURE & BLOCK</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* INSPECTOR MODAL: GEMINI AI DECOY FILE PREVIEW */}
      {selectedVaultItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileCode className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    {selectedVaultItem.filename}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Generated by {selectedVaultItem.aiGenerator}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVaultItem(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Target Intruder IP:{' '}
                <strong className="font-mono text-amber-300">
                  {selectedVaultItem.accessedByIp}
                </strong>
              </p>
              <p>
                Generated At:{' '}
                <span className="font-mono text-slate-400">{selectedVaultItem.timestamp}</span>
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 overflow-x-auto max-h-56">
              <pre>{selectedVaultItem.contentPreview}</pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedVaultItem(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const ElumPotModule = OpticsModule
