import React, { useState } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import TerminalComponent from './Terminal'
import Explorer, { OpenedFile } from './Explorer/Explorer'
import { Code, Terminal as TerminalIcon, FileCode, ChevronUp, ChevronDown } from 'lucide-react'

export interface DcsModuleProps {
	activeMod: string
}
export type AshCodeModuleProps = DcsModuleProps

loader.config({ monaco })

const PLACEHOLDER_VALUE = `// ==========================================
// VØID STUDIO // DCS SECURE RUNTIME
// developer's colabrative space
// ==========================================

function initializeEnvironment() {
  console.log("VØID Engine Online: Ready for sandboxed execution.");
}

initializeEnvironment();
`

export const DcsModule: React.FC<DcsModuleProps> = ({ activeMod }) => {
	const [activeFile, setActiveFile] = useState<OpenedFile | null>(null)
	const [editorValue, setEditorValue] = useState<string>(PLACEHOLDER_VALUE)
	const [isTerminalExpanded, setIsTerminalExpanded] = useState<boolean>(true)

	const handleFileOpen = (file: OpenedFile): void => {
		if (file.fileType.category !== 'text') {
			setActiveFile(file)
			setEditorValue(
				`// ${file.name} is a ${file.fileType.category} file (${file.fileType.extension || 'no extension'}).\n// Binary preview is sandboxed.`
			)
			return
		}

		setActiveFile(file)
		setEditorValue(file.content)
	}

	if (activeMod !== 'nodes' && activeMod !== 'code' && activeMod !== 'dcs') return null

	return (
		<div className="flex-1 flex flex-row h-full w-full overflow-hidden bg-[#050508] text-[#e8e4dc] select-none">
			{/* Left: Project File Tree Explorer */}
			<div className="w-64 h-full border-r border-white/10 bg-[#07070b]/90 backdrop-blur-xl flex flex-col shrink-0">
				<div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-mono font-bold text-[#8b9094]">
					<div className="flex items-center gap-2">
						<Code className="w-3.5 h-3.5 text-[#c89b3c]" />
						<span className="text-[#e8e4dc] tracking-wider uppercase">WORKSPACE</span>
					</div>
					<span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[#8b9094]">
						EXPLORER
					</span>
				</div>
				<div className="flex-1 overflow-y-auto">
					<Explorer onFileOpen={handleFileOpen} />
				</div>
			</div>

			{/* Center & Right: Monaco Editor + Bottom Terminal */}
			<div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#050508]">
				{/* Editor Top Tab Bar */}
				<div className="h-9 px-3 bg-[#08080c] border-b border-white/10 flex items-center justify-between shrink-0">
					<div className="flex items-center space-x-1">
						{activeFile ? (
							<div className="flex items-center space-x-2 px-3 py-1 bg-white/5 border border-white/10 rounded-t text-xs font-mono text-[#e8e4dc] border-b-0">
								<FileCode className="w-3.5 h-3.5 text-[#c89b3c]" />
								<span className="font-semibold">{activeFile.name}</span>
								<span className="text-[9px] text-[#8b9094] uppercase ml-1">
									[{activeFile.fileType.language}]
								</span>
							</div>
						) : (
							<div className="flex items-center space-x-2 px-3 py-1 bg-white/5 border border-white/10 rounded-t text-xs font-mono text-[#8b9094] border-b-0">
								<FileCode className="w-3.5 h-3.5 text-[#c89b3c]" />
								<span>workspace.ts (scratchpad)</span>
							</div>
						)}
					</div>

					<div className="flex items-center space-x-3 text-[10px] font-mono text-[#8b9094]">
						<span className="flex items-center gap-1.5">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
							AST SANDBOX: ACTIVE
						</span>
					</div>
				</div>

				{/* Monaco Code Editor Area */}
				<div className={`flex-1 min-h-0 relative ${isTerminalExpanded ? 'h-[62%]' : 'h-[94%]'}`}>
					<Editor
						height="100%"
						language={activeFile?.fileType.language ?? 'typescript'}
						theme="vs-dark"
						options={{
							fontSize: 13,
							fontFamily: "'Space Mono', 'JetBrains Mono', monospace",
							minimap: { enabled: true },
							scrollBeyondLastLine: false,
							automaticLayout: true,
							cursorBlinking: 'smooth',
							smoothScrolling: true,
							readOnly: activeFile ? activeFile.fileType.category !== 'text' : false
						}}
						value={editorValue}
						onChange={(value) => setEditorValue(value ?? '')}
					/>
				</div>

				{/* Integrated Bottom Terminal */}
				<div
					className={`border-t border-white/10 bg-black flex flex-col transition-all duration-200 shrink-0 ${isTerminalExpanded ? 'h-[38%]' : 'h-8'
						}`}
				>
					{/* Terminal Header Bar */}
					<div className="h-8 px-4 bg-[#09090d] border-b border-white/5 flex items-center justify-between shrink-0 select-none">
						<div className="flex items-center space-x-2 text-xs font-mono text-[#8b9094]">
							<TerminalIcon className="w-3.5 h-3.5 text-[#c89b3c]" />
							<span className="text-[#e8e4dc] font-bold text-[11px] uppercase tracking-wider">
								DCS TERMINAL <span className="text-[#8b9094] font-normal">{'//'} LOCAL PTY</span>
							</span>
						</div>

						<div className="flex items-center space-x-2">
							<button
								onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
								className="p-1 rounded hover:bg-white/10 text-[#8b9094] hover:text-white transition"
								title={isTerminalExpanded ? 'Collapse Terminal' : 'Expand Terminal'}
							>
								{isTerminalExpanded ? (
									<ChevronDown className="w-3.5 h-3.5" />
								) : (
									<ChevronUp className="w-3.5 h-3.5" />
								)}
							</button>
						</div>
					</div>

					{/* Terminal Content Area */}
					{isTerminalExpanded && (
						<div className="flex-1 overflow-hidden p-2 bg-black">
							<TerminalComponent />
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export const AshCodeModule = DcsModule