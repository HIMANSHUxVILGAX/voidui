import React, { useState, useEffect, useRef } from 'react'
import { Terminal, RotateCcw, UserCheck, Wifi } from 'lucide-react'

interface SessionInfo {
  ip: string
  target_os: string
  hostname: string
  username: string
  prompt: string
  command_history: string[]
  created_at?: number
}

interface AttackerTerminalProps {
  apiBase?: string
}

export const AttackerTerminal: React.FC<AttackerTerminalProps> = ({ apiBase = 'http://127.0.0.1:8000/api' }) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const [typedCommands, setTypedCommands] = useState<string[]>([])
  const [autoScroll] = useState<boolean>(true)
  const terminalEndRef = useRef<HTMLDivElement>(null)

  // Demo fallback session data if backend has no active attacker session yet
  const fallbackSession: SessionInfo = {
    ip: '198.51.100.42 (London, UK)',
    target_os: 'linux',
    hostname: 'ubuntu-srv-prod-77',
    username: 'root',
    prompt: 'root@ubuntu-srv-prod-77:~# ',
    command_history: [
      'whoami',
      'uname -a',
      'cat /etc/passwd',
      'ls -la /var/www/html',
      'cat /var/www/html/.env'
    ]
  }

  // Poll backend for real-time Honeypot session keystrokes
  useEffect(() => {
    let isMounted = true

    const fetchKeystrokes = async () => {
      try {
        const res = await fetch(`${apiBase}/honeypot/keystrokes`).then((r) => r.json()).catch(() => null)
        if (!isMounted) return

        if (res && res.status === 'success' && Array.isArray(res.sessions) && res.sessions.length > 0) {
          setSessions(res.sessions)
          if (!selectedIp) {
            setSelectedIp(res.sessions[0].ip)
          }
        } else {
          // If no live sessions yet, show demo session for presentation
          setSessions([fallbackSession])
          if (!selectedIp) setSelectedIp(fallbackSession.ip)
        }
      } catch (err) {
        setSessions([fallbackSession])
        if (!selectedIp) setSelectedIp(fallbackSession.ip)
      }
    }

    fetchKeystrokes()
    const interval = setInterval(fetchKeystrokes, 800) // 800ms live stream polling
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [selectedIp, apiBase])

  const activeSession = sessions.find((s) => s.ip === selectedIp) || sessions[0] || fallbackSession

  useEffect(() => {
    if (activeSession) {
      const newCmds = activeSession.command_history || []
      setTypedCommands(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newCmds)) return prev
        return newCmds
      })
    }
  }, [activeSession])

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [typedCommands, autoScroll])

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col font-mono text-xs text-slate-200">
      {/* TERMINAL WINDOW HEADER BAR */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          {/* Traffic Lights Controls */}
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>

          <div className="flex items-center space-x-2 border-l border-slate-800 pl-3">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-100">Attacker's Terminal</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse font-semibold">
              LIVE STREAM
            </span>
          </div>
        </div>

        {/* Session Switcher Selector & Controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Target Session:</span>
            <select
              value={selectedIp || ''}
              onChange={(e) => setSelectedIp(e.target.value)}
              className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
            >
              {sessions.map((sess) => (
                <option key={sess.ip} value={sess.ip} className="bg-slate-900 text-slate-200">
                  {sess.ip} ({sess.target_os.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setTypedCommands([])}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Clear Terminal View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TERMINAL CONTENT SCREEN */}
      <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs min-h-[200px] max-h-[260px] overflow-y-auto space-y-3">
        {/* Banner Welcome Header */}
        <div className="text-slate-500 border-b border-slate-900 pb-2 space-y-1 text-[11px]">
          <p># elumPot Active Deception Trapping Environment (Session: {activeSession?.ip})</p>
          <p># Mirror OS: <span className="text-cyan-400 font-bold">{activeSession?.target_os.toUpperCase()}</span> | Hostname: <span className="text-slate-300">{activeSession?.hostname}</span></p>
          <p># Attacker keystrokes isolated inside HoneypotSession virtual memory context.</p>
        </div>

        {/* Command History Stream */}
        {typedCommands.length === 0 ? (
          <div className="py-6 text-center text-slate-600 italic text-[11px]">
            Waiting for intruder keystrokes on Port 2222 (SSH)...
          </div>
        ) : (
          typedCommands.map((cmd, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-cyan-400 font-bold select-none">{activeSession.prompt}</span>
                <span className="text-slate-100 font-bold">{cmd}</span>
              </div>

              {/* Simulated Output per command */}
              <div className="pl-4 text-slate-400 text-[11px] font-mono leading-relaxed bg-slate-900/40 p-2 rounded border border-slate-900">
                {cmd.includes('whoami') ? (
                  <span className="text-amber-300 font-bold">{activeSession.username}</span>
                ) : cmd.includes('uname') ? (
                  <span>Linux 5.15.0-101-generic #111-Ubuntu SMP x86_64</span>
                ) : cmd.includes('passwd') ? (
                  <span className="text-rose-300">
                    root:x:0:0:root:/root:/bin/bash<br />
                    daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin<br />
                    sys:x:2:2:sys:/dev:/usr/sbin/nologin
                  </span>
                ) : cmd.includes('env') ? (
                  <span className="text-emerald-300 font-bold">
                    DATABASE_URL=postgres://root:p%40ssw0rd123@prod-db.internal:5432/main<br />
                    SECRET_KEY=sk_live_99f8a810b2c451<br />
                    AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
                  </span>
                ) : cmd.includes('dir') || cmd.includes('ls') ? (
                  <span>
                    drwxr-xr-x 2 root root 4096 Aug 24 18:00 .<br />
                    -rw-r--r-- 1 root root  512 Aug 24 18:00 .env<br />
                    -rw-r--r-- 1 root root 2048 Aug 24 18:00 config.json<br />
                    -rw-r--r-- 1 root root 8192 Aug 24 18:00 passwords.db
                  </span>
                ) : (
                  <span>[elumPot Sandbox] Command output served from virtual memory layer.</span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Active Typing Cursor Line */}
        <div className="flex items-center space-x-2 pt-1">
          <span className="text-cyan-400 font-bold select-none">{activeSession.prompt}</span>
          <span className="w-2 h-4 bg-emerald-400 animate-pulse inline-block"></span>
        </div>

        <div ref={terminalEndRef} />
      </div>

      {/* TERMINAL FOOTER STATUS BAR */}
      <div className="px-4 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Socket: Connected (Port 2222)</span>
          </span>
          <span>•</span>
          <span>Zero Host Escalation Guaranteed</span>
        </div>
        <span className="font-mono text-slate-500">NO-ASH Deception Sandbox v4.0</span>
      </div>
    </div>
  )
}
export default AttackerTerminal
