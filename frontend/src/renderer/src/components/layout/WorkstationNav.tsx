import React, { useState } from 'react'
import { Search } from 'lucide-react'

interface WorkstationNavProps {
  activeMod: string
  onSwitchModule: (modId: string) => void
  onToggleCommandPalette: () => void
}

export const WorkstationNav: React.FC<WorkstationNavProps> = ({
  activeMod,
  onSwitchModule,
  onToggleCommandPalette
}) => {
  if (activeMod === 'front') return null

  const [isHovered, setIsHovered] = useState(false)

  const navItems = [
    {
      id: 'nodes',
      title: "DCS // developer's colabrative space",
      shortcut: '1',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )
    },
    {
      id: 'ide',
      title: 'lumen',
      shortcut: '2',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="16" height="16" x="4" y="4" rx="2" />
          <rect width="6" height="6" x="9" y="9" />
          <path d="M15 2v2" />
          <path d="M15 20v2" />
          <path d="M2 15h2" />
          <path d="M2 9h2" />
          <path d="M20 15h2" />
          <path d="M20 9h2" />
          <path d="M9 2v2" />
          <path d="M9 20v2" />
        </svg>
      )
    },
    {
      id: 'timeline',
      title: 'quark',
      shortcut: '3',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      )
    },
    {
      id: 'bento',
      title: 'optics',
      shortcut: '4',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
          <path d="M19.1 4.9c3.9 3.9 3.9 10.2 0 14.1" />
        </svg>
      )
    },
    {
      id: 'settings',
      title: 'MAG // mantor and guide',
      shortcut: '5',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" x2="4" y1="21" y2="14" />
          <line x1="4" x2="4" y1="10" y2="3" />
          <line x1="12" x2="12" y1="21" y2="12" />
          <line x1="12" x2="12" y1="8" y2="3" />
          <line x1="20" x2="20" y1="21" y2="16" />
          <line x1="20" x2="20" y1="12" y2="3" />
          <line x1="1" x2="7" y1="14" y2="14" />
          <line x1="9" x2="15" y1="8" y2="8" />
          <line x1="17" x2="23" y1="16" y2="16" />
        </svg>
      )
    }
  ]

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center select-none min-w-[8px]"
      style={{
        paddingLeft: '0px',
        paddingRight: '20px',
        paddingTop: '20px',
        paddingBottom: '20px'
      }}
    >
      {/* 1. COLLAPSED VERTICAL HANDLE ("DANTI" / STRIP) */}
      <div
        className={`w-1.5 h-36 rounded-r-full bg-gradient-to-b from-[#c89b3c]/20 via-[#c89b3c] to-[#c89b3c]/20 shadow-[0_0_15px_rgba(200,155,60,0.8)] cursor-pointer transition-all duration-300 ${isHovered
            ? 'opacity-0 scale-y-0 -translate-x-full pointer-events-none'
            : 'opacity-100 scale-y-100 translate-x-0'
          }`}
      />

      {/* 2. EXPANDED FLOATING MORPH SQUIRCLE ICONS PANEL */}
      <div
        className={`flex flex-col gap-3 items-center transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${isHovered
            ? 'opacity-100 translate-x-3 scale-100 pointer-events-auto'
            : 'opacity-0 -translate-x-12 scale-90 pointer-events-none'
          }`}
      >
        {/* Home / Matrix Button */}
        <div className="relative group/tip flex items-center">
          <button
            onClick={() => onSwitchModule('front')}
            className={`side-icon-btn group hover-target ${activeMod === 'front' ? 'active' : ''}`}
            title="VØID Matrix Overview"
          >
            <svg
              className="w-5 h-5 transition-transform group-hover:scale-110"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
          {/* Tooltip on right */}
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#0c0c10]/95 border border-white/10 text-white font-mono text-xs shadow-2xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-all duration-200 -translate-x-2 group-hover/tip:translate-x-0 backdrop-blur-xl z-50">
            <span className="text-[#c89b3c] font-bold mr-1">0.</span> VØID Overview
          </div>
        </div>

        {/* Divider */}
        <div className="w-[46px] flex justify-center py-0.5">
          <div className="w-px h-5 bg-white/15"></div>
        </div>

        {/* 5 Main Modules */}
        {navItems.map((item, idx) => {
          const isActive = activeMod === item.id ||
            (item.id === 'nodes' && (activeMod === 'code' || activeMod === 'dcs')) ||
            (item.id === 'ide' && (activeMod === 'forge' || activeMod === 'lumen')) ||
            (item.id === 'timeline' && activeMod === 'quark') ||
            (item.id === 'bento' && (activeMod === 'elum' || activeMod === 'optics')) ||
            (item.id === 'settings' && activeMod === 'mag')
          return (
            <div key={item.id} className="relative group/tip flex items-center">
              <button
                onClick={() => onSwitchModule(item.id)}
                className={`side-icon-btn group hover-target ${isActive ? 'active' : ''}`}
              >
                {item.icon}
              </button>
              {/* Tooltip on right */}
              <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#0c0c10]/95 border border-white/10 text-white font-mono text-xs shadow-2xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-all duration-200 -translate-x-2 group-hover/tip:translate-x-0 backdrop-blur-xl z-50">
                <span className="text-[#c89b3c] font-bold mr-1">{idx + 1}.</span> {item.title}
              </div>
            </div>
          )
        })}

        {/* Divider */}
        <div className="w-[46px] flex justify-center py-0.5">
          <div className="w-px h-5 bg-white/15"></div>
        </div>

        {/* Command Palette Trigger */}
        <div className="relative group/tip flex items-center">
          <button
            onClick={onToggleCommandPalette}
            className="side-icon-btn group hover-target hover:border-[#c89b3c]/60"
            title="Command Palette (Ctrl+K)"
          >
            <Search className="w-5 h-5 text-[#8b9094] group-hover:text-white transition-transform group-hover:scale-110" />
          </button>
          {/* Tooltip on right */}
          <div className="absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-[#0c0c10]/95 border border-white/10 text-white font-mono text-xs shadow-2xl whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-all duration-200 -translate-x-2 group-hover/tip:translate-x-0 backdrop-blur-xl z-50">
            <span className="text-[#c89b3c] font-bold mr-1">⌘</span> Command Palette (Ctrl+K)
          </div>
        </div>
      </div>
    </div>
  )
}
