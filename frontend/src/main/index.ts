import { app, shell, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } from 'electron'
import { join, dirname } from 'path'
import { exec, spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as pty from "node-pty";
import { readdir } from "fs/promises";
import { readFile, stat } from "fs/promises";

let mainWindow: BrowserWindow | null = null
let isLockdownActive = false
let tray: Tray | null = null
let isQuitting = false
let terminal: pty.IPty | null = null;
let intrusionWatcher: ReturnType<typeof setInterval> | null = null
let startedHidden = false
let backendProcess: ChildProcess | null = null

async function isBackendRunning(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:8000/status', { signal: AbortSignal.timeout(1000) })
    return res.ok
  } catch {
    return false
  }
}

function resolveBackendExecutable(): string | null {
  const binaryName = process.platform === 'win32' ? 'void-backend.exe' : 'void-backend'
  const fallbackBinaryName = process.platform === 'win32' ? 'noash-backend.exe' : 'noash-backend'
  const possiblePaths = [
    // Production packaged paths (extraResources bin/)
    join(process.resourcesPath, 'bin', 'void-backend', binaryName),
    join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'void-backend', binaryName),
    join(process.resourcesPath, 'bin', 'noash-backend', fallbackBinaryName),
    join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'noash-backend', fallbackBinaryName),
    // Local unpacked/dev paths
    join(app.getAppPath(), '..', 'backend', 'dist', 'void-backend', binaryName),
    join(__dirname, '..', '..', '..', 'backend', 'dist', 'void-backend', binaryName),
    join(__dirname, '..', '..', 'resources', 'bin', 'void-backend', binaryName),
    join(app.getAppPath(), '..', 'backend', 'dist', 'noash-backend', fallbackBinaryName),
    join(__dirname, '..', '..', '..', 'backend', 'dist', 'noash-backend', fallbackBinaryName),
    join(__dirname, '..', '..', 'resources', 'bin', 'noash-backend', fallbackBinaryName)
  ]

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p
    }
  }
  return null
}

async function startBackendService(): Promise<void> {
  const alreadyRunning = await isBackendRunning()
  if (alreadyRunning) {
    console.log('[Main] Backend service is already active on port 8000.')
    return
  }

  const backendExe = resolveBackendExecutable()
  if (backendExe) {
    console.log('[Main] Automatically launching backend binary from:', backendExe)
    try {
      backendProcess = spawn(backendExe, [], {
        cwd: dirname(backendExe),
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      backendProcess.unref()
      backendProcess.on('exit', (code, signal) => {
        console.log(`[Backend exit] code=${code} signal=${signal}`)
        backendProcess = null
      })
    } catch (err) {
      console.error('[Main] Failed to launch backend binary:', err)
    }
  } else {
    console.log('[Main] Backend binary not found on disk; assuming external/manual development backend.')
  }
}

function stopBackendService(): void {
  try {
    if (process.platform === 'win32') {
      exec('taskkill /IM void-backend.exe /F /T', () => { })
      exec('taskkill /IM noash-backend.exe /F /T', () => { })
    } else if (backendProcess && backendProcess.pid) {
      try {
        process.kill(-backendProcess.pid, 'SIGTERM')
      } catch {
        backendProcess.kill('SIGTERM')
      }
    }
  } catch (err) {
    console.error('[Main] Exception while terminating backend:', err)
  }
  backendProcess = null
}

// Prevent duplicate Electron processes from competing for the honeypot ports.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

function createTray(): void {
  try {
    if (tray) return
    tray = new Tray(icon)
    tray.setToolTip('VOID Deception Daemon & Security Studio')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'VOID Deception Daemon: ACTIVE',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open VOID Studio',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            if (!mainWindow.isVisible()) mainWindow.show()
            mainWindow.focus()
          }
        }
      },
      {
        label: 'Hide to Background Tray',
        click: () => {
          if (mainWindow) {
            mainWindow.hide()
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit VOID Completely',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])

    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        if (!mainWindow.isVisible()) mainWindow.show()
        mainWindow.focus()
      }
    })
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
  } catch (err) {
    console.error('[Main] Tray creation error:', err)
  }
}

function forceFocusAppWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  // 1. Un-hide / un-minimize
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()

  // 2. Windows foreground activation trick:
  // Toggle setAlwaysOnTop(true) briefly so Windows OS bypasses the foreground focus lock
  mainWindow.setAlwaysOnTop(true)
  mainWindow.show()
  mainWindow.focus()
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !isLockdownActive) {
      mainWindow.setAlwaysOnTop(false)
    }
  }, 400)

  // 3. Linux X11/Wayland Window Manager Activation
  if (process.platform === 'linux') {
    try {
      exec(
        'wmctrl -a "VOID Studio" 2>/dev/null || ' +
        'xdotool search --name "VOID Studio" windowactivate --sync windowraise 2>/dev/null || ' +
        'wmctrl -a "NO-ASH Studio" 2>/dev/null || ' +
        'xdotool search --name "NO-ASH Studio" windowactivate --sync windowraise 2>/dev/null',
        () => { }
      )
    } catch {
      // ignore if wmctrl/xdotool both unavailable
    }
  }

  // 4. macOS dock
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show()
  }

  // 5. Attention fallback: flash taskbar/urgency hint
  mainWindow.flashFrame(true)
}

function handleProtocolUrl(rawUrl: string): void {
  try {
    console.log('[Main] Protocol action received:', rawUrl)
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'void:' && parsed.protocol !== 'noash:') return

    const action = parsed.searchParams.get('action')
    const ip = parsed.searchParams.get('ip') || ''
    if ((action !== 'view' && action !== 'block') || !ip) return

    forceFocusAppWindow()
    mainWindow?.webContents.send('intrusion-action', { action, ip })
  } catch (error) {
    console.error('[Main] Invalid VOID action URL:', error)
  }
}

function createWindow(): void {
  // Create the browser window with custom frameless titlebar.
  mainWindow = new BrowserWindow({
    title: 'VOID Studio',
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // Keep the renderer's intrusion poll & modal alive while the window is
      // minimized / hidden to tray. Chromium otherwise throttles background
      // timers down to ~1/min, which delays the alert past the backend's
      // 60s gatekeeper hold.
      backgroundThrottling: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.setTitle('VOID Studio')
    if (!startedHidden) {
      forceFocusAppWindow()
    }
  })

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !startedHidden && !mainWindow.isVisible()) {
      forceFocusAppWindow()
    }
  }, 1200)

  // Keep a stable X11/WM window title. The renderer's document <title> ("NOASH
  // STUDIO // Desktop Application") would otherwise replace the window title, which
  // broke every `--name "NO-ASH"` window-raise lookup (both the Python backend and
  // the Electron fallback below searched for a hyphenated "NO-ASH" that never matched).
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault()
  })

  // Stop taskbar attention flashing once the user actually focuses the window
  mainWindow.on('focus', () => {
    mainWindow?.flashFrame(false)
  })

  // Prevent app from closing during active security lockdown or hide to tray when closing
  mainWindow.on('close', (e) => {
    if (isLockdownActive) {
      e.preventDefault()
      return
    }
    if (!isQuitting && tray && !tray.isDestroyed()) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    console.log(`[Renderer Console L${level}] ${message} (${sourceId}:${line})`)
  })
  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error(`[Renderer Fail Load] ${errorCode} - ${errorDescription}`)
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle("read-file", async (_, path: string) => {
  const buffer = await readFile(path);
  const info = await stat(path);

  return {
    path,
    size: info.size,
    content: buffer.toString("utf8"),
    base64: buffer.toString("base64")
  };
});

