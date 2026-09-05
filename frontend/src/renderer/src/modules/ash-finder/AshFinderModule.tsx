import React from 'react'
import { Code } from 'lucide-react'

export interface MagModuleProps {
  activeMod: string
}
export type AshFinderModuleProps = MagModuleProps

export const MagModule: React.FC<MagModuleProps> = ({ activeMod }) => {
  if (activeMod !== 'settings' && activeMod !== 'finder' && activeMod !== 'mag') return null

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#050508] text-[#e8e4dc] font-mono h-full w-full select-none relative overflow-hidden">
      {/* Background Matrix Grid */}
      <div className="absolute inset-0 canvas-grid-bg opacity-5 pointer-events-none" />

      {/* Clean Centered Standby Content */}
      <div className="flex flex-col items-center justify-center space-y-4 z-10 text-center max-w-md px-6">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#c89b3c] shadow-[0_0_25px_rgba(200,155,60,0.15)]">
          <Code className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base font-bold tracking-widest uppercase text-white font-mono">
            // MAG
          </h2>
          <p className="text-xs text-[#8b9094] font-light">
            mantor and guide runtime environment standby.
          </p>
        </div>
      </div>
    </div>
  )
}

export const AshFinderModule = MagModule
