import React, { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSwitchModule: (modId: string) => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSwitchModule
}) => {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const commands = [
    { id: 'front', label: '0. Overview // VOID', shortcut: 'ESC' },
    { id: 'nodes', label: "1. DCS // developer's colabrative space", shortcut: 'MOD 1' },
    { id: 'ide', label: '2. lumen', shortcut: 'MOD 2' },
    { id: 'timeline', label: '3. quark', shortcut: 'MOD 3' },
    { id: 'bento', label: '4. optics', shortcut: 'MOD 4' },
    { id: 'settings', label: '5. MAG // mantor and guide', shortcut: 'MOD 5' }
  ]

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  )

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleSelect = (id: string): void => {
    onSwitchModule(id)
    onClose()
  }

  return (
    <div
      id="cmd-palette"
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-start justify-center pt-24 px-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-[#0c0c10]/95 border border-[#deb00d]/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl shadow-black/90 font-mono backdrop-blur-2xl">
        {/* Search Header */}
        <div className="p-4 border-b border-white/10 flex items-center space-x-3 bg-white/5">
          <Search className="w-4 h-4 text-[#deb00d]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or jump to module..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent w-full text-xs text-white focus:outline-none placeholder-[#55595c]"
          />
        </div>

        {/* Command List */}
        <div className="p-2 text-xs space-y-1 max-h-64 overflow-y-auto">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => handleSelect(cmd.id)}
                className="w-full text-left px-3.5 py-2.5 text-[#e8e4dc] hover:bg-[#deb00d] hover:text-[#050505] rounded-xl flex items-center justify-between transition-all group font-mono"
              >
                <span className="group-hover:font-bold">{cmd.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 group-hover:bg-black/20 group-hover:text-black text-[#8b9094] font-bold">
                  {cmd.shortcut}
                </span>
              </button>
            ))
          ) : (
            <div className="p-4 text-[#55595c] text-center text-xs">No matching VOID commands found</div>
          )}
        </div>
      </div>
    </div>
  )
}
