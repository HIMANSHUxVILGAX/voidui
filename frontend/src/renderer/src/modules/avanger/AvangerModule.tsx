import React, { useState, useEffect, useRef, useMemo } from 'react'

import { Play, ShieldCheck, Terminal, Lock, Unlock, RefreshCw, AlertTriangle, Check, Copy, AlertCircle } from 'lucide-react'

interface Finding {
  id: number | string
  tool: string
  severity: string
  issue: string
  fix: string
  details?: {
    file_path?: string
    process_pid?: number
    port?: string
    service?: string
    [key: string]: unknown
  }
}

interface AvangerModuleProps {
  activeMod: string
  lockdown: boolean
  setLockdown: (val: boolean) => void
  systemAccessLevel?: string
  setSystemAccessLevel?: (val: string) => void
  customScopeFolder?: string
  setCustomScopeFolder?: (val: string) => void
}

interface ChatMessage {
  sender: 'user' | 'ai'
  text: string
}

interface AiReportData {
  title?: string
  status?: string
  summary?: string
  report_text?: string
}

// Module-level constant (Prevents TDZ ReferenceError on mount)
const API_BASE = 'http://127.0.0.1:8000/api'

export const AvangerModule: React.FC<AvangerModuleProps> = ({
  activeMod,
  lockdown,
  setLockdown,
  systemAccessLevel,
  setSystemAccessLevel,
  customScopeFolder,
  setCustomScopeFolder
}) => {
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [findings, setFindings] = useState<Finding[]>([])
  const [lockdownChecklist, setLockdownChecklist] = useState({
    killMalicious: false,
    deleteInfected: false
  })
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'NO-ASH Avanger Secure Shell v1.0.0',
    'Type "help" to see available commands.'
  ])
  const terminalInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (lockdown) {
      setTimeout(() => {
        terminalInputRef.current?.focus()
      }, 100)
    }
  }, [lockdown])
  const [copiedId, setCopiedId] = useState<number | string | null>(null)
  const [audioMuted, setAudioMuted] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // SuperForge Chat State inside Lockdown
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: 'Hello! I am SuperForge. I see your system is locked down due to high-risk malware. I have full read access to the scanner logs. How can I help you remediate this threat?'
    }
  ])

  const [aiReport, setAiReport] = useState<AiReportData | null>(null)
  const [showNagModal, setShowNagModal] = useState<boolean>(false)
  const [deletedFiles, setDeletedFiles] = useState<string[]>([])
  const [scannedLogs, setScannedLogs] = useState<Array<{ file_path: string; status: string; signature: string | null }>>([])
  const [totalScanned, setTotalScanned] = useState<number>(0)
  const consoleEndRef = useRef<HTMLDivElement>(null)
  const consoleContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState<boolean>(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Track manual user scrolling in live console box: pause auto-scroll if user scrolls up
  const handleConsoleScroll = (): void => {
    if (consoleContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = consoleContainerRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 60
      setUserScrolledUp(!isAtBottom)
    }
  }

  // Scope & Custom Path derived from App props (Single Source of Truth)
  const scanScope = (systemAccessLevel as 'full' | 'storage' | 'custom') || 'full'
  const customPath = customScopeFolder !== undefined ? customScopeFolder : ''

  const handleUpdateScope = (newScope: 'full' | 'storage' | 'custom'): void => {
    if (setSystemAccessLevel) {
      setSystemAccessLevel(newScope)
    }
    localStorage.setItem('noash-system-access-level', newScope)
  }

  const handleUpdateCustomPath = (newPath: string): void => {
    if (setCustomScopeFolder) {
      setCustomScopeFolder(newPath)
    }
    localStorage.setItem('noash-custom-scope-folder', newPath)
  }

  const handleBrowseFolder = async (): Promise<void> => {
    try {
      const selected = await window.electron?.ipcRenderer?.invoke('select-directory')
      if (selected) {
        handleUpdateCustomPath(selected)
      }
    } catch (e) {
      console.error('Browse directory error:', e)
    }
  }

  const clickCountRef = useRef<number>(0)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Auto-scroll the green box terminal console to the bottom as new lines print
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [])

  // Bi-directional sync: when user changes scope on Avanger page, update Settings localStorage
  useEffect(() => {
    localStorage.setItem('noash-system-access-level', scanScope)
  }, [scanScope])

  useEffect(() => {
    if (customPath) {
      localStorage.setItem('noash-custom-scope-folder', customPath)
    }
  }, [customPath])

  // Auto-scroll ONLY if user has not manually scrolled up to inspect previous logs
  useEffect(() => {
    if (scanning && !userScrolledUp) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [scannedLogs, scanning, userScrolledUp])

  const [sysMetrics, setSysMetrics] = useState({
    cpu: 24,
    ram: 58,
    networkConnected: true,
    networkSpeed: '100% Stable | 1.2 GB/s'
  })

  // Poll real OS Task Manager stats every 2 seconds continuously
  useEffect(() => {
    const fetchMetrics = async (): Promise<void> => {
      try {
        const res = await fetch(`${API_BASE}/system/metrics`)
        const data = await res.json()
        if (data.status === 'success') {
          setSysMetrics({
            cpu: data.cpu,
            ram: data.ram,
            networkConnected: data.network_connected,
            networkSpeed: data.network_speed
          })
        }
      } catch {
        // keep previous state
      }
    }
    fetchMetrics()
    const timer = setInterval(fetchMetrics, 2000)
    return () => clearInterval(timer)
  }, [])

  // Audio Warning Sound Simulation Loop on High Risk Lockdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const isAudioEnabled = localStorage.getItem('noash-audio-alerts') !== 'false'
    if (lockdown && !audioMuted && isAudioEnabled) {
      const playBeep = (): void => {
        try {
          const audioCtx = new (
            window.AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          )()
          const osc = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(440, audioCtx.currentTime) // A4 note
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime)
          osc.connect(gain)
          gain.connect(audioCtx.destination)
          osc.start()
          osc.stop(audioCtx.currentTime + 0.3)
        } catch (e) {
          console.log('Audio Context error: ', e)
        }
      }

      playBeep() // Initial beep
      interval = setInterval(playBeep, 10000) // Beep every 10 seconds
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [lockdown, audioMuted])

  // 10-Minute Nag Timer for Moderate Risk Items
  useEffect(() => {
    let nagTimer: ReturnType<typeof setInterval> | null = null
    const hasMedium = findings.some((f) => f.severity.toLowerCase() === 'medium')
    const isNagEnabled = localStorage.getItem('noash-moderate-risk-prompt') !== 'false'

    if (hasMedium && isNagEnabled) {
      nagTimer = setInterval(() => {
        setShowNagModal(true)
      }, 600000) // Re-prompts every 10 minutes
    }

    return () => {
      if (nagTimer) clearInterval(nagTimer)
    }
  }, [findings])

  const startPollingStatus = (): void => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`${API_BASE}/scanner/status`)
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          if (statusData.progress) {
            setProgress(statusData.progress)
          }
          if (statusData.scanned_files) {
            setScannedLogs(statusData.scanned_files)
          }
          if (statusData.total_scanned != null) {
            setTotalScanned(statusData.total_scanned)
          }

          if (statusData.status === 'completed') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
            setProgress(100)
            setFindings(statusData.findings || [])
            setScanning(false)

            // Fetch AI / Fallback Report
            try {
              const reportRes = await fetch(`${API_BASE}/scanner/report`)
              if (reportRes.ok) {
                const reportData = await reportRes.json()
                setAiReport(reportData)

                // Save report file to target directory path
                const exportDir = localStorage.getItem('noash-scan-report-folder') || 'reports'
                try {
                  await fetch(`${API_BASE}/scanner/save-report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      report: reportData,
                      directory: exportDir
                    })
                  })
                } catch (sErr) {
                  console.error('Failed to save report to disk:', sErr)
                }
              }
            } catch (rErr) {
              console.error('Report Fetch Error:', rErr)
            }

            // Trigger lockdown if there is a High Severity item
            const hasHighRisk = statusData.findings?.some(
              (f: Finding) => f.severity.toLowerCase() === 'high'
            )
            if (hasHighRisk) {
              setLockdown(true)
              setLockdownChecklist({ killMalicious: false, deleteInfected: false })
            }
          } else if (statusData.status !== 'scanning') {
            setScanning(false)
          }
        }
      } catch (pollErr) {
        console.error('Poll status error:', pollErr)
      }
    }, 1000)
  }

  // Resume active scan state on mount (Fixes Bug #5 tab-switch state loss)
  useEffect(() => {
    const checkActiveScan = async (): Promise<void> => {
      try {
        const res = await fetch(`${API_BASE}/scanner/status`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'scanning') {
            setScanning(true)
            if (data.progress) setProgress(data.progress)
            if (data.scanned_files) setScannedLogs(data.scanned_files)
            startPollingStatus()
          } else if (data.status === 'completed' && data.scanned_files?.length > 0) {
            setScannedLogs(data.scanned_files)
            setFindings(data.findings || [])
          }
        }
      } catch {
        // Backend not reachable yet
      }
    }
    checkActiveScan()
  }, [])

  // Cancel running scan
  const handleCancelScan = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/scanner/cancel`, { method: 'POST' })
    } catch (e) {
      console.error('Cancel scan error:', e)
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    setScanning(false)
    setProgress(0)
  }

  // Triple-click scan button handler (Bug #4 Fix)
  // 3 clicks within 500ms while scanning = cancel; single click when idle = start scan
  const handleScanBtnClick = (): void => {
    if (!scanning) {
      handleStartScan()
      return
    }
    clickCountRef.current += 1
    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }
      handleCancelScan()
      return
    }
    if (!clickTimerRef.current) {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0
        clickTimerRef.current = null
      }, 500)
    }
  }

  // Trigger Vulnerability Scan with selected scope
  const handleStartScan = async (): Promise<void> => {
    setScanning(true)
    setUserScrolledUp(false)
    setProgress(5)
    setFindings([])
    setScannedLogs([])
    setLockdown(false)
    setConnectionError(null)
    setAiReport(null)

    try {
      const startRes = await fetch(`${API_BASE}/scanner/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: '127.0.0.1',
          scope: scanScope,
          custom_path: scanScope === 'custom' ? customPath : null
        })
      })
      if (!startRes.ok) {
        throw new Error(`HTTP Error: ${startRes.status}`)
      }
      const startData = await startRes.json()
      console.log('Scan Started:', startData)

      startPollingStatus()
    } catch (err) {
      console.error('Scan Error:', err)
      setConnectionError(
        `Could not connect to backend server at ${API_BASE}. Make sure uvicorn is running! ${(err as Error).message || err}`
      )
      setScanning(false)
    }
  }

  // Extract dynamic High Risk item details (memoized to avoid recalc on every render)
  const highRiskItems = useMemo(() => findings.filter((f) => f.severity.toLowerCase() === 'high'), [findings])
  const highRiskFiles = useMemo(() => Array.from(new Set(highRiskItems.map((f) => f.details?.file_path).filter(Boolean))) as string[], [highRiskItems])
  const highRiskPid = useMemo(() => highRiskItems.find((f) => f.details?.process_pid)?.details?.process_pid || null, [highRiskItems])

  // Copy to clipboard helper for Low Risk card
  const handleCopy = (text: string, id: number | string): void => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Terminal Console command execution simulation
  const handleTerminalSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const rawInput = terminalInput.trim()
    if (!rawInput) return

    const lowerCmd = rawInput.toLowerCase()
    const isRmCmd = rawInput.startsWith('rm ')
    const rmArg = isRmCmd ? rawInput.substring(3).trim() : ''

    let response = ''
    if (lowerCmd === 'help') {
      response =
        'Available Commands:\n - ps : Lists running processes\n - kill <pid> : Kills a process\n - rm <file_path> : Removes a file\n - status : Checks lockdown checklist\n - help : Shows this menu'
    } else if (lowerCmd === 'ps') {
      try {
        const procRes = await fetch(`${API_BASE}/scanner/processes`)
        const procData = await procRes.json()
        if (procData.status === 'success') {
          response = `REAL OS PROCESSES (Top Active):\n${procData.processes}`
        } else {
          response = `ERROR: Failed to fetch processes: ${procData.message}`
        }
      } catch {
        response = `ERROR: Could not connect to system process manager.`
      }
    } else if (lowerCmd.startsWith('kill ')) {
      const targetPidStr = rawInput.substring(5).trim()
      try {
        const res = await fetch(`${API_BASE}/scanner/remediate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'kill', target: targetPidStr })
        })
        const data = await res.json()
        if (data.status === 'success') {
          setLockdownChecklist((prev) => ({ ...prev, killMalicious: true }))
          response = `SUCCESS: Process ${targetPidStr} terminated.`
        } else {
          response = `ERROR: ${data.message}`
        }
      } catch (e) {
        response = `ERROR: Failed to execute kill command: ${(e as Error).message || e}`
      }
    } else if (isRmCmd && rmArg) {
      let cleanTarget = rmArg.trim()
      if (cleanTarget.startsWith('-f ')) cleanTarget = cleanTarget.substring(3).trim()
      else if (cleanTarget.startsWith('-rf ')) cleanTarget = cleanTarget.substring(4).trim()
      else if (cleanTarget.startsWith('-r ')) cleanTarget = cleanTarget.substring(3).trim()
      cleanTarget = cleanTarget.replace(/^['"]|['"]$/g, '').trim()

      try {
        const res = await fetch(`${API_BASE}/scanner/remediate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rm', target: cleanTarget })
        })
        const data = await res.json()
        if (data.status === 'success') {
          setDeletedFiles((prev) => Array.from(new Set([...prev, cleanTarget, rmArg])))
          response = `SUCCESS: File '${cleanTarget}' deleted from system disk.`
        } else {
          response = `ERROR: ${data.message || 'No such file or directory.'}`
        }
      } catch (e) {
        console.error('Remediate rm error:', e)
        response = `ERROR: Failed to execute deletion command for '${cleanTarget}'.`
      }
    } else if (lowerCmd === 'status') {
      response = `CHECKLIST STATUS:\n - Process Killed: ${!highRiskPid || lockdownChecklist.killMalicious ? 'DONE' : 'PENDING'}\n - Files Removed (${deletedFiles.length}/${highRiskFiles.length}): ${deletedFiles.length >= highRiskFiles.length ? 'DONE' : 'PENDING'}`
    } else {
      response = `Command not found: "${rawInput}". Type "help" for a list of commands.`
    }

    setTerminalLogs((prev) => [...prev, `> ${terminalInput}`, response, ''])
    setTerminalInput('')
  }

  const [isAiLoading, setIsAiLoading] = useState(false)
  const [refusalCount, setRefusalCount] = useState<number>(0)

  // AI chat submission handler - Connected to real backend SuperForge API with Strict Scope Boundary
  const handleAiSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const query = aiInput.trim()
    if (!query || isAiLoading) return

    const newMessages: ChatMessage[] = [...aiMessages, { sender: 'user', text: query }]
    setAiMessages(newMessages)
    setAiInput('')
    setIsAiLoading(true)

    // Check for out-of-scope queries (coding, programming, non-security modules)
    const lowerQuery = query.toLowerCase()
    const isOutOfScope =
      lowerQuery.includes('code') ||
      lowerQuery.includes('coding') ||
      lowerQuery.includes('program') ||
      lowerQuery.includes('ashcode') ||
      lowerQuery.includes('elumpot') ||
      lowerQuery.includes('ashfinder') ||
      lowerQuery.includes('javascript') ||
      lowerQuery.includes('python') ||
      lowerQuery.includes('react') ||
      lowerQuery.includes('html') ||
      lowerQuery.includes('css') ||
      lowerQuery.includes('function') ||
      lowerQuery.includes('write code') ||
      lowerQuery.includes('build app')

    if (isOutOfScope) {
      let reply = ''
      if (refusalCount === 0) {
        reply = 'me isme help nahi kr skta, ye mera kaam nahi'
        setRefusalCount(1)
      } else {
        reply = 'app jitna bhi jesa puch le me isme help nahi kr skta'
        setRefusalCount((prev) => prev + 1)
      }
      setTimeout(() => {
        setAiMessages((prev) => [...prev, { sender: 'ai', text: reply }])
        setIsAiLoading(false)
      }, 300)
      return
    }

    try {
      const remainingInfectedFiles = highRiskFiles.filter((f) => !deletedFiles.includes(f))
      const contextMessage = `[System Context: Total Flagged Infected Files: ${highRiskFiles.join(', ') || 'None'} | User Successfully Deleted Files: ${deletedFiles.join(', ') || 'None'} | Remaining Active Threats: ${remainingInfectedFiles.join(', ') || 'NONE (All infected files deleted)'} | High Risk Process PID: ${highRiskPid || 'None'} | Process Terminated: ${lockdownChecklist.killMalicious} | Lockdown Active: ${lockdown}]\n\nUser Question: ${query}`

      const res = await fetch(`${API_BASE}/superforge/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contextMessage,
          persona: 'security_consultant',
          provider: 'auto'
        })
      })

      if (res.ok) {
        const data = await res.json()
        setAiMessages((prev) => [...prev, { sender: 'ai', text: data.text || 'No response generated.' }])
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setAiMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Could not connect to SuperForge backend (${errMsg}). Ensure backend server is running on port 8000!`
        }
      ])
    } finally {
      setIsAiLoading(false)
    }
  }

  // Confirm threat is removed and unlock app
  const handleUnlockCheck = async (): Promise<void> => {
    const processResolved = !highRiskPid || lockdownChecklist.killMalicious
    const allFilesDeleted = highRiskFiles.length === 0 || highRiskFiles.every((f) => deletedFiles.includes(f))

    if (processResolved && allFilesDeleted) {
      setLockdown(false)
      setFindings((prev) => prev.filter((f) => f.severity.toLowerCase() !== 'high'))
    } else {
      const msg = !processResolved
        ? `OS Verification Failed: Please terminate process PID ${highRiskPid}!`
        : `OS Verification Failed: Please delete all flagged infected files!`
      alert(msg)
    }
  }

  if (activeMod !== 'timeline' && !lockdown) return null

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 font-mono text-zinc-300 h-full w-full relative p-6 overflow-y-auto">
      {/* ----------------- LOCKDOWN FULLSCREEN SCREENPLAY ----------------- */}
      {lockdown && (
        <div className="fixed inset-0 z-[9999] pointer-events-auto bg-black flex flex-col p-6 animate-fade-in">
          {/* Top Banner Alert */}
          <div className="bg-red-950 border border-red-500 rounded p-4 mb-5 flex justify-between items-center animate-pulse shrink-0">
            <div className="flex items-center space-x-3 text-red-500">
              <Lock className="w-5 h-5" />
              <div className="ml-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-widest">AVANGER LOCKDOWN MODE</h2>
                <p className="text-sm text-red-400 font-medium">
                  High severity vulnerabilities must be fixed to unlock application access.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className="px-3.5 py-1.5 bg-red-900/40 hover:bg-red-900 border border-red-500/30 text-red-400 rounded text-xs sm:text-sm font-semibold transition-all"
            >
              {audioMuted ? 'Unmute Audio Alert' : 'Mute Audio Alert'}
            </button>
          </div>

          {/* Split Screen Dashboard (Three Columns: Checklist, Console, SuperForge) */}
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
            {/* Column 1: Left Hand Checklist */}
            <div className="w-full md:w-1/4 bg-zinc-900 border border-red-500/20 rounded p-4 flex flex-col shrink-0">
              <h3 className="text-sm font-bold text-zinc-300 border-b border-zinc-800 pb-2.5 mb-3 uppercase tracking-wider">
                Remediation Checklist
              </h3>
              <div className="space-y-4 flex-1 overflow-y-auto">
                {/* Step 1: Kill Process (ONLY IF A MALICIOUS PROCESS WAS FLAGGED) */}
                {highRiskPid && (
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border text-xs font-bold ${lockdownChecklist.killMalicious ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}
                    >
                      {lockdownChecklist.killMalicious ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        '1'
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Kill Process</h4>
                      <p className="text-xs text-zinc-400 leading-normal">
                        Terminate process (PID {highRiskPid}).
                      </p>
                    </div>
                  </div>
                )}

                {/* Dynamic Multi-File Step 2..N */}
                {highRiskFiles.map((fPath, idx) => {
                  const isDeleted = deletedFiles.includes(fPath)
                  const stepNumber = highRiskPid ? idx + 2 : idx + 1
                  return (
                    <div key={fPath} className="flex items-start space-x-3">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border text-xs font-bold ${isDeleted ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'border-zinc-700 text-zinc-500'}`}
                      >
                        {isDeleted ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          `${stepNumber}`
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-bold text-white">Delete File #{idx + 1}</h4>
                        <p className="text-xs text-zinc-300 leading-relaxed break-all font-mono">
                          `rm {fPath}`
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Unlock Action Button */}
              <button
                onClick={handleUnlockCheck}
                disabled={!((!highRiskPid || lockdownChecklist.killMalicious) && (highRiskFiles.length === 0 || highRiskFiles.every((f) => deletedFiles.includes(f))))}
                className={`w-full py-3 font-bold rounded text-center tracking-wider text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 border mt-2 ${
                  (!highRiskPid || lockdownChecklist.killMalicious) && (highRiskFiles.length === 0 || highRiskFiles.every((f) => deletedFiles.includes(f)))
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-black border-emerald-400 cursor-pointer'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                }`}
              >
                {(!highRiskPid || lockdownChecklist.killMalicious) && (highRiskFiles.length === 0 || highRiskFiles.every((f) => deletedFiles.includes(f))) ? (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span className="ml-1">UNLOCK WORKSPACE</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span className="ml-1">LOCKED</span>
                  </>
                )}
              </button>
            </div>

            {/* Column 2: Middle Elevated Console */}
            <div className="flex-1 bg-black border border-zinc-800 rounded flex flex-col min-h-0 font-mono">
              <div className="bg-zinc-900 border-b border-zinc-800 px-3.5 py-2 flex items-center justify-between text-xs text-zinc-300">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-red-500" />
                  <span className="font-bold text-red-500">Elevated SecOps Admin Shell</span>
                </div>
                <span className="text-zinc-500">user@noash-sandbox:~$</span>
              </div>

              {/* Logs output */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-1.5 text-xs sm:text-sm select-text">
                {terminalLogs.map((log, i) => (
                  <pre key={i} className="whitespace-pre-wrap leading-relaxed text-zinc-200">
                    {log}
                  </pre>
                ))}
              </div>

              {/* Input console */}
              <form
                onSubmit={handleTerminalSubmit}
                className="border-t border-zinc-800 bg-zinc-950 p-2 flex items-center"
              >
                <span className="text-sm text-red-500 font-bold mr-2 shrink-0">#</span>
                <input
                  ref={terminalInputRef}
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-mono"
                  placeholder="Type cmd (ps, rm <file_path>)..."
                  autoFocus
                />
              </form>
            </div>

            {/* Column 3: Right SuperForge AI Assistant */}
            <div className="w-full md:w-1/3 bg-zinc-900 border border-studio-yellow/20 rounded flex flex-col min-h-0 font-mono">
              <div className="bg-zinc-950 border-b border-zinc-800 px-3.5 py-2 flex items-center justify-between text-xs text-studio-yellow">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-studio-yellow animate-pulse shrink-0"></span>
                  <span className="font-bold">SuperForge Security Advisor</span>
                </div>
                <span className="text-zinc-500 text-[11px]">AI ASSISTANT</span>
              </div>

              {/* Messages feed */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs sm:text-sm select-text font-sans">
                {aiMessages.map((msg, i) => {
                  const isAi = msg.sender === 'ai'
                  return (
                    <div
                      key={i}
                      className={`flex flex-col space-y-1 ${isAi ? 'items-start' : 'items-end'}`}
                    >
                      <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
                        {isAi ? 'SuperForge' : 'User'}
                      </span>
                      <div
                        className={`p-3 rounded-lg max-w-[92%] leading-relaxed ${
                          isAi
                            ? 'bg-zinc-950 text-studio-yellow border border-studio-yellow/20'
                            : 'bg-studio-yellow text-black font-bold'
                        }`}
                      >
                        {msg.text.split('\n').map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {isAiLoading && (
                  <div className="flex flex-col items-start space-y-1">
                    <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">SuperForge</span>
                    <div className="p-3 bg-zinc-950 text-studio-yellow border border-studio-yellow/30 rounded text-xs sm:text-sm animate-pulse font-mono">
                      Analyzing threat & generating security response...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form
                onSubmit={handleAiSubmit}
                className="border-t border-zinc-800 bg-zinc-950 p-2.5 flex items-center"
              >
                <input
                  type="text"
                  value={aiInput}
                  disabled={isAiLoading}
                  onChange={(e) => setAiInput(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-mono px-1 disabled:opacity-50"
                  placeholder={isAiLoading ? 'SuperForge is processing...' : "Ask SuperForge (e.g. 'how to kill process')..."}
                />
                <button
                  type="submit"
                  disabled={isAiLoading}
                  className="ml-2 px-3.5 py-1.5 bg-studio-yellow hover:bg-studio-yellowHover text-black text-xs font-bold rounded disabled:opacity-50"
                >
                  {isAiLoading ? '...' : 'ASK'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- STANDARD AVANGER SCREEN VIEW ----------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-white">AVANGER SCANNER</h1>
          <p className="text-xs text-zinc-500">
            System vulnerability audit & threat verification scanner
          </p>

          {/* Scan Scope Options UI (Bug #6 Fix) */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            <span className="text-zinc-400 font-bold mr-1">Target Scope:</span>
            <button
              onClick={() => handleUpdateScope('full')}
              disabled={scanning}
              className={`px-3 py-1 rounded border text-[11px] font-bold transition-all ${
                scanScope === 'full'
                  ? 'bg-studio-yellow/20 border-studio-yellow text-studio-yellow'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Full System
            </button>
            <button
              onClick={() => handleUpdateScope('storage')}
              disabled={scanning}
              className={`px-3 py-1 rounded border text-[11px] font-bold transition-all ${
                scanScope === 'storage'
                  ? 'bg-studio-yellow/20 border-studio-yellow text-studio-yellow'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Storage Drives
            </button>
            <button
              onClick={() => handleUpdateScope('custom')}
              disabled={scanning}
              className={`px-3 py-1 rounded border text-[11px] font-bold transition-all ${
                scanScope === 'custom'
                  ? 'bg-studio-yellow/20 border-studio-yellow text-studio-yellow'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Custom Folder
            </button>

            {scanScope === 'custom' && (
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => handleUpdateCustomPath(e.target.value)}
                  disabled={scanning}
                  placeholder="Enter folder path (e.g. /tmp or C:\MyFolder)..."
                  className="bg-zinc-900 border border-zinc-700 text-white text-[11px] px-2.5 py-1 rounded outline-none font-mono min-w-[240px]"
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  disabled={scanning}
                  className="px-2.5 py-1 bg-studio-yellow hover:bg-studio-yellowHover text-black rounded font-mono font-bold text-[10px] uppercase transition-all"
                >
                  Browse
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scan & Cancel Control Buttons (Bug #4 Fix) */}
        <div className="flex items-center space-x-2">
          {scanning && (
            <button
              onClick={handleCancelScan}
              className="px-3 py-2 bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-400 rounded font-bold text-xs tracking-wider transition-all"
              title="Click to cancel active scan immediately"
            >
              CANCEL SCAN
            </button>
          )}

          <button
            onClick={handleScanBtnClick}
            className={`flex items-center space-x-2 px-4 py-2 rounded font-bold text-xs tracking-wider transition-all border ${
              scanning
                ? 'bg-amber-950/60 text-amber-400 border-amber-600 hover:bg-red-950/80 hover:text-red-400 hover:border-red-600 cursor-pointer'
                : 'bg-studio-yellow text-black border-studio-yellow hover:bg-opacity-90'
            }`}
            title={scanning ? "Triple-click or press Cancel to stop scan" : "Run audit scan"}
          >
            {scanning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span className="ml-2">SCANNING ({progress}%) [3-CLICK STOP]</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" fill="currentColor" />
                <span className="ml-2">RUN AUDIT SCAN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Connection Error Banner */}
      {connectionError && (
        <div className="bg-red-950 border border-red-800 rounded p-4 mb-6 text-red-400 text-xs font-mono">
          <span className="font-bold uppercase tracking-wider">Connection Failure:</span>{' '}
          {connectionError}
        </div>
      )}

      {/* ORANGE BOX: Dark Yellow Scanning Progress Bar (Shown during scan) */}
      {scanning && (
        <div className="bg-zinc-900 border border-studio-yellow/40 rounded-xl p-5 mb-6 shadow-xl animate-fade-in">
          <div className="flex justify-between items-center mb-2 text-xs font-mono">
            <span className="text-studio-yellow font-bold tracking-wider animate-pulse flex items-center">
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2 text-studio-yellow" />
              SYSTEM AUDIT IN PROGRESS...
            </span>
            <span className="text-studio-yellow font-bold">{progress}% COMPLETED</span>
          </div>
          <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800">
            <div
              className="bg-studio-yellow h-3 rounded-full transition-all duration-300 shadow-[0_0_12px_#eab308]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* PURPLE BOX: 3 Split-Circle System Gauges (CPU, RAM, Network) - ALWAYS VISIBLE */}
      <div className="bg-zinc-900/80 border border-purple-900/40 rounded-xl p-6 mb-6 shadow-2xl">
        <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4 flex items-center">
          <span className="w-2 h-2 rounded-full bg-purple-500 mr-2 animate-ping"></span>
          REAL-TIME OS TASK MANAGER METRICS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Circle Gauge 1: CPU */}
          <div className="flex flex-col items-center bg-zinc-950/90 border border-zinc-800 rounded-xl p-5 shadow-lg">
            <div className="relative w-40 h-28 flex flex-col items-center justify-between pt-1">
              <svg className="w-36 h-20" viewBox="0 0 100 55">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#27272a" strokeWidth="6" strokeLinecap="round" />
                <line x1="10" y1="50" x2="90" y2="50" stroke="#a855f7" strokeWidth="2" strokeDasharray="3 3" />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={125.66}
                  strokeDashoffset={125.66 - (125.66 * Math.min(sysMetrics.cpu, 100)) / 100}
                  className="transition-all duration-700 ease-out"
                  style={{ filter: 'drop-shadow(0 0 8px #a855f7)' }}
                />
              </svg>
              <div className="text-center -mt-6">
                <span className="text-sm font-bold text-purple-300 font-mono block mb-1">{Math.round(sysMetrics.cpu)}%</span>
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest">CPU</h4>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{Math.round(sysMetrics.cpu)}% Utilized</p>
              </div>
            </div>
          </div>

          {/* Circle Gauge 2: RAM */}
          <div className="flex flex-col items-center bg-zinc-950/90 border border-zinc-800 rounded-xl p-5 shadow-lg">
            <div className="relative w-40 h-28 flex flex-col items-center justify-between pt-1">
              <svg className="w-36 h-20" viewBox="0 0 100 55">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#27272a" strokeWidth="6" strokeLinecap="round" />
                <line x1="10" y1="50" x2="90" y2="50" stroke="#a855f7" strokeWidth="2" strokeDasharray="3 3" />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={125.66}
                  strokeDashoffset={125.66 - (125.66 * Math.min(sysMetrics.ram, 100)) / 100}
                  className="transition-all duration-700 ease-out"
                  style={{ filter: 'drop-shadow(0 0 8px #a855f7)' }}
                />
              </svg>
              <div className="text-center -mt-6">
                <span className="text-sm font-bold text-purple-300 font-mono block mb-1">{Math.round(sysMetrics.ram)}%</span>
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest">RAM</h4>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{Math.round(sysMetrics.ram)}% Allocated</p>
              </div>
            </div>
          </div>

          {/* Circle Gauge 3: NETWORK */}
          <div className="flex flex-col items-center bg-zinc-950/90 border border-zinc-800 rounded-xl p-5 shadow-lg">
            <div className="relative w-40 h-28 flex flex-col items-center justify-between pt-1">
              <svg className="w-36 h-20" viewBox="0 0 100 55">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#27272a" strokeWidth="6" strokeLinecap="round" />
                <line x1="10" y1="50" x2="90" y2="50" stroke={sysMetrics.networkConnected ? '#a855f7' : '#ef4444'} strokeWidth="2" strokeDasharray="3 3" />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke={sysMetrics.networkConnected ? '#a855f7' : '#ef4444'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={125.66}
                  strokeDashoffset={sysMetrics.networkConnected ? 0 : 125.66}
                  className="transition-all duration-700 ease-out"
                  style={{ filter: sysMetrics.networkConnected ? 'drop-shadow(0 0 8px #a855f7)' : 'drop-shadow(0 0 8px #ef4444)' }}
                />
              </svg>
              <div className="text-center -mt-6">
                <span className={`text-sm font-bold font-mono block mb-1 ${sysMetrics.networkConnected ? 'text-purple-300' : 'text-red-400'}`}>
                  {sysMetrics.networkConnected ? 'ONLINE' : 'N/A'}
                </span>
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest">NETWORK</h4>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  {sysMetrics.networkConnected ? sysMetrics.networkSpeed : 'N/A Disconnected'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GREEN BOX: Full Width Continuous Live File Inspection Terminal */}
      <div
        ref={consoleContainerRef}
        onScroll={handleConsoleScroll}
        className="bg-zinc-950 border border-emerald-900/40 rounded-xl p-5 mb-6 font-mono text-[11px] h-64 overflow-y-auto space-y-1.5 select-text shadow-2xl flex-1 min-h-[220px] relative"
      >
        <div className="text-emerald-400 border-b border-zinc-900 pb-2 mb-3 font-bold uppercase tracking-wider flex justify-between items-center sticky top-0 bg-zinc-950/95 backdrop-blur z-10 py-1">
          <span className="flex items-center">
            <span className={`w-2 h-2 rounded-full mr-2 ${scanning ? 'bg-emerald-500 animate-ping' : 'bg-zinc-600'}`}></span>
            LIVE FILE SYSTEM INSPECTION CONSOLE
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] border ${
            scanning
              ? 'text-emerald-300 bg-emerald-950 border-emerald-800 animate-pulse'
              : 'text-zinc-500 bg-zinc-900 border-zinc-800'
          }`}>
            {scanning ? (userScrolledUp ? 'PAUSED (SCROLLED UP)' : `● SCANNING ACTIVE (${totalScanned.toLocaleString()} FILES)`) : '● MONITOR STANDBY'}
          </span>
        </div>

        {/* Floating Resume Auto-Scroll Button */}
        {userScrolledUp && scanning && (
          <button
            onClick={() => {
              setUserScrolledUp(false)
              consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold shadow-2xl transition-all z-20 flex items-center space-x-1 mx-auto cursor-pointer animate-bounce"
          >
            <span>↓ Resume Auto-Scroll</span>
          </button>
        )}

        {/* Log lines */}
        {scannedLogs.length > 0 ? (
          <>
            {scannedLogs.map((log, i) => {
              if (log.signature === 'LOCKDOWN_TRIGGERED' || log.file_path.startsWith('[THREAT DETECTED]')) {
                return (
                  <p key={i} className="text-red-400 font-bold bg-red-950/90 p-2.5 my-1.5 rounded-lg border-2 border-red-600 text-xs tracking-wider animate-pulse shadow-lg">
                    {log.file_path}
                  </p>
                )
              }
              if (log.file_path.startsWith('[SCAN COMPLETED]')) {
                return (
                  <p key={i} className="text-emerald-300 font-bold bg-emerald-950/90 p-2.5 my-1.5 rounded-lg border border-emerald-600 text-xs tracking-wider shadow-lg">
                    {log.file_path}
                  </p>
                )
              }
              return (
                <p
                  key={i}
                  className={
                    log.status === 'infected'
                      ? 'text-red-400 font-bold bg-red-950/60 p-1.5 rounded border border-red-800/60 animate-pulse'
                      : 'text-emerald-400'
                  }
                >
                  {log.status === 'infected' ? (
                    `[THREAT FLAG] Threat signature detected in ${log.file_path} (${log.signature || 'Malware'})`
                  ) : (
                    `[CLEAN] Inspecting ${log.file_path} ... OK`
                  )}
                </p>
              )
            })}
            <div ref={consoleEndRef} />
          </>
        ) : (
          <p className="text-zinc-500 select-none">
            [INFO] Monitor standby. Press &quot;RUN AUDIT SCAN&quot; to inspect system files.
          </p>
        )}
      </div>

      {/* No scan triggered yet state */}
      {!scanning && findings.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg p-12 text-center">
          <div className="w-16 h-16 text-zinc-700 mb-4 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-400">No Audits Run Yet</h3>
          <p className="text-xs text-zinc-600 max-w-sm mt-1">
            Trigger a system audit scan to inspect active local processes, open communication ports,
            and potential malware files.
          </p>
        </div>
      )}

      {/* 10-MINUTE MODERATE RISK NAG MODAL */}
      {showNagModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-amber-500/50 rounded-lg p-5 font-mono space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-amber-400 border-b border-zinc-800 pb-2">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="font-bold text-sm uppercase">10-Minute Security Reminder</h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Unresolved **Moderate Risk** vulnerability detected (SSH Root Login enabled). Please apply the auto-fix patch to ensure system safety.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNagModal(false)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded"
              >
                Snooze 10m
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/scanner/remediate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'fix_ssh', target: '' })
                    })
                    const data = await res.json()
                    if (data.status === 'success') {
                      alert(data.message)
                      setFindings(prev => prev.filter(f => f.id !== 'lynis-ssh' && f.id !== 'lynis-ssh-root'))
                      setShowNagModal(false)
                    } else {
                      alert(`Failed to apply fix: ${data.message}`)
                    }
                  } catch (err) {
                    alert(`Connection error during auto-fix: ${err}`)
                  }
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded"
              >
                Auto-Fix Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Findings Results Dashboard */}
      {findings.length > 0 && !scanning && (
        <div className="space-y-6">
          {/* AI / Fallback Report Banner */}
          {aiReport && (
            <div className="bg-zinc-900 border border-studio-yellow/30 rounded-lg p-4 font-mono space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-studio-yellow uppercase tracking-wider">
                  {aiReport.title || 'SuperForge AI Report'}
                </span>
                <span className="text-[10px] text-zinc-500">{(aiReport.status || 'COMPLETED').toUpperCase()}</span>
              </div>
              <p className="text-xs text-zinc-300">{aiReport.summary}</p>
              {aiReport.report_text && (
                <div className="bg-zinc-950 p-3 rounded text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {aiReport.report_text}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2 text-xs text-zinc-400 uppercase tracking-widest border-b border-zinc-900 pb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="ml-2">Audit Findings ({findings.length} issues flagged)</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {findings.map((f) => {
              const isLow = f.severity.toLowerCase() === 'low'
              const isMed = f.severity.toLowerCase() === 'medium'
              const isHigh = f.severity.toLowerCase() === 'high'

              let severityBg = 'bg-zinc-900/40 border-zinc-800'
              let severityBadge = 'bg-zinc-800 text-zinc-400'
              if (isLow) {
                severityBg = 'bg-zinc-900/30 border-blue-900/30'
                severityBadge = 'bg-blue-950 border border-blue-800 text-blue-400'
              } else if (isMed) {
                severityBg = 'bg-zinc-900/40 border-amber-900/40'
                severityBadge = 'bg-amber-950 border border-amber-800 text-amber-400'
              } else if (isHigh) {
                severityBg = 'bg-red-950/20 border-red-900/40'
                severityBadge = 'bg-red-950 border border-red-800 text-red-400'
              }

              return (
                <div
                  key={f.id}
                  className={`border rounded-lg p-4 flex flex-col md:flex-row gap-4 justify-between items-start ${severityBg}`}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${severityBadge}`}
                      >
                        {f.severity.toUpperCase()} RISK
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">Source: {f.tool}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{f.issue}</h4>

                    {/* Low Risk Card (Interactive copy paste option) */}
                    {isLow && (
                      <div className="bg-zinc-900 border border-zinc-800/80 rounded p-2.5 flex items-center justify-between text-xs font-mono max-w-lg mt-2">
                        <code className="text-zinc-400 select-all shrink-0 mr-4">{f.fix}</code>
                        <button
                          onClick={() => handleCopy(f.fix, f.id)}
                          className="text-zinc-500 hover:text-white transition-all shrink-0 p-1 rounded"
                        >
                          {copiedId === f.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Moderate Risk Card (auto-fix flow description) */}
                    {isMed && (
                      <div className="bg-amber-950/10 border border-amber-900/30 rounded p-3 text-xs mt-2 text-zinc-400">
                        <span className="font-bold text-amber-400">Remediation Suggestion:</span>{' '}
                        {f.fix}
                        <div className="mt-3">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`${API_BASE}/scanner/remediate`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'fix_ssh', target: '' })
                                })
                                const data = await res.json()
                                if (data.status === 'success') {
                                  alert(data.message)
                                  setFindings(prev => prev.filter(find => find.id !== f.id))
                                } else {
                                  alert(`Failed to apply fix: ${data.message}`)
                                }
                              } catch (err) {
                                alert(`Connection error during auto-fix: ${err}`)
                              }
                            }}
                            className="px-3 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-600/40 text-amber-400 font-bold rounded text-[10px] transition-all"
                          >
                            RUN AUTO-FIX PATCH
                          </button>
                        </div>
                      </div>
                    )}

                    {/* High Risk Card (Lockdown info) */}
                    {isHigh && (
                      <div className="bg-red-950/20 border border-red-900/30 rounded p-3 text-xs mt-2 text-zinc-400">
                        <span className="font-bold text-red-400 flex items-center space-x-1 mb-1">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="ml-2">Action Required:</span>
                        </span>
                        <span>{f.fix}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
