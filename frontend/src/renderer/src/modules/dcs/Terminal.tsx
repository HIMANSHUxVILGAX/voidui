import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'


export default function TerminalComponent() {
          const terminalRef = useRef<HTMLDivElement>(null)

          useEffect(() => {
                    if (!terminalRef.current) return
                    let isDisposed = false

                    // 1. Initialize Terminal with correct settings
                    const terminal = new Terminal({
                              cursorBlink: true,
                              fontSize: 13,
                              fontFamily: '"JetBrains Mono", "Fira Code", "DejaVu Sans Mono", "Ubuntu Mono", Consolas, "Courier New", monospace',
                              theme: {
                                        background: '#181818',
                                        foreground: '#959595'
                              },
                              convertEol: true // Ensures newline sequences format properly
                    })

                    const fitAddon = new FitAddon()
                    terminal.loadAddon(fitAddon)
                    terminal.open(terminalRef.current)

                    // Helper to calculate exact rows/cols and notify node-pty
                    const fitAndResize = () => {
                              try {
                                        fitAddon.fit()
                                        if (window.api?.resizeTerminal && terminal.cols > 0 && terminal.rows > 0) {
                                                  window.api.resizeTerminal({
                                                            cols: terminal.cols,
                                                            rows: terminal.rows
                                                  })
                                        }
                              } catch (err) {
                                        // Suppress initial render fit errors
                              }
                    }

                    // Run initial fit
                    const timeoutId = setTimeout(fitAndResize, 50)

                    // 2. Stream data from node-pty -> React
                    if (window.api?.onTerminalData) {
                              window.api.onTerminalData((data) => {
                                        console.log("[Renderer] Received:", JSON.stringify(data));
                                        if (isDisposed) return;
                                        terminal.write(data)
                              })
                    }

                    // 3. Send keypresses from React -> node-pty
                    const dataListener = terminal.onData((data) => {
                              if (window.api?.sendTerminalData) {
                                        window.api.sendTerminalData(data)
                              }
                    })

                    // Auto-fit whenever the layout or window resizes
                    const resizeObserver = new ResizeObserver(() => {
                              fitAndResize()
                    })

                    if (terminalRef.current) {
                              resizeObserver.observe(terminalRef.current)
                    }

                    return () => {
                              isDisposed = true
                              clearTimeout(timeoutId)
                              dataListener.dispose()
                              resizeObserver.disconnect()
                              terminal.dispose()
                    }
          }, [])

          return (
                    <div
                              ref={terminalRef}
                              style={{
                                        width: '100%',
                                        height: '100%', // Fills parent terminal-area container completely
                                        boxSizing: 'border-box',
                                        overflow: 'hidden' // NEVER set overflow: scroll here!
                              }}
                    />
          )
}