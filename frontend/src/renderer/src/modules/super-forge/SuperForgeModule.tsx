import React, { useState, useEffect, useRef } from 'react'
import { Bot, User, Cpu, Globe, Zap, Send, Shield, Terminal, Code, Lock, Sparkles, ChevronDown, ChevronUp, Mic, Plus, Server } from 'lucide-react'

interface SuperForgeModuleProps {
  activeMod: string
}

interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  text: string
  provider?: string
  persona?: string
  timestamp: string
}

const PERSONA_LABELS: Record<string, { name: string; icon: any; color: string }> = {
  security_consultant: { name: 'Security Consultant', icon: Shield, color: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' },
  system_hardening: { name: 'System Hardening Advisor', icon: Lock, color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' },
  decoy_analyst: { name: 'Decoy Analyst', icon: Terminal, color: 'text-purple-400 border-purple-500/40 bg-purple-500/10' },
  code_auditor: { name: 'ashCode Auditor', icon: Code, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  roadmap_advisor: { name: 'Roadmap Coach', icon: Sparkles, color: 'text-blue-400 border-blue-500/40 bg-blue-500/10' }
}

const ENGINE_OPTIONS = [
  { id: 'local_qwen', name: 'Qwen 2.5 Coder (Local Ollama)', icon: Cpu, badge: 'Local', color: 'text-emerald-400' },
  { id: 'gemini', name: 'Gemini 3.6 Flash (High Cloud)', icon: Globe, badge: 'Online', color: 'text-cyan-400' },
  { id: 'free_pool', name: 'Free LLM API Pool (Groq/OpenRouter)', icon: Server, badge: 'Free API', color: 'text-purple-400' },
  { id: 'auto', name: 'Smart Auto Failover (Cloud → Free Pool → Local)', icon: Zap, badge: 'Smart', color: 'text-yellow-400' }
]

export const SuperForgeModule: React.FC<SuperForgeModuleProps> = ({ activeMod }) => {
  if (activeMod !== 'ide' && activeMod !== 'forge' && activeMod !== 'nodes' && activeMod !== 'code') return null

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Welcome to SuperForge AI (ashCode). I am standing by to assist with security audits, system hardening, and threat response.",
      provider: 'system',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [inputMsg, setInputMsg] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<string>('local_qwen')
  const [selectedPersona, setSelectedPersona] = useState<string>('security_consultant')
  const [isLoading, setIsLoading] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isTaskBannerOpen, setIsTaskBannerOpen] = useState(true)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMsg.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInputMsg('')
    setIsLoading(false)
    setIsLoading(true)

    try {
      const response = await fetch('http://127.0.0.1:8000/api/superforge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          persona: selectedPersona,
          provider: selectedProvider
        })
      })

      if (response.ok) {
        const data = await response.json()
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: data.text || 'No response generated.',
          provider: data.provider || selectedProvider,
          persona: selectedPersona,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        setMessages((prev) => [...prev, aiMsg])
      } else {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `**Connection Notice**: Could not reach backend AI service at http://127.0.0.1:8000.\n(${error.message})`,
        provider: 'error',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const currentEngine = ENGINE_OPTIONS.find((e) => e.id === selectedProvider) || ENGINE_OPTIONS[0]

  return (
    <div className="flex-1 flex flex-col bg-[#0f0f11] font-mono text-slate-100 h-full w-full relative overflow-hidden select-none border-l border-slate-800/80">
      {/* Subtle Matrix/Grid Overlay */}
      <div className="absolute inset-0 canvas-grid-bg opacity-10 pointer-events-none"></div>

      {/* Header Bar */}
      <header className="px-6 py-3.5 bg-[#08080c]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-xl bg-[#c89b3c]/20 border border-[#c89b3c]/40 flex items-center justify-center text-[#c89b3c] shadow-[0_0_12px_rgba(200,155,60,0.3)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm tracking-wider text-white font-mono">
            VØID <span className="text-[#c89b3c]">{'//'}</span> SUPERFORGE AI ENGINE
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 font-mono font-bold">
            NEURAL CORE ONLINE
          </span>
        </div>
      </header>

      {/* Persona Selection Bar */}
      <div className="px-5 py-2.5 bg-[#121215] border-b border-slate-800/60 flex items-center space-x-2 overflow-x-auto no-scrollbar z-10">
        <span className="text-[11px] text-slate-400 font-sans font-medium mr-1">Persona:</span>
        {Object.entries(PERSONA_LABELS).map(([id, meta]) => {
          const IconComponent = meta.icon
          const isSelected = selectedPersona === id
          return (
            <button
              key={id}
              onClick={() => setSelectedPersona(id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-sans transition-all ${
                isSelected
                  ? meta.color + ' font-semibold shadow-sm'
                  : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 bg-[#1a1a1e]'
              }`}
            >
              <IconComponent className="w-3.5 h-3.5" />
              <span>{meta.name}</span>
            </button>
          )
        })}
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 z-10 no-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user'
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                  isUser
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                    : 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[82%] rounded-2xl p-4 border font-sans ${
                  isUser
                    ? 'bg-[#1f293d] border-blue-500/30 text-slate-100'
                    : 'bg-[#18181c] border-slate-800 text-slate-200 shadow-xl'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between mb-2 text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-cyan-400 uppercase tracking-wide font-mono">
                      SUPERFORGE AI
                    </span>
                    {msg.provider && (
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-700">
                        {msg.provider === 'local_qwen'
                          ? 'Qwen 2.5 (Local)'
                          : msg.provider === 'gemini'
                          ? 'Gemini 3.6 (Cloud)'
                          : msg.provider === 'free_pool'
                          ? 'Free LLM Pool'
                          : msg.provider}
                      </span>
                    )}
                  </div>
                )}

                <div className="text-sm whitespace-pre-wrap leading-relaxed select-text font-normal">
                  {msg.text}
                </div>

                <div className="text-[10px] text-slate-500 text-right mt-2 font-mono">{msg.timestamp}</div>
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex items-center space-x-3 text-cyan-400 text-xs animate-pulse font-sans">
            <div className="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center">
              <Bot className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>
            <div className="bg-[#18181c] border border-slate-800 rounded-2xl px-4 py-3 text-slate-300">
              Generating response with {currentEngine.name}...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Floating Pill Chat Input Area (Matching User Screenshot) */}
      <div className="p-4 bg-[#0f0f11] z-20">
        <div className="max-w-4xl mx-auto bg-[#1c1c21] border border-slate-800/90 rounded-[22px] shadow-2xl overflow-visible relative transition-all focus-within:border-slate-700">
          
          {/* Top Status/Task Bar Banner (Collapsible like in screenshot) */}
          <div className="px-4 py-2 border-b border-slate-800/70 flex items-center justify-between text-xs text-slate-400 font-sans">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-slate-300 font-medium">1 task running</span>
            </div>
            <button
              onClick={() => setIsTaskBannerOpen(!isTaskBannerOpen)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            >
              {isTaskBannerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Main Text Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="p-3 font-sans"
          >
            <textarea
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              rows={2}
              placeholder={`Ask ashCode SuperForge AI (${PERSONA_LABELS[selectedPersona]?.name || 'Assistant'})...`}
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-sm resize-none"
              disabled={isLoading}
            />

            {/* Bottom Controls Row inside Input Box */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/40 relative">
              
              {/* LLM Engine Dropdown Selector Pill (Matching Screenshot Bottom Left) */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#26262d] hover:bg-[#2d2d36] border border-slate-700 text-xs text-slate-200 transition-all font-sans font-medium"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <currentEngine.icon className={`w-3.5 h-3.5 ${currentEngine.color}`} />
                  <span>{currentEngine.name}</span>
                  <ChevronUp className={`w-3 h-3 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Popup */}
                {isDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 bg-[#1e1e24] border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-slate-800">
                    <div className="px-3 py-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Select LLM Engine
                    </div>
                    <div className="py-1">
                      {ENGINE_OPTIONS.map((engine) => {
                        const Icon = engine.icon
                        const isSelected = selectedProvider === engine.id
                        return (
                          <button
                            key={engine.id}
                            type="button"
                            onClick={() => {
                              setSelectedProvider(engine.id)
                              setIsDropdownOpen(false)
                            }}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-[#282832] transition-colors font-sans text-xs ${
                              isSelected ? 'bg-[#282832] font-semibold text-white' : 'text-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <Icon className={`w-4 h-4 ${engine.color}`} />
                              <span>{engine.name}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              {engine.badge}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side Action Buttons (Mic & Circular Send Arrow) */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Voice Input"
                >
                  <Mic className="w-4 h-4" />
                </button>

                <button
                  type="submit"
                  disabled={!inputMsg.trim() || isLoading}
                  className="w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:hover:bg-cyan-500 text-slate-950 font-bold transition-all flex items-center justify-center shadow-lg shadow-cyan-500/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
