import React from 'react'
import { Settings, Minus, Square, X } from 'lucide-react'

interface HeaderProps {
  activeMod: string
  onSwitchModule: (modId: string) => void
  onOpenSettings: () => void
}

export const Header: React.FC<HeaderProps> = ({ onSwitchModule, onOpenSettings }) => {
  const handleClose = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('window-close')
    }
  }

  const handleMinimize = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('window-minimize')
    }
  }

  const handleMaximize = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('window-maximize')
    }
  }

  return (
    <header
      className="h-10 bg-[#060608]/95 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-3 z-50 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 1. LEFT: VØID BRAND LOGO (NO-DRAG) */}
      <div
        className="flex items-center space-x-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => onSwitchModule('front')}
          className="flex items-center space-x-2 group hover:opacity-90 transition px-1.5 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
        >
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#c89b3c] to-[#9a7224] text-[#050505] flex items-center justify-center font-bold text-[10px] font-mono shadow-[0_0_10px_rgba(200,155,60,0.4)]">
            V
          </div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#e8e4dc]">
            VØID
          </span>
        </button>
      </div>

      {/* 2. MIDDLE: CLEAN DRAGGABLE REGION (EMPTY SPACE FOR WINDOW DRAGGING) */}
      <div className="flex-1 h-full" onDoubleClick={handleMaximize} />

      {/* 3. RIGHT: SETTINGS, STATUS & CUSTOM WINDOW CONTROLS (NO-DRAG) */}
      <div
        className="flex items-center space-x-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={onOpenSettings}
          title="Workstation Settings"
          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:border-[#c89b3c]/60 text-[#8b9094] hover:text-[#e8e4dc] transition-all flex items-center justify-center shrink-0 cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-[#c89b3c]/10 border border-[#c89b3c]/30 rounded-full text-xs text-[#c89b3c] font-mono shadow-[0_0_12px_rgba(200,155,60,0.15)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c89b3c] animate-pulse"></span>
          <span className="text-[9px] font-bold tracking-wider">ONLINE</span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-white/10 mx-1"></div>

        {/* Custom Window Controls (Min, Max, Close) */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleMinimize}
            title="Minimize"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#8b9094] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            title="Maximize / Restore"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#8b9094] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            title="Close"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#8b9094] hover:text-white hover:bg-red-600 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
