import { ElectronAPI } from '@electron-toolkit/preload'

export { }

declare global {
  interface Window {
    electron: ElectronAPI

    api: {
      onTerminalData:
      (callback: (data: string) => void) => void

      sendTerminalData:
      (data: string) => void

      resizeTerminal:
      (dimensions: {
        cols: number
        rows: number
      }) => void

      readDirectory:
      (path: string) => Promise<
        {
          name: string
          path: string
          isFolder: boolean
        }[]
      >

      selectDirectory:
      () => Promise<string | null>

      readFile:
      (path: string) => Promise<{
        path: string
        size: number
        content: string
        base64: string
      }>

      triggerOSNotification:
      (title: string, body: string) => void

      focusAppWindow:
      () => void

      setAlwaysOnTop?:
      (flag: boolean) => void

      getAutostartStatus?:
      () => Promise<boolean>

      setAutostartStatus?:
      (enable: boolean) => Promise<boolean>

      onIntrusionAlert?:
      (callback: (log: unknown) => void) => void

      onIntrusionAction?:
      (callback: (event: { action: 'view' | 'block'; ip: string }) => void) => void

      openPath?:
      (targetPath: string) => Promise<string>
    }
  }
}