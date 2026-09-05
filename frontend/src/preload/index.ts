import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
console.log('[Preload] Initializing terminal IPC bridge...')
// Custom APIs for renderer
const api = {
  onTerminalData: (callback: (data: string) => void) => {
    const handler = (_: any, data: string): void => { callback(data) }
    ipcRenderer.on('terminal-incoming', handler)
    return () => { ipcRenderer.removeListener('terminal-incoming', handler) }
  },
  sendTerminalData: (data: string): void => {
    ipcRenderer.send('terminal-outgoing', data)
  },
  // Inside preload/index.ts api object:
  resizeTerminal: (dimensions: { cols: number; rows: number }): void => {
    ipcRenderer.send('terminal-resize', dimensions)
  },
  readDirectory: (path: string) => {
    return ipcRenderer.invoke("read-directory", path)
  },

  selectDirectory: () => {
    return ipcRenderer.invoke("select-directory")
  },
  readFile: (path: string) => {
    return ipcRenderer.invoke("read-file", path);
  },
  triggerOSNotification: (title: string, body: string): void => {
    ipcRenderer.send('trigger-os-notification', { title, body })
  },
  focusAppWindow: (): void => {
    ipcRenderer.send('focus-app-window')
  },
  setAlwaysOnTop: (flag: boolean): void => {
    ipcRenderer.send('set-always-on-top', flag)
  },
  // Main-process push of a live honeypot intrusion. Fires even when the window is
  // minimized / hidden to tray, where the renderer's own poll is throttled.
  onIntrusionAlert: (callback: (log: unknown) => void) => {
    const handler = (_: any, log: unknown): void => { callback(log) }
    ipcRenderer.on('intrusion-alert', handler)
    return () => { ipcRenderer.removeListener('intrusion-alert', handler) }
  },
  onIntrusionAction: (callback: (event: { action: 'view' | 'block'; ip: string }) => void) => {
    const handler = (_: any, event: { action: 'view' | 'block'; ip: string }): void => { callback(event) }
    ipcRenderer.on('intrusion-action', handler)
    return () => { ipcRenderer.removeListener('intrusion-action', handler) }
  },

  getAutostartStatus: (): Promise<boolean> => {
    return ipcRenderer.invoke('get-autostart-status')
  },
  setAutostartStatus: (enable: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('set-autostart-status', enable)
  }
}
// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Error exposing APIs in preload:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}