ipcMain.on('terminal-resize', (_, { cols, rows }: { cols: number; rows: number }) => {
  if (terminal && cols > 0 && rows > 0) {
    terminal.resize(cols, rows)
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  if (!gotTheLock) return

  // Automatically start background FastAPI backend if not already active
  await startBackendService()

  startedHidden = process.argv.includes('--background-daemon') ||
    app.getLoginItemSettings().wasOpenedAtLogin

  // Must match electron-builder.yml so Windows Action Center associates the toast
  // with the installed VOID application instead of the generic Electron runtime.
  electronApp.setAppUserModelId('com.void.studio')
  if (!app.isPackaged) {
    app.setAsDefaultProtocolClient('void', process.execPath, [join(__dirname, 'index.js')])
    app.setAsDefaultProtocolClient('noash', process.execPath, [join(__dirname, 'index.js')])
  } else {
    app.setAsDefaultProtocolClient('void')
    app.setAsDefaultProtocolClient('noash')
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Window controls for custom titlebar
  ipcMain.on('window-minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.on('window-close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close()
    }
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('set-always-on-top', (_, flag: boolean) => {
    if (mainWindow && !isLockdownActive) {
      mainWindow.setAlwaysOnTop(flag, 'normal')
      if (flag) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        if (!mainWindow.isVisible()) mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  // Cross-App System-Wide Desktop Notification Trigger
  ipcMain.on('trigger-os-notification', (_, { title, body }: { title: string; body: string }) => {
    try {
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: title || 'VOID Intrusion Alert',
          body: body || 'Attacker detected probing honeypot trap ports!',
          icon: process.platform === 'linux' ? icon : undefined
        })
        notif.on('click', () => {
          forceFocusAppWindow()
        })
        notif.show()
      }
    } catch (err) {
      console.error('[Main] OS Notification Error:', err)
    }
  })

  // Bring Window to Front
  ipcMain.on('focus-app-window', () => {
    forceFocusAppWindow()
  })

  // Listen for user home directory resolution
  ipcMain.handle('get-user-home', () => {
    return app.getPath('home')
  })

  // file tree reading
  ipcMain.handle("read-directory", async (_, path: string) => {
    const entries = await readdir(path);
    const result: {
      name: string;
      path: string;
      isFolder: boolean;
    }[] = [];
    for (const entry of entries) {
      const fullPath = join(path, entry);
      try {
        const info = await stat(fullPath).catch(() => null);
        if (!info) continue;
        result.push({
          name: entry,
          path: fullPath,
          isFolder: info.isDirectory()
        });
      } catch {
        // Skip entries that can't be stat'd (broken symlinks, permission denied)
      }
    }

    return result;
  });

  // Listen for directory selection from React settings
  ipcMain.handle('select-directory', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Scan Reports Folder'
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // Enterprise Native OS Autostart (Zero-script registry/autostart integration)
  ipcMain.handle('get-autostart-status', () => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('set-autostart-status', (_, enable: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: true,
      path: process.execPath,
      args: ['--background-daemon']
    })
    return app.getLoginItemSettings().openAtLogin
  })

  // Listen for security lockdown states from React frontend
  ipcMain.on('set-lockdown', (_, active: boolean) => {
    isLockdownActive = active
    if (mainWindow) {
      if (active) {
        mainWindow.setFullScreen(true)
        mainWindow.setAlwaysOnTop(true, 'normal')
        mainWindow.focus()
        mainWindow.setMinimizable(false)
        mainWindow.setClosable(false)
      } else {
        mainWindow.setFullScreen(false)
        mainWindow.setAlwaysOnTop(false)
        mainWindow.setMinimizable(true)
        mainWindow.setClosable(true)
      }
    }
  })

  createTray()
  createWindow()

  const initialProtocolUrl = process.argv.find((arg) => arg.startsWith('void://') || arg.startsWith('noash://'))
  if (initialProtocolUrl) {
    setTimeout(() => handleProtocolUrl(initialProtocolUrl), 500)
  }

  // --- MAIN-PROCESS INTRUSION WATCHER ---
  // The renderer's own poll gets background-throttled while VOID is minimized or
  // hidden to tray, and a packaged (file://) renderer is subject to CORS. The main
  // process is immune to both, so it owns the authoritative alert trigger: it raises
  // the window to the foreground and pushes the intrusion to the renderer so the
  // Global Intrusion Modal opens regardless of window state.
  const seenIntrusionIds = new Set<string>()

  const pollIntrusions = async (): Promise<void> => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/honeypot/logs')
      if (!res.ok) return
      const data = (await res.json()) as {
        status?: string
        logs?: Array<{
          id: string
          status: string
          attacker_ip?: string
          plain_english_summary?: string
        }>
      }

      if (data.status !== 'success' || !Array.isArray(data.logs)) return

      // Reset dedup memory when the backend log list is cleared
      if (data.logs.length === 0) {
        seenIntrusionIds.clear()
        return
      }

      const activeLog = data.logs.find((l) => l.status === 'active')
      if (!activeLog) return

      // Dedup first: only process new, unseen intrusions
      if (seenIntrusionIds.has(activeLog.id)) return
      seenIntrusionIds.add(activeLog.id)

      // The main process owns the OS toast so it still fires while the renderer
      // is hidden, minimized, or background-throttled behind another application.
      // Windows receives its actionable toast from the Python backend so the
      // BLOCK and VIEW & MANIPULATE buttons can invoke the action-handler URL.
      // Electron's Notification API is retained for Linux/macOS fallback.
      if (process.platform !== 'win32') {
        const notificationSupported = Notification.isSupported()
        console.log(`[Main] Intrusion ${activeLog.id}: Notification.isSupported()=${notificationSupported}`)
        if (notificationSupported) {
          try {
            const notification = new Notification({
              title: 'VOID CRITICAL INTRUSION ALERT',
              body: activeLog.plain_english_summary ||
                `Unauthorized probe from ${activeLog.attacker_ip || 'unknown IP'}`,
              silent: false,
              icon: process.platform === 'linux' ? icon : undefined
            })
            notification.on('click', () => forceFocusAppWindow())
            notification.show()
            console.log(`[Main] Intrusion ${activeLog.id}: native notification.show() called`)
          } catch (notificationError) {
            console.error('[Main] Native notification creation/show failed:', notificationError)
          }
        }
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.flashFrame(true)
        mainWindow.webContents.send('intrusion-alert', activeLog)
      }

    } catch {
      // Backend not up yet or transient network error — retry on the next tick.
    }
  }

  intrusionWatcher = setInterval(pollIntrusions, 1000)

  try {
    // 1. Spawn terminal process
    terminal = pty.spawn(
      process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash'),
      [],
      {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
        env: process.env as { [key: string]: string }
      }
    )
    console.log("[Main] Terminal spawned successfully");

    // 2. Send output from PTY to React window via IPC
    terminal.onData((data) => {
      console.log("[Main] PTY:", JSON.stringify(data));

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("terminal-incoming", data);
      }
    });
    terminal.onExit(({ exitCode, signal }) => {
      console.log(`[Main] Terminal exited: code=${exitCode} signal=${signal}`)
      terminal = null
    })
  } catch (err) {
    console.error('[Main] Failed to spawn terminal:', err)
  }

  ipcMain.on('terminal-outgoing', (_, data: string) => {
    console.log('[Main] Received keypress from React:', data)
    terminal?.write(data)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })

  app.on('second-instance', (_event, commandLine) => {
    console.log('[Main] second-instance commandLine:', JSON.stringify(commandLine))
    const protocolUrl = commandLine.find((arg) => arg.startsWith('void://') || arg.startsWith('noash://'))
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl)
      return
    }

    if (!mainWindow || mainWindow.isDestroyed()) return
    forceFocusAppWindow()
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleProtocolUrl(url)
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (intrusionWatcher) {
    clearInterval(intrusionWatcher)
    intrusionWatcher = null
  }
  stopBackendService()
})

app.on('will-quit', () => {
  stopBackendService()
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') {
    app.quit()
  }
})
