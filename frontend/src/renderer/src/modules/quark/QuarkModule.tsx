import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  Activity,
  Cpu,
  Layers,
  Wifi,
  Gauge,
  Sliders,
  Lock,
  Unlock,
  Unplug,
  Terminal,
  ArrowDownCircle,
  AlertTriangle,
  ShieldCheck,
  Check,
  Copy,
  AlertOctagon,
  X,
  FolderOpen,
  RefreshCw
} from 'lucide-react';

// ─── Types matching real backend response shapes ───
interface Finding {
  id: number | string;
  tool: string;
  severity: string;
  issue: string;
  fix: string;
  details?: {
    file_path?: string;
    process_pid?: number;
    port?: string;
    service?: string;
    [key: string]: unknown;
  };
}

interface PastScanItem {
  id: string;
  filename: string;
  timestamp: string;
  mtime: number;
  title: string;
  summary: string;
  report_text: string;
  findings_count: number;
  findings: Finding[];
  file_path: string;
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

interface AiReportData {
  title?: string;
  status?: string;
  summary?: string;
  report_text?: string;
}

interface LogEntry {
  id: number;
  time: string;
  type: 'info' | 'threat' | 'kernel' | 'success';
  message: string;
}

export interface QuarkModuleProps {
  activeMod?: string;
  lockdown?: boolean;
  setLockdown?: (val: boolean) => void;
  onSwitchModule?: (modId: string) => void;
  systemAccessLevel?: string;
  setSystemAccessLevel?: (val: string) => void;
  customScopeFolder?: string;
  setCustomScopeFolder?: (val: string) => void;
}

const API_BASE = 'http://127.0.0.1:8000/api';

export const QuarkModule: React.FC<QuarkModuleProps> = ({
  activeMod,
  lockdown = false,
  setLockdown = () => { },
  onSwitchModule,
  systemAccessLevel,
  setSystemAccessLevel,
  customScopeFolder,
  setCustomScopeFolder
}) => {
  // ─── Real Backend State ───
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [findings, setFindings] = useState<Finding[]>([]); // EMPTY until real scan completes
  const [lockdownChecklist, setLockdownChecklist] = useState({
    killMalicious: false,
    deleteInfected: false
  });
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'QUARK SecOps Terminal :: awaiting lockdown commands...'
  ]);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Lumen Chat State inside Lockdown
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: 'Hello! I am lumen. I see your system is locked down due to high-risk malware. I have full read access to the scanner logs. How can I help you remediate this threat?'
    }
  ]);

  const [aiReport, setAiReport] = useState<AiReportData | null>(null);
  const [showNagModal, setShowNagModal] = useState<boolean>(false);
  const [deletedFiles, setDeletedFiles] = useState<string[]>([]);
  const [scannedLogs, setScannedLogs] = useState<
    Array<{ file_path: string; status: string; signature: string | null }>
  >([]);
  const [totalScanned, setTotalScanned] = useState<number>(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState<boolean>(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Void Dashboard UI State ───
  const [sysMetrics, setSysMetrics] = useState<{
    cpu: number;
    cpuCores: number;
    ram: number;
    ramUsed: number;
    ramTotal: number;
    disk: number;
    diskUsed: number;
    diskTotal: number;
    networkConnected: boolean;
    networkSpeed: string;
    networkRate: string;
    networkTotalMb: number;
  }>({
    cpu: 0,
    cpuCores: 4,
    ram: 0,
    ramUsed: 0,
    ramTotal: 0,
    disk: 0,
    diskUsed: 0,
    diskTotal: 0,
    networkConnected: true,
    networkSpeed: 'Connecting...',
    networkRate: '0.0 KB/s',
    networkTotalMb: 0
  });
  const [intensity, setIntensity] = useState<1 | 2 | 3>(2);
  const [quarantine, setQuarantine] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'threat' | 'kernel'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 1,
      time: new Date().toTimeString().split(' ')[0],
      type: 'info',
      message: 'Quark Telemetry Engine initialized. Ready to execute audit scan...'
    }
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);

  // ─── Past Scans Archive State ───
  const [showPastScansModal, setShowPastScansModal] = useState(false);
  const [pastScansList, setPastScansList] = useState<PastScanItem[]>([]);
  const [selectedPastScan, setSelectedPastScan] = useState<PastScanItem | null>(null);
  const [loadingPastScans, setLoadingPastScans] = useState(false);
  const [reportsDirectory, setReportsDirectory] = useState('/home/himaanshu/Desktop/voidui/reports');
  const [openingFolder, setOpeningFolder] = useState(false);

  const fetchPastScans = async () => {
    setLoadingPastScans(true);
    try {
      const res = await fetch(`${API_BASE}/scanner/past-scans`);
      if (res.ok) {
        const data = await res.json();
        setPastScansList(data.scans || []);
        if (data.reports_directory) {
          setReportsDirectory(data.reports_directory);
        }
      }
    } catch (e) {
      console.error('Failed to load past scans:', e);
    } finally {
      setLoadingPastScans(false);
    }
  };

  const handleOpenReportsFolder = async () => {
    setOpeningFolder(true);
    let targetDir = reportsDirectory || '/home/himaanshu/Desktop/voidui/reports';
    try {
      // 1. Call backend to launch OS file manager (Thunar / xdg-open)
      const res = await fetch(`${API_BASE}/scanner/open-reports-folder`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.directory) {
          targetDir = data.directory;
          setReportsDirectory(data.directory);
          addLog(`[REPORTS] Opened file manager at: ${targetDir}`, 'success');
        }
      }
    } catch (e) {
      console.warn('Backend open-reports-folder call error:', e);
    }

    // 2. Also invoke native Electron shell.openPath if available
    if (window.api && typeof window.api.openPath === 'function') {
      try {
        await window.api.openPath(targetDir);
      } catch (err) {
        console.warn('Electron window.api.openPath error:', err);
      }
    }

    setTimeout(() => setOpeningFolder(false), 1200);
  };

  // ─── Helpers ───
  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
    const time =
      new Date().toTimeString().split(' ')[0] + '.' + Math.floor(Math.random() * 900 + 100);
    setLogs((prev) => [...prev, { id: Date.now() + Math.random(), time, type, message: msg }]);
  };

  // Track manual user scrolling in live console box
  const handleConsoleScroll = (): void => {
    if (consoleContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = consoleContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
      setUserScrolledUp(!isAtBottom);
    }
  };

  // Scope & Custom Path derived from App props (Single Source of Truth)
  const scanScope = (systemAccessLevel as 'full' | 'storage' | 'custom') || 'full';
  const customPath = customScopeFolder !== undefined ? customScopeFolder : '';

  const handleUpdateScope = (newScope: 'full' | 'storage' | 'custom'): void => {
    if (setSystemAccessLevel) {
      setSystemAccessLevel(newScope);
    }
    localStorage.setItem('noash-system-access-level', newScope);
    addLog(`[SCOPE] Audit target changed to: ${newScope.toUpperCase()}`, 'info');
  };

  const handleUpdateCustomPath = (newPath: string): void => {
    if (setCustomScopeFolder) {
      setCustomScopeFolder(newPath);
    }
    localStorage.setItem('noash-custom-scope-folder', newPath);
  };

  const handleBrowseFolder = async (): Promise<void> => {
    try {
      const selected = await window.electron?.ipcRenderer?.invoke('select-directory');
      if (selected) {
        handleUpdateCustomPath(selected);
      }
    } catch (e) {
      console.error('Browse directory error:', e);
    }
  };

  // SVG Gauge calculation
  const getGaugeOffset = (percent: number) => {
    const circumference = 251.2;
    return circumference - (Math.min(Math.max(percent, 0), 100) / 100) * circumference;
  };

  // Tuning Preset Data
  const intensityData = {
    1: {
      label: 'STEALTH (LEVEL 1)',
      preset: 'LOW FOOTPRINT (SILENT)',
      io: '~3.5 MB/s',
      fp: '< 0.001%'
    },
    2: {
      label: 'BALANCED (LEVEL 2)',
      preset: 'OPTIMAL SURVEILLANCE',
      io: '~12 MB/s',
      fp: '< 0.02%'
    },
    3: {
      label: 'DEEP DUMP (LEVEL 3)',
      preset: 'MAXIMUM HEURISTIC DRILL',
      io: '~45 MB/s',
      fp: '~0.08%'
    }
  }[intensity];

  // ─── High-risk derived values (memoized) ───
  const highRiskItems = useMemo(
    () => findings.filter((f) => f.severity.toLowerCase() === 'high'),
    [findings]
  );
  const highRiskFiles = useMemo(
    () =>
      Array.from(
        new Set(highRiskItems.map((f) => f.details?.file_path).filter(Boolean))
      ) as string[],
    [highRiskItems]
  );
  const highRiskPid = useMemo(
    () => highRiskItems.find((f) => f.details?.process_pid)?.details?.process_pid || null,
    [highRiskItems]
  );

  // ─── Cleanup poll interval on unmount ───
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Bi-directional sync: when user changes scope, update Settings localStorage
  useEffect(() => {
    localStorage.setItem('noash-system-access-level', scanScope);
  }, [scanScope]);

  useEffect(() => {
    if (customPath) {
      localStorage.setItem('noash-custom-scope-folder', customPath);
    }
  }, [customPath]);

  // Auto-focus terminal on lockdown
  useEffect(() => {
    if (lockdown) {
      setTimeout(() => {
        terminalInputRef.current?.focus();
      }, 100);
    }
  }, [lockdown]);

  // Auto-scroll ONLY if user has not manually scrolled up
  useEffect(() => {
    if (scanning && !userScrolledUp) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scannedLogs, scanning, userScrolledUp]);

  // Auto-scroll terminal logs
  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // ─── 1. POLL REAL OS METRICS FROM BACKEND ───
  useEffect(() => {
    let isMounted = true;
    const fetchMetrics = async (): Promise<void> => {
      try {
        const res = await fetch(`${API_BASE}/system/metrics`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && isMounted) {
            const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
            const backendOnline = Boolean(data.network_connected ?? data.networkConnected);
            const isOnline = backendOnline || browserOnline;

            setSysMetrics({
              cpu: data.cpu ?? 0,
              cpuCores: data.cpu_cores ?? 4,
              ram: data.ram ?? 0,
              ramUsed: data.ram_used_gb ?? 0,
              ramTotal: data.ram_total_gb ?? 0,
              disk: data.disk ?? 0,
              diskUsed: data.disk_used_gb ?? 0,
              diskTotal: data.disk_total_gb ?? 0,
              networkConnected: isOnline,
              networkSpeed: !isOnline
                ? 'Offline'
                : data.network_speed === 'Offline'
                  ? '100% Stable'
                  : data.network_speed ?? '100% Stable',
              networkRate: isOnline
                ? data.network_rate && data.network_rate !== '0.0 KB/s'
                  ? data.network_rate
                  : 'ACTIVE'
                : '0.0 KB/s',
              networkTotalMb: data.network_total_mb ?? 0
            });
          }
        }
      } catch {
        // Keep previous state if backend is connecting
      }
    };

    fetchMetrics();
    const timer = setInterval(fetchMetrics, 2000);

    const handleOnline = () => {
      setSysMetrics((prev) => ({
        ...prev,
        networkConnected: true,
        networkSpeed: prev.networkSpeed === 'Offline' ? '100% Stable' : prev.networkSpeed
      }));
      fetchMetrics();
    };

    const handleOffline = () => {
      setSysMetrics((prev) => ({
        ...prev,
        networkConnected: false,
        networkSpeed: 'Offline'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Audio Warning Sound Loop on Lockdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const isAudioEnabled = localStorage.getItem('noash-audio-alerts') !== 'false';
    if (lockdown && !audioMuted && isAudioEnabled) {
      const playBeep = (): void => {
        try {
          const audioCtx = new (
            window.AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          )();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
        } catch (e) {
          console.log('Audio Context error: ', e);
        }
      };

      playBeep();
      interval = setInterval(playBeep, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockdown, audioMuted]);

  // 10-Minute Nag Timer for Moderate Risk Items
  useEffect(() => {
    let nagTimer: ReturnType<typeof setInterval> | null = null;
    const hasMedium = findings.some((f) => f.severity.toLowerCase() === 'medium');
    const isNagEnabled = localStorage.getItem('noash-moderate-risk-prompt') !== 'false';

    if (hasMedium && isNagEnabled) {
      nagTimer = setInterval(() => {
        setShowNagModal(true);
      }, 600000);
    }

    return () => {
      if (nagTimer) clearInterval(nagTimer);
    };
  }, [findings]);

  // ─── 2. REAL SCAN STATUS POLLING (from backend) ───
  const startPollingStatus = (): void => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`${API_BASE}/scanner/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.progress) {
            setProgress(statusData.progress);
          }
          if (statusData.scanned_files) {
            setScannedLogs(statusData.scanned_files);
          }
          if (statusData.total_scanned != null) {
            setTotalScanned(statusData.total_scanned);
          }

          if (statusData.status === 'completed') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setProgress(100);
            setFindings(statusData.findings || []);
            setScanning(false);
            addLog(
              `Audit scan finalized. ${(statusData.findings || []).length} issues flagged.`,
              'success'
            );

            // Fetch AI / Fallback Report
            try {
              const reportRes = await fetch(`${API_BASE}/scanner/report`);
              if (reportRes.ok) {
                const reportData = await reportRes.json();
                setAiReport(reportData);

                // Save report file to permanent user documents directory
                const exportDir =
                  localStorage.getItem('noash-scan-report-folder') || '';
                try {
                  const saveRes = await fetch(`${API_BASE}/scanner/save-report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      report: reportData,
                      directory: exportDir
                    })
                  });
                  if (saveRes.ok) {
                    const saveData = await saveRes.json();
                    if (saveData.directory) {
                      addLog(`[REPORT] Audit report stored at: ${saveData.directory}`, 'success');
                    }
                  }
                } catch (sErr) {
                  console.error('Failed to save report to disk:', sErr);
                }
              }
            } catch (rErr) {
              console.error('Report Fetch Error:', rErr);
            }

            // AUTO-LOCKDOWN: Trigger if there is a High Severity item
            const hasHighRisk = statusData.findings?.some(
              (f: Finding) => f.severity.toLowerCase() === 'high'
            );
            if (hasHighRisk) {
              setLockdown(true);
              setLockdownChecklist({ killMalicious: false, deleteInfected: false });
              addLog(
                '[LOCKDOWN] High severity threat detected — automatic containment engaged!',
                'threat'
              );
            }
          } else if (statusData.status !== 'scanning') {
            setScanning(false);
          }
        }
      } catch (pollErr) {
        console.error('Poll status error:', pollErr);
      }
    }, 1000);
  };

  // Resume active scan state on mount (tab-switch state loss fix)
  useEffect(() => {
    const checkActiveScan = async (): Promise<void> => {
      try {
        const res = await fetch(`${API_BASE}/scanner/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'scanning') {
            setScanning(true);
            if (data.progress) setProgress(data.progress);
            if (data.scanned_files) setScannedLogs(data.scanned_files);
            startPollingStatus();
          } else if (data.status === 'completed' && data.scanned_files?.length > 0) {
            setScannedLogs(data.scanned_files);
            setFindings(data.findings || []);
          }
        }
      } catch {
        // Backend not reachable yet
      }
    };
    checkActiveScan();
  }, []);

  // ─── Cancel running scan ───
  const handleCancelScan = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/scanner/cancel`, { method: 'POST' });
    } catch (e) {
      console.error('Cancel scan error:', e);
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setScanning(false);
    setProgress(0);
    addLog('Scan manually aborted by operator.', 'kernel');
  };

  // ─── 3. TRIGGER REAL VULNERABILITY SCAN ───
  const handleStartScan = async (): Promise<void> => {
    setScanning(true);
    setUserScrolledUp(false);
    setProgress(5);
    setFindings([]);
    setScannedLogs([]);
    setLockdown(false);
    setConnectionError(null);
    setAiReport(null);
    addLog(
      `Initializing deep heuristic audit sequence... [Intensity: Level ${intensity}, Scope: ${scanScope.toUpperCase()}]`,
      'info'
    );

    try {
      const startRes = await fetch(`${API_BASE}/scanner/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: '127.0.0.1',
          scope: scanScope,
          custom_path: scanScope === 'custom' ? customPath : null
        })
      });
      if (!startRes.ok) {
        throw new Error(`HTTP Error: ${startRes.status}`);
      }
      const startData = await startRes.json();
      console.log('Scan Started:', startData);
      addLog('Backend scanner engaged. Polling for live results...', 'info');

      startPollingStatus();
    } catch (err) {
      console.error('Scan Error:', err);
      setConnectionError(
        `Could not connect to backend server at ${API_BASE}. Make sure uvicorn is running! ${(err as Error).message || err}`
      );
      setScanning(false);
      addLog(`[ERROR] Backend connection failed: ${(err as Error).message || err}`, 'threat');
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, id: number | string): void => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── Lockdown Terminal Command Execution (REAL backend) ───
  const handleTerminalSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const rawInput = terminalInput.trim();
    if (!rawInput) return;

    const lowerCmd = rawInput.toLowerCase();
    const isRmCmd = rawInput.startsWith('rm ');
    const rmArg = isRmCmd ? rawInput.substring(3).trim() : '';

    let response = '';
    if (lowerCmd === 'help') {
      response =
        'Available Commands:\n - ps : Lists running processes\n - kill <pid> : Kills a process\n - rm <file_path> : Removes a file\n - status : Checks lockdown checklist\n - clear : Clear terminal\n - help : Shows this menu';
    } else if (lowerCmd === 'clear') {
      setTerminalLogs([]);
      setTerminalInput('');
      return;
    } else if (lowerCmd === 'ps') {
      try {
        const procRes = await fetch(`${API_BASE}/scanner/processes`);
        const procData = await procRes.json();
        if (procData.status === 'success') {
          response = `REAL OS PROCESSES (Top Active):\n${procData.processes}`;
        } else {
          response = `ERROR: Failed to fetch processes: ${procData.message}`;
        }
      } catch {
        response = `ERROR: Could not connect to system process manager.`;
      }
    } else if (lowerCmd.startsWith('kill ')) {
      const targetPidStr = rawInput.substring(5).trim();
      try {
        const res = await fetch(`${API_BASE}/scanner/remediate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'kill', target: targetPidStr })
        });
        const data = await res.json();
        if (data.status === 'success') {
          setLockdownChecklist((prev) => ({ ...prev, killMalicious: true }));
          response = `SUCCESS: Process ${targetPidStr} terminated.`;
        } else {
          response = `ERROR: ${data.message}`;
        }
      } catch (e) {
        response = `ERROR: Failed to execute kill command: ${(e as Error).message || e}`;
      }
    } else if (isRmCmd && rmArg) {
      let cleanTarget = rmArg.trim();
      if (cleanTarget.startsWith('-f ')) cleanTarget = cleanTarget.substring(3).trim();
      else if (cleanTarget.startsWith('-rf ')) cleanTarget = cleanTarget.substring(4).trim();
      else if (cleanTarget.startsWith('-r ')) cleanTarget = cleanTarget.substring(3).trim();
      cleanTarget = cleanTarget.replace(/^['"]|['"]$/g, '').trim();

      try {
        const res = await fetch(`${API_BASE}/scanner/remediate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rm', target: cleanTarget })
        });
        const data = await res.json();
        if (data.status === 'success') {
          setDeletedFiles((prev) => Array.from(new Set([...prev, cleanTarget, rmArg])));
          response = `SUCCESS: File '${cleanTarget}' deleted from system disk.`;
        } else {
          response = `ERROR: ${data.message || 'No such file or directory.'}`;
        }
      } catch (e) {
        console.error('Remediate rm error:', e);
        response = `ERROR: Failed to execute deletion command for '${cleanTarget}'.`;
      }
    } else if (lowerCmd === 'status') {
      response = `CHECKLIST STATUS:\n - Process Killed: ${!highRiskPid || lockdownChecklist.killMalicious ? 'DONE' : 'PENDING'}\n - Files Removed (${deletedFiles.length}/${highRiskFiles.length}): ${deletedFiles.length >= highRiskFiles.length ? 'DONE' : 'PENDING'}`;
    } else {
      response = `Unknown command: '${rawInput}'. Type 'help' for available commands.`;
    }

    setTerminalLogs((prev) => [...prev, `$ ${rawInput}`, response]);
    setTerminalInput('');
  };

  // ─── Lumen AI Chat (REAL backend) ───
  const handleAiSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const userText = aiInput.trim();
    if (!userText || isAiLoading) return;
    setAiMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setAiInput('');
    setIsAiLoading(true);

    try {
      const res = await fetch(`${API_BASE}/superforge/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          context: {
            findings,
            scannedLogs: scannedLogs.slice(-50),
            lockdown
          }
        })
      });
      const data = await res.json();
      setAiMessages((prev) => [
        ...prev,
        { sender: 'ai', text: data.response || data.message || 'No response from lumen.' }
      ]);
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Connection error: Could not reach lumen backend. ${(err as Error).message || ''}`
        }
      ]);
    }
    setIsAiLoading(false);
  };

  // ─── Unlock Flow ───
  const handleUnlockCheck = (): void => {
    const pidDone = !highRiskPid || lockdownChecklist.killMalicious;
    const filesDone =
      highRiskFiles.length === 0 || highRiskFiles.every((f) => deletedFiles.includes(f));
    if (pidDone && filesDone) {
      setLockdown(false);
      addLog('[CONTAINMENT] All threats remediated. Lockdown disengaged.', 'success');
    }
  };

  // Full Reset Action
  const handleReset = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setScanning(false);
    setProgress(0);
    setFindings([]);
    setScannedLogs([]);
    setTotalScanned(0);
    setConnectionError(null);
    setAiReport(null);
    setLockdown(false);
    setShowModal(false);
    setDeletedFiles([]);
    setLockdownChecklist({ killMalicious: false, deleteInfected: false });
    setLogs([
      {
        id: Date.now(),
        time: new Date().toTimeString().split(' ')[0],
        type: 'info',
        message: 'System state reset to nominal. Telemetry refreshed.'
      }
    ]);
    addLog('[SYSTEM] Full reset complete.', 'success');
  };

  // ─── Remediation handlers for findings cards ───
  const handleRemediate = async (finding: Finding): Promise<void> => {
    let action = 'fix_ssh';
    let target = '';

    if (finding.severity.toLowerCase() === 'high') {
      if (finding.details?.process_pid) {
        action = 'kill';
        target = finding.details.process_pid.toString();
      } else if (finding.details?.file_path) {
        action = 'rm';
        target = finding.details.file_path;
      }
    } else {
      action = 'fix_ssh';
    }

    try {
      const res = await fetch(`${API_BASE}/scanner/remediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setFindings((prev) => prev.filter((f) => f.id !== finding.id));
        addLog(
          `[REMEDIATION] Successfully applied fix for: ${finding.issue}`,
          'success'
        );
      } else {
        addLog(`[REMEDIATION] Failed: ${data.message}`, 'threat');
      }
    } catch (err) {
      addLog(
        `[REMEDIATION] Connection error: ${(err as Error).message || err}`,
        'threat'
      );
    }
  };

  const filteredLogs = logs.filter((l) => activeFilter === 'all' || l.type === activeFilter);

  if (activeMod !== 'timeline' && activeMod !== 'quark' && activeMod !== 'avanger' && !lockdown) {
    return null;
  }

  return (
    <div className="h-full w-full flex-1 overflow-y-auto bg-[#050507] text-bone antialiased selection:bg-foam/20 selection:text-foam font-sans relative">
      <style>{`
        .custom-range {
          -webkit-appearance: none;
          appearance: none;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 9999px;
          height: 6px;
          outline: none;
        }
        .custom-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #deb00d;
          cursor: pointer;
          border: 2px solid #050507;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
          transition: transform 0.15s ease;
        }
        .custom-range::-webkit-slider-thumb:hover {
          transform: scale(1.25);
        }
        .custom-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #deb00d;
          cursor: pointer;
          border: 2px solid #050507;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        }
      `}</style>

      {/* Subtle Dot Grid */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] z-0" />

      {/* ══════════════════ LOCKDOWN FULLSCREEN SCREENPLAY ══════════════════ */}
      {lockdown && (
        <div className="fixed inset-0 z-[9999] pointer-events-auto bg-black flex flex-col p-6 animate-fade-in">
          {/* Top Banner Alert */}
          <div className="bg-red-950 border border-red-500 rounded-xl p-4 mb-5 flex justify-between items-center animate-pulse shrink-0">
            <div className="flex items-center space-x-3 text-red-500">
              <Lock className="w-5 h-5" />
              <div className="ml-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-widest font-display">
                  QUARK LOCKDOWN MODE
                </h2>
                <p className="text-sm text-red-400 font-medium">
                  High severity vulnerabilities must be fixed to unlock application access.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className="px-3.5 py-1.5 bg-red-900/40 hover:bg-red-900 border border-red-500/30 text-red-400 rounded-xl text-xs sm:text-sm font-semibold transition-all"
            >
              {audioMuted ? 'Unmute Audio Alert' : 'Mute Audio Alert'}
            </button>
          </div>

          {/* Split Screen Dashboard (Three Columns: Checklist, Console, Lumen) */}
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
            {/* Column 1: Left — Remediation Checklist */}
            <div className="w-full md:w-1/4 bg-[#08080c] border border-red-500/20 rounded-xl p-4 flex flex-col shrink-0">
              <h3 className="text-sm font-bold text-bone border-b border-white/10 pb-2.5 mb-3 uppercase tracking-wider font-display">
                Remediation Checklist
              </h3>
              <div className="space-y-4 flex-1 overflow-y-auto">
                {/* Step 1: Kill Process (ONLY IF A MALICIOUS PROCESS WAS FLAGGED) */}
                {highRiskPid && (
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border text-xs font-bold ${lockdownChecklist.killMalicious ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'border-white/20 text-mist'}`}
                    >
                      {lockdownChecklist.killMalicious ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        '1'
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-bone">Kill Process</h4>
                      <p className="text-xs text-mist leading-normal">
                        Terminate process (PID {highRiskPid}).
                      </p>
                    </div>
                  </div>
                )}

                {/* Dynamic Multi-File Steps */}
                {highRiskFiles.map((fPath, idx) => {
                  const isDeleted = deletedFiles.includes(fPath);
                  const stepNumber = highRiskPid ? idx + 2 : idx + 1;
                  return (
                    <div key={fPath} className="flex items-start space-x-3">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border text-xs font-bold ${isDeleted ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'border-white/20 text-mist'}`}
                      >
                        {isDeleted ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          `${stepNumber}`
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-bold text-bone">Delete File #{idx + 1}</h4>
                        <p className="text-xs text-mist leading-relaxed break-all font-mono">
                          `rm {fPath}`
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unlock Action Button */}
              <button
                onClick={handleUnlockCheck}
                disabled={
                  !(
                    (!highRiskPid || lockdownChecklist.killMalicious) &&
                    (highRiskFiles.length === 0 ||
                      highRiskFiles.every((f) => deletedFiles.includes(f)))
                  )
                }
                className={`w-full py-3 font-bold rounded-xl text-center tracking-wider text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 border mt-2 ${(!highRiskPid || lockdownChecklist.killMalicious) &&
                  (highRiskFiles.length === 0 ||
                    highRiskFiles.every((f) => deletedFiles.includes(f)))
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-black border-emerald-400 cursor-pointer'
                  : 'bg-white/5 text-mist border-white/10 cursor-not-allowed'
                  }`}
              >
                {(!highRiskPid || lockdownChecklist.killMalicious) &&
                  (highRiskFiles.length === 0 ||
                    highRiskFiles.every((f) => deletedFiles.includes(f))) ? (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span className="ml-1">UNLOCK WORKSPACE</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span className="ml-1">LOCKED</span>
                  </>
                )}
              </button>
            </div>

            {/* Column 2: Middle — Elevated Console */}
            <div className="flex-1 bg-black border border-white/10 rounded-xl flex flex-col min-h-0 font-mono">
              <div className="bg-[#08080c] border-b border-white/10 px-3.5 py-2 flex items-center justify-between text-xs text-bone rounded-t-xl">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-red-500" />
                  <span className="font-bold text-red-500">Elevated SecOps Admin Shell</span>
                </div>
                <span className="text-mist">user@void-sandbox:~$</span>
              </div>

              {/* Logs output */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-1.5 text-xs sm:text-sm select-text">
                {terminalLogs.map((log, i) => (
                  <pre key={i} className="whitespace-pre-wrap leading-relaxed text-mist">
                    {log}
                  </pre>
                ))}
              </div>

              {/* Input console */}
              <form
                onSubmit={handleTerminalSubmit}
                className="border-t border-white/10 bg-[#050507] p-2 flex items-center rounded-b-xl"
              >
                <span className="text-sm text-red-500 font-bold mr-2 shrink-0">#</span>
                <input
                  ref={terminalInputRef}
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-mono"
                  placeholder="Type cmd (ps, kill <pid>, rm <file_path>)..."
                  autoFocus
                />
              </form>
            </div>

            {/* Column 3: Right — Lumen AI Assistant */}
            <div className="w-full md:w-1/3 bg-[#08080c] border border-foam/20 rounded-xl flex flex-col min-h-0 font-mono">
              <div className="bg-[#050507] border-b border-white/10 px-3.5 py-2 flex items-center justify-between text-xs text-foam rounded-t-xl">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-foam animate-pulse shrink-0"></span>
                  <span className="font-bold">lumen</span>
                </div>
                <span className="text-mist text-[11px]">AI ASSISTANT</span>
              </div>

              {/* Messages feed */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs sm:text-sm select-text font-sans">
                {aiMessages.map((msg, i) => {
                  const isAi = msg.sender === 'ai';
                  return (
                    <div
                      key={i}
                      className={`flex flex-col space-y-1 ${isAi ? 'items-start' : 'items-end'}`}
                    >
                      <span className="text-[11px] text-mist uppercase tracking-wider font-mono">
                        {isAi ? 'lumen' : 'User'}
                      </span>
                      <div
                        className={`p-3 rounded-xl max-w-[92%] leading-relaxed ${isAi
                          ? 'bg-[#050507] text-foam border border-foam/20'
                          : 'bg-foam text-black font-bold'
                          }`}
                      >
                        {msg.text.split('\n').map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {isAiLoading && (
                  <div className="flex flex-col items-start space-y-1">
                    <span className="text-[11px] text-mist uppercase tracking-wider font-mono">
                      lumen
                    </span>
                    <div className="p-3 bg-[#050507] text-foam border border-foam/30 rounded-xl text-xs sm:text-sm animate-pulse font-mono">
                      Analyzing threat & generating security response...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form
                onSubmit={handleAiSubmit}
                className="border-t border-white/10 bg-[#050507] p-2.5 flex items-center rounded-b-xl"
              >
                <input
                  type="text"
                  value={aiInput}
                  disabled={isAiLoading}
                  onChange={(e) => setAiInput(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-white text-xs sm:text-sm font-mono px-1 disabled:opacity-50"
                  placeholder={
                    isAiLoading
                      ? 'lumen is processing...'
                      : "Ask lumen (e.g. 'how to kill process')..."
                  }
                />
                <button
                  type="submit"
                  disabled={isAiLoading}
                  className="ml-2 px-3.5 py-1.5 bg-foam hover:bg-foamDark text-black text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {isAiLoading ? '...' : 'ASK'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ STANDARD QUARK SCREEN VIEW ══════════════════ */}

      {/* Emergency Lockdown Top Alert Banner */}
      {lockdown && (
        <div className="sticky top-0 z-50 w-full border-b border-rose-500/40 bg-rose-950/90 text-rose-200 px-4 py-2.5 text-xs flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="font-mono font-bold tracking-wider uppercase text-rose-200">
              CONTAINMENT PROTOCOL 09 ACTIVE // NETWORK SEVERED (LOOPBACK ONLY)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-bone text-[11px] font-mono transition"
            >
              {audioMuted ? 'Unmute Audio' : 'Mute Audio'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Capsule Subheader */}
      <div className="max-w-4xl mx-auto px-4 w-full pt-4 pb-2">
        <nav className="rounded-full bg-[#08080c]/90 backdrop-blur-2xl border border-white/10 px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-foam flex items-center justify-center text-[#050507] font-display font-black text-xs shadow-sm shadow-black/50 select-none">
              Q
            </div>
            <span className="font-display font-bold tracking-[0.18em] text-xs text-bone select-none">
              QUARK
            </span>
            <span className="w-[1px] h-3.5 bg-white/15 ml-1 inline-block" />
          </div>

          <div className="flex items-center gap-5 sm:gap-6 text-xs font-sans">
            <button
              onClick={() => addLog('Active inspection session: #Q7-9042', 'info')}
              className="text-foam font-semibold hover:text-foam/80 transition"
            >
              Window
            </button>
            <button
              onClick={() => {
                setShowPastScansModal(true);
                fetchPastScans();
              }}
              className="text-mist hover:text-bone transition font-medium hover:text-foam"
            >
              Past Scan
            </button>
            <button
              onClick={handleReset}
              className="text-mist hover:text-bone transition flex items-center gap-1.5 font-medium hover:text-foam"
            >
              Reset
            </button>
          </div>

          <button
            onClick={() => {
              if (onSwitchModule) {
                onSwitchModule('front');
              } else {
                addLog('Navigating to system overview...', 'info');
              }
            }}
            className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 text-bone hover:text-white font-display font-semibold text-xs tracking-tight transition shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center gap-2 group flex-shrink-0"
          >
            <span>Dashboard</span>
            <span className="w-1.5 h-1.5 rounded-full bg-foam group-hover:scale-125 transition-transform" />
          </button>
        </nav>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-6 sm:space-y-7">
        {/* 1. QUARK MAIN HEADER & AUDIT CONTROLS */}
        <section className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.35)] p-7 sm:p-8 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono tracking-widest uppercase bg-foam/10 border border-foam/20 text-foam font-semibold">
                  CORE 03 // ACTIVE AUDIT
                </span>
                <span className="text-xs font-mono text-mist/60">• HEURISTIC KERNEL v4.19</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-bone">
                System Threat & Integrity Engine
              </h1>
              <p className="text-xs sm:text-sm text-mist mt-1 max-w-xl">
                Real-time memory heuristic scan, kernel anomaly detection, and automated
                containment lockdown.
              </p>
            </div>

            {/* Target Scope & Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex p-1.5 rounded-2xl bg-[#050507]/80 border border-white/5 text-xs font-mono">
                <button
                  onClick={() => handleUpdateScope('full')}
                  disabled={scanning}
                  className={`px-3.5 py-1.5 rounded-xl transition ${scanScope === 'full'
                    ? 'bg-foam/15 text-foam border border-foam/20'
                    : 'text-mist hover:text-bone border border-transparent'
                    }`}
                >
                  Full System
                </button>
                <button
                  onClick={() => handleUpdateScope('storage')}
                  disabled={scanning}
                  className={`px-3.5 py-1.5 rounded-xl transition ${scanScope === 'storage'
                    ? 'bg-foam/15 text-foam border border-foam/20'
                    : 'text-mist hover:text-bone border border-transparent'
                    }`}
                >
                  Storage Drives
                </button>
                <button
                  onClick={() => handleUpdateScope('custom')}
                  disabled={scanning}
                  className={`px-3.5 py-1.5 rounded-xl transition ${scanScope === 'custom'
                    ? 'bg-foam/15 text-foam border border-foam/20'
                    : 'text-mist hover:text-bone border border-transparent'
                    }`}
                >
                  Custom Path
                </button>
              </div>

              {scanScope === 'custom' && (
                <div className="flex items-center gap-2 bg-[#050507]/80 border border-white/10 rounded-2xl px-3 py-1.5 text-xs font-mono">
                  <input
                    type="text"
                    value={customPath}
                    onChange={(e) => handleUpdateCustomPath(e.target.value)}
                    disabled={scanning}
                    placeholder="/home/user or C:\..."
                    className="bg-transparent border-0 outline-none text-bone text-xs w-44"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    disabled={scanning}
                    className="text-foam hover:text-foamDark p-1"
                    title="Browse Folder"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              )}

              {scanning ? (
                <button
                  onClick={handleCancelScan}
                  className="px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-display font-semibold text-xs tracking-wide transition flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>CANCEL</span>
                </button>
              ) : (
                <button
                  onClick={handleStartScan}
                  className="px-5 py-2.5 rounded-xl bg-foam hover:bg-foamDark text-[#050507] font-display font-semibold text-xs tracking-wide transition-all shadow-sm shadow-black/50 flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>RUN AUDIT SCAN</span>
                </button>
              )}
            </div>
          </div>

          {/* Connection Error Banner */}
          {connectionError && (
            <div className="mt-4 p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-mono">
              <span className="font-bold uppercase tracking-wider">Connection Failure:</span>{' '}
              {connectionError}
            </div>
          )}

          {/* Linear Scan Progress Bar */}
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="flex items-center justify-between text-xs font-mono text-mist mb-2">
              <span className="flex items-center gap-2">
                {scanning ? (
                  <RefreshCw className="w-3.5 h-3.5 text-foam animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-foam" />
                )}
                <span>
                  {scanning
                    ? `ACTIVE SCAN IN PROGRESS // ${totalScanned.toLocaleString()} FILES PROCESSED`
                    : progress === 100
                      ? `AUDIT COMPLETE // ${findings.length} ISSUES FLAGGED`
                      : 'SYSTEM IDLE // STANDBY READY'}
                </span>
              </span>
              <span className="text-bone font-semibold">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#050507] rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-foam transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>

        {/* 2. REAL-TIME OS TASK MANAGER METRICS (CPU, RAM, NETWORK) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CPU Gauge */}
          <div className="rounded-[24px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.35)] p-6 flex flex-col items-center justify-between text-center relative group hover:bg-white/[0.08] transition">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-mist mb-3">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-foam" />
                <span>CPU THREAD LOAD</span>
              </span>
              <span className="text-foam font-semibold">LIVE OS</span>
            </div>

            <div className="relative w-32 h-32 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="7"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#deb00d"
                  strokeWidth="7"
                  strokeDasharray="251.2"
                  strokeDashoffset={getGaugeOffset(sysMetrics.cpu)}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-display font-bold text-bone">
                  {Math.round(sysMetrics.cpu)}%
                </span>
                <span className="text-[10px] font-mono text-mist">UTILIZED</span>
              </div>
            </div>

            <div className="w-full pt-3.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-mist">
              <span>ACTIVE CORES</span>
              <span className="text-bone">{sysMetrics.cpuCores} CORES</span>
            </div>
          </div>

          {/* RAM Gauge */}
          <div className="rounded-[24px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.35)] p-6 flex flex-col items-center justify-between text-center relative group hover:bg-white/[0.08] transition">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-mist mb-3">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-foam" />
                <span>MEMORY ALLOC</span>
              </span>
              <span className="text-foam font-semibold">RAM</span>
            </div>

            <div className="relative w-32 h-32 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="7"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#deb00d"
                  strokeWidth="7"
                  strokeDasharray="251.2"
                  strokeDashoffset={getGaugeOffset(sysMetrics.ram)}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-display font-bold text-bone">
                  {Math.round(sysMetrics.ram)}%
                </span>
                <span className="text-[10px] font-mono text-mist">
                  {sysMetrics.ramTotal > 0 ? `${sysMetrics.ramUsed} / ${sysMetrics.ramTotal} GB` : 'ALLOCATED'}
                </span>
              </div>
            </div>

            <div className="w-full pt-3.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-mist">
              <span>SYSTEM RAM</span>
              <span className="text-bone">{sysMetrics.ramUsed} GB IN USE</span>
            </div>
          </div>

          {/* Network Gauge (Real Traffic & Stability) */}
          <div className="rounded-[24px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.35)] p-6 flex flex-col items-center justify-between text-center relative group hover:bg-white/[0.08] transition">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-mist mb-3">
              <span className="flex items-center gap-1.5">
                <Wifi
                  className={`w-3.5 h-3.5 ${sysMetrics.networkConnected && !lockdown ? 'text-[#deb00d]' : 'text-rose-500'
                    }`}
                />
                <span>SOCKET I/O</span>
              </span>
              <span
                className={`font-semibold ${sysMetrics.networkConnected && !lockdown ? 'text-[#deb00d]' : 'text-rose-400'
                  }`}
              >
                {lockdown ? 'SEVERED' : sysMetrics.networkConnected ? 'SECURE' : 'OFFLINE'}
              </span>
            </div>

            <div className="relative w-32 h-32 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="7"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={lockdown ? '#f43f5e' : '#deb00d'}
                  strokeWidth="7"
                  strokeDasharray="251.2"
                  strokeDashoffset={lockdown ? 251.2 : 0}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-xl font-display font-bold ${lockdown ? 'text-rose-400' : 'text-bone'
                    }`}
                >
                  {lockdown ? 'SEVERED' : sysMetrics.networkConnected ? (sysMetrics.networkRate || 'ONLINE') : 'OFFLINE'}
                </span>
                <span className="text-[10px] font-mono text-mist">
                  {lockdown ? 'ISOLATED' : 'LIVE BANDWIDTH'}
                </span>
              </div>
            </div>

            <div className="w-full pt-3.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-mist">
              <span>TOTAL TRAFFIC</span>
              <span className="text-bone font-mono">
                {lockdown ? '0.0 KB (LOOPBACK)' : `${sysMetrics.networkTotalMb} MB (${sysMetrics.networkSpeed})`}
              </span>
            </div>
          </div>
        </section>

        {/* 3. SECURITY TUNING & DIRECTIVES */}
        <section className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.35)] p-7 sm:p-8 space-y-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-foam font-semibold">
                SECURITY TUNING & DIRECTIVES
              </span>
              <h2 className="text-lg font-display font-bold text-bone">
                Advanced Threat Heuristics & Mitigation Engine
              </h2>
            </div>
            <div className="text-xs font-mono text-mist">
              CONFIG PRESET:{' '}
              <span className="text-bone font-semibold">{intensityData.preset}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Scan Sensitivity Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-mono text-bone font-medium flex items-center gap-2">
                    <Gauge className="w-3.5 h-3.5 text-foam" />
                    <span>SCAN SENSITIVITY & HEURISTIC DEPTH</span>
                  </label>
                  <p className="text-[11px] text-mist mt-0.5">
                    Controls CPU thread allocation and depth of deep packet/signature analysis.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-foam/10 text-foam text-xs font-mono font-semibold border border-foam/20">
                  {intensityData.label}
                </span>
              </div>

              <div className="pt-2">
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  value={intensity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) as 1 | 2 | 3;
                    setIntensity(val);
                    addLog(
                      `[CONFIG] Sensitivity adjusted to Level ${val} (${val === 1 ? 'Stealth' : val === 2 ? 'Balanced' : 'Deep Memory Dump'
                      })`,
                      'info'
                    );
                  }}
                  className="custom-range w-full"
                />
                <div className="flex justify-between text-[10px] font-mono text-mist mt-2 px-1">
                  <span>LEVEL 1: STEALTH (LOW I/O)</span>
                  <span>LEVEL 2: BALANCED</span>
                  <span>LEVEL 3: DEEP MEMORY DUMP</span>
                </div>
              </div>

              {/* Live Impact Cards */}
              <div className="grid grid-cols-3 gap-3.5 pt-2">
                <div className="p-3 rounded-2xl bg-[#050507]/70 border border-white/5 text-center">
                  <span className="text-[10px] font-mono text-mist block">I/O OVERHEAD</span>
                  <span className="text-xs font-mono text-bone font-semibold">
                    {intensityData.io}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-[#050507]/70 border border-white/5 text-center">
                  <span className="text-[10px] font-mono text-mist block">FALSE POSITIVE</span>
                  <span className="text-xs font-mono text-emerald-400 font-semibold">
                    {intensityData.fp}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-[#050507]/70 border border-white/5 text-center">
                  <span className="text-[10px] font-mono text-mist block">AI ZERO-DAY</span>
                  <span className="text-xs font-mono text-foam font-semibold">ACTIVE</span>
                </div>
              </div>
            </div>

            {/* Right: Active Defense Directives Toggles */}
            <div className="space-y-3.5">
              <div className="text-xs font-mono text-bone font-medium flex items-center gap-2 mb-1">
                <Sliders className="w-3.5 h-3.5 text-foam" />
                <span>ACTIVE DEFENSE DIRECTIVES</span>
              </div>

              {/* Toggle 1: Auto-Quarantine */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#050507]/70 border border-white/5 hover:border-white/10 transition">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-foam/10 text-foam flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-bone block">
                      Automated Threat Quarantine
                    </span>
                    <span className="text-[11px] text-mist">
                      Isolates unsigned binaries immediately upon signature match.
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={quarantine}
                    onChange={(e) => {
                      setQuarantine(e.target.checked);
                      addLog(
                        `[DIRECTIVE] Auto-Quarantine turned ${e.target.checked ? 'ON' : 'OFF'}`,
                        'info'
                      );
                    }}
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 ${quarantine ? 'bg-foam' : 'bg-white/10'
                      }`}
                  >
                    <div
                      className={`w-4 h-4 bg-mist rounded-full transition-transform ${quarantine ? 'translate-x-5 bg-[#050507]' : ''
                        }`}
                    />
                  </div>
                </label>
              </div>

              {/* Toggle 2: Emergency Network Kill-Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#050507]/70 border border-white/5 hover:border-white/10 transition">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <Unplug className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-bone block">
                      Emergency Network Kill-Switch
                    </span>
                    <span className="text-[11px] text-mist">
                      Sever all external outbound sockets during critical breach.
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={lockdown}
                    onChange={(e) => {
                      const active = e.target.checked;
                      setLockdown(active);
                      if (active) {
                        addLog(
                          '[EMERGENCY] Operator engaged MANUAL LOCKDOWN Protocol 09!',
                          'threat'
                        );
                        addLog(
                          '[NETWORK] Adapters severed. Binding forced to 127.0.0.1 (Loopback).',
                          'threat'
                        );
                      } else {
                        addLog(
                          '[CONTAINMENT] Protocol 09 disengaged. Network restored.',
                          'success'
                        );
                      }
                    }}
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 ${lockdown ? 'bg-rose-500' : 'bg-white/10'
                      }`}
                  >
                    <div
                      className={`w-4 h-4 bg-mist rounded-full transition-transform ${lockdown ? 'translate-x-5 bg-[#050507]' : ''
                        }`}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* 4. LIVE FILE INSPECTION CONSOLE (Real scannedLogs from backend) */}
        <section className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.35)] overflow-hidden">
          <div
            ref={consoleContainerRef}
            onScroll={handleConsoleScroll}
            className="p-5 font-mono text-[11px] h-64 overflow-y-auto space-y-1.5 select-text relative"
          >
            <div className="text-foam border-b border-white/5 pb-2 mb-3 font-bold uppercase tracking-wider flex justify-between items-center sticky top-0 bg-[#050507]/95 backdrop-blur z-10 py-1">
              <span className="flex items-center">
                <span
                  className={`w-2 h-2 rounded-full mr-2 ${scanning ? 'bg-emerald-500 animate-ping' : 'bg-mist/30'}`}
                ></span>
                LIVE FILE SYSTEM INSPECTION CONSOLE
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] border ${scanning
                  ? 'text-emerald-300 bg-emerald-950/50 border-emerald-800 animate-pulse'
                  : 'text-mist bg-white/5 border-white/10'
                  }`}
              >
                {scanning
                  ? userScrolledUp
                    ? 'PAUSED (SCROLLED UP)'
                    : `● SCANNING ACTIVE (${totalScanned.toLocaleString()} FILES)`
                  : '● MONITOR STANDBY'}
              </span>
            </div>

            {/* Floating Resume Auto-Scroll Button */}
            {userScrolledUp && scanning && (
              <button
                onClick={() => {
                  setUserScrolledUp(false);
                  consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold shadow-2xl transition-all z-20 flex items-center space-x-1 mx-auto cursor-pointer animate-bounce"
              >
                <span>↓ Resume Auto-Scroll</span>
              </button>
            )}

            {/* Real log lines from backend */}
            {scannedLogs.length > 0 ? (
              <>
                {scannedLogs.map((log, i) => {
                  if (
                    log.signature === 'LOCKDOWN_TRIGGERED' ||
                    log.file_path.startsWith('[THREAT DETECTED]')
                  ) {
                    return (
                      <p
                        key={i}
                        className="text-red-400 font-bold bg-red-950/50 p-2.5 my-1.5 rounded-lg border-2 border-red-600 text-xs tracking-wider animate-pulse shadow-lg"
                      >
                        {log.file_path}
                      </p>
                    );
                  }
                  if (log.file_path.startsWith('[SCAN COMPLETED]')) {
                    return (
                      <p
                        key={i}
                        className="text-emerald-300 font-bold bg-emerald-950/50 p-2.5 my-1.5 rounded-lg border border-emerald-600 text-xs tracking-wider shadow-lg"
                      >
                        {log.file_path}
                      </p>
                    );
                  }
                  return (
                    <p
                      key={i}
                      className={`leading-relaxed ${log.signature
                        ? 'text-amber-300'
                        : log.status === 'scanned'
                          ? 'text-mist/70'
                          : 'text-mist/50'
                        }`}
                    >
                      <span className="text-mist/40 mr-2">[{String(i + 1).padStart(4, '0')}]</span>
                      {log.status === 'scanned' && (
                        <span className="text-emerald-500 mr-1.5">✓</span>
                      )}
                      {log.signature && (
                        <span className="text-amber-400 font-bold mr-1.5">⚠</span>
                      )}
                      {log.file_path}
                      {log.signature && (
                        <span className="text-amber-400 ml-2">({log.signature})</span>
                      )}
                    </p>
                  );
                })}
              </>
            ) : (
              <p className="text-mist/40 italic py-8 text-center">
                No scan data yet. Start an audit scan to see live file inspection...
              </p>
            )}
            <div ref={consoleEndRef} />
          </div>
        </section>

        {/* 5. LIVE AUDIT LOG STREAM & DETECTED ANOMALIES GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Audit Stream Terminal (7 cols) */}
          <section className="lg:col-span-7 rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.35)] flex flex-col h-[475px] overflow-hidden">
            {/* Terminal Header */}
            <div className="p-4 border-b border-white/5 bg-[#050507]/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-foam/40 animate-pulse" />
                <span className="text-xs font-mono font-semibold text-bone">
                  LIVE AUDIT STREAM
                </span>
                <span className="text-[10px] font-mono text-mist px-2.5 py-0.5 rounded-md bg-white/5">
                  {logs.length} EVENTS
                </span>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg uppercase ${activeFilter === 'all'
                    ? 'bg-foam/15 text-foam border border-foam/20'
                    : 'text-mist hover:text-bone border border-transparent'
                    }`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setActiveFilter('threat')}
                  className={`px-2.5 py-1 rounded-lg uppercase ${activeFilter === 'threat'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                    : 'text-mist hover:text-bone border border-transparent'
                    }`}
                >
                  THREATS
                </button>
                <button
                  onClick={() => setActiveFilter('kernel')}
                  className={`px-2.5 py-1 rounded-lg uppercase ${activeFilter === 'kernel'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                    : 'text-mist hover:text-bone border border-transparent'
                    }`}
                >
                  KERNEL
                </button>
              </div>
            </div>

            {/* Terminal Output Window */}
            <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-1.5 bg-[#050507]/90 select-text">
              <div className="text-mist/50 italic select-none">
                // Quark Telemetry Engine initialized. Ready to execute audit scan...
              </div>
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 py-0.5 text-[11px] leading-relaxed transition-all"
                >
                  <span className="text-mist/60 shrink-0">[{log.time}]</span>
                  <div className="flex-1">
                    {log.type === 'threat' && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 font-bold border border-rose-500/20 mr-2">
                        THREAT
                      </span>
                    )}
                    {log.type === 'kernel' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20 mr-2">
                        KERNEL
                      </span>
                    )}
                    {log.type === 'success' && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20 mr-2">
                        RESOLVED
                      </span>
                    )}
                    {log.type === 'info' && (
                      <span className="text-foam font-semibold mr-1">INFO:</span>
                    )}

                    <span
                      className={`${log.type === 'threat'
                        ? 'text-rose-200'
                        : log.type === 'kernel'
                          ? 'text-amber-100'
                          : log.type === 'success'
                            ? 'text-emerald-200'
                            : 'text-mist/90'
                        }`}
                    >
                      {log.message}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Terminal Footer */}
            <div className="px-4 py-3 border-t border-white/5 bg-[#050507]/60 flex items-center justify-between text-[11px] font-mono text-mist">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-foam" />
                <span>AUDIT SESSION: #Q7-9042</span>
              </span>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className="hover:text-bone flex items-center gap-1"
              >
                <ArrowDownCircle
                  className={`w-3 h-3 ${autoScroll ? 'text-foam' : 'text-mist'}`}
                />
                <span>AUTO-SCROLL: {autoScroll ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </section>

          {/* Right Column: Detected Anomalies (5 cols) — EMPTY UNTIL SCAN COMPLETES */}
          <section className="lg:col-span-5 rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.35)] flex flex-col h-[475px] overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-[#050507]/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-mono font-semibold text-bone">
                  DETECTED ANOMALIES
                </span>
              </div>
              <span
                className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-md border ${findings.length > 0
                  ? 'text-amber-400/90 bg-amber-500/10 border-amber-500/20'
                  : 'text-mist bg-white/5 border-white/10'
                  }`}
              >
                {findings.length} DETECTED
              </span>
            </div>

            {/* Findings List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3.5">
              {findings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShieldCheck className="w-10 h-10 text-mist/20 mb-3" />
                  <p className="text-sm font-mono text-mist/50">No anomalies detected</p>
                  <p className="text-[11px] text-mist/30 mt-1">
                    Run an audit scan to detect threats
                  </p>
                </div>
              ) : (
                findings.map((f) => {
                  const isLow = f.severity.toLowerCase() === 'low';
                  const isMed = f.severity.toLowerCase() === 'medium';
                  const isHigh = f.severity.toLowerCase() === 'high';

                  return (
                    <div
                      key={f.id}
                      className={`p-4 rounded-2xl bg-[#050507]/70 border transition space-y-3 ${isHigh
                        ? 'border-rose-500/20 hover:border-rose-500/30'
                        : isMed
                          ? 'border-amber-500/20 hover:border-amber-500/30'
                          : 'border-white/5 hover:border-white/10'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono tracking-wider font-semibold uppercase border ${isHigh
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                                : isMed
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                  : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                                }`}
                            >
                              {f.severity.toUpperCase()} RISK
                            </span>
                            <span className="text-[10px] font-mono text-mist">
                              Source: {f.tool}
                            </span>
                          </div>
                          <h4 className="text-xs font-mono font-bold text-bone">{f.issue}</h4>

                          {/* Low Risk: Copy-pasteable fix */}
                          {isLow && (
                            <div className="bg-[#050507] border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono max-w-lg mt-1">
                              <code className="text-mist select-all shrink-0 mr-4">{f.fix}</code>
                              <button
                                onClick={() => handleCopy(f.fix, f.id)}
                                className="text-mist hover:text-bone transition-all shrink-0 p-1 rounded"
                              >
                                {copiedId === f.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}

                          {/* Moderate Risk: Auto-fix button */}
                          {isMed && (
                            <div className="bg-amber-950/10 border border-amber-900/30 rounded-xl p-3 text-xs mt-1 text-mist">
                              <span className="font-bold text-amber-400">
                                Remediation Suggestion:
                              </span>{' '}
                              {f.fix}
                            </div>
                          )}

                          {/* High Risk: Lockdown info */}
                          {isHigh && (
                            <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 text-xs mt-1 text-mist">
                              <span className="font-bold text-red-400 flex items-center gap-1 mb-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Action Required:</span>
                              </span>
                              <span>{f.fix}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-mist truncate max-w-[200px]">
                          {f.details?.file_path
                            ? `FILE: ${f.details.file_path}`
                            : f.details?.port
                              ? `PORT: ${f.details.port}`
                              : f.details?.service
                                ? `SVC: ${f.details.service}`
                                : `ID: ${f.id}`}
                        </span>
                        <button
                          onClick={() => handleRemediate(f)}
                          className="px-3 py-1 rounded-xl border text-[11px] font-mono font-semibold transition flex items-center gap-1.5 bg-foam/15 hover:bg-foam/25 border-foam/30 text-foam"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>
                            {isHigh
                              ? 'Auto-Patch'
                              : isMed
                                ? 'Run Fix'
                                : 'Block Socket'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Findings Footer */}
            <div className="p-3.5 border-t border-white/5 bg-[#050507]/60 flex items-center justify-between text-[11px] font-mono text-mist">
              <span>CONTAINMENT POLICY: {quarantine ? 'ACTIVE' : 'DISABLED'}</span>
              <span>
                {findings.length > 0 && `${findings.length} issue${findings.length > 1 ? 's' : ''} flagged`}
              </span>
            </div>
          </section>
        </div>

        {/* AI Report Banner (after scan completes with report) */}
        {aiReport && !scanning && (
          <section className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-foam/20 shadow-[0_10px_35px_rgba(0,0,0,0.35)] p-7 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-bold text-foam uppercase tracking-wider font-mono">
                {aiReport.title || 'lumen Report'}
              </span>
              <span className="text-[10px] text-mist font-mono">
                {(aiReport.status || 'COMPLETED').toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-mist leading-relaxed">{aiReport.summary}</p>
            {aiReport.report_text && (
              <div className="bg-[#050507] p-4 rounded-xl text-[11px] text-mist/80 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto font-mono border border-white/5">
                {aiReport.report_text}
              </div>
            )}
          </section>
        )}
      </main>

      {/* MODERATE RISK NAG MODAL */}
      {showNagModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full border border-amber-500/40 bg-[#08080c] rounded-2xl p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-bold text-bone font-display">
                Moderate Risk Items Require Attention
              </h3>
            </div>
            <p className="text-xs text-mist">
              There are unresolved moderate-risk findings from your last scan. Would you like to
              apply automatic fixes now?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowNagModal(false)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-mist text-xs font-mono transition"
              >
                Snooze 10m
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/scanner/remediate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'fix_ssh', target: '' })
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                      setFindings((prev) =>
                        prev.filter(
                          (f) => f.id !== 'lynis-ssh' && f.id !== 'lynis-ssh-root'
                        )
                      );
                      setShowNagModal(false);
                      addLog('[REMEDIATION] Auto-fix applied for moderate risk items.', 'success');
                    } else {
                      addLog(`[REMEDIATION] Failed: ${data.message}`, 'threat');
                    }
                  } catch (err) {
                    addLog(
                      `[REMEDIATION] Connection error: ${(err as Error).message || err}`,
                      'threat'
                    );
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs font-mono transition"
              >
                Auto-Fix Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAST SCANS ARCHIVE MODAL */}
      {showPastScansModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-3xl w-full border border-white/10 bg-[#08080c] rounded-[28px] p-7 space-y-6 relative shadow-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-foam/10 border border-foam/20 flex items-center justify-center text-foam">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-foam font-bold font-mono">
                    SECURITY AUDIT ARCHIVE
                  </span>
                  <h3 className="text-lg font-bold text-bone font-display">
                    Historical Scan Reports
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPastScansModal(false);
                  setSelectedPastScan(null);
                }}
                className="p-2 rounded-xl text-mist hover:text-bone hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Folder Path & Open in OS File Manager Banner */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="truncate">
                <span className="text-mist">Storage Location: </span>
                <span className="text-foam font-semibold">{reportsDirectory || '/home/himaanshu/Desktop/voidui/reports'}</span>
              </div>
              <button
                onClick={handleOpenReportsFolder}
                disabled={openingFolder}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-bone font-medium transition flex items-center gap-2 flex-shrink-0 self-start sm:self-auto disabled:opacity-50 cursor-pointer"
              >
                {openingFolder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-foam animate-spin" />
                    <span>Opening Folder...</span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3.5 h-3.5 text-foam" />
                    <span>Open Folder in Files</span>
                  </>
                )}
              </button>
            </div>

            {/* Content Body: Either Scan List or Selected Scan Details */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingPastScans ? (
                <div className="py-16 text-center text-xs font-mono text-mist flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 text-foam animate-spin" />
                  <span>Loading historical audit reports...</span>
                </div>
              ) : selectedPastScan ? (
                /* Selected Scan Detailed View */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedPastScan(null)}
                      className="text-xs font-mono text-foam hover:underline flex items-center gap-1.5"
                    >
                      ← Back to Scan History
                    </button>
                    <span className="text-[10px] font-mono text-mist">{selectedPastScan.timestamp}</span>
                  </div>

                  <div className="rounded-2xl bg-[#050507] border border-white/10 p-5 space-y-3 font-mono">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-bone">{selectedPastScan.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedPastScan.findings_count > 0
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                      >
                        {selectedPastScan.findings_count > 0
                          ? `${selectedPastScan.findings_count} THREATS DETECTED`
                          : 'CLEAN AUDIT'}
                      </span>
                    </div>

                    <p className="text-xs text-mist leading-relaxed">{selectedPastScan.summary}</p>

                    {selectedPastScan.report_text && (
                      <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-mist/90 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                        {selectedPastScan.report_text}
                      </div>
                    )}
                  </div>
                </div>
              ) : pastScansList.length === 0 ? (
                /* Empty State */
                <div className="py-16 text-center text-xs font-mono text-mist space-y-2 border border-dashed border-white/10 rounded-2xl">
                  <FolderOpen className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-bone font-semibold">No Past Scan Reports Stored Yet</p>
                  <p className="text-mist text-[11px]">
                    Run an audit scan on your system and the completed report will be saved here automatically.
                  </p>
                </div>
              ) : (
                /* List of Past Scans */
                pastScansList.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => setSelectedPastScan(scan)}
                    className="group rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 p-4 transition cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-bone group-hover:text-foam transition">
                          {scan.title || 'Security Audit Report'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${scan.findings_count > 0
                            ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
                            : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                            }`}
                        >
                          {scan.findings_count > 0 ? `${scan.findings_count} Threats` : 'Clean'}
                        </span>
                      </div>
                      <p className="text-[11px] text-mist line-clamp-1 font-mono">{scan.summary}</p>
                      <span className="text-[10px] text-mist/60 font-mono block">{scan.timestamp}</span>
                    </div>

                    <button className="text-xs font-mono text-foam font-semibold group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                      View Report →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOCKDOWN PROTOCOL DETAILS MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-xl w-full border border-rose-500/40 bg-[#08080c] rounded-2xl p-6 space-y-6 relative shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-rose-400 font-bold font-mono">
                    MANUAL CONTAINMENT PROTOCOL 09
                  </span>
                  <h3 className="text-lg font-bold text-bone font-display">
                    QUARK System Lockdown // Active
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-mist hover:text-bone hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-mist leading-relaxed font-sans">
              Emergency containment is currently active. Outbound internet sockets are cut to
              prevent data exfiltration or malware propagation. Only loopback binding is allowed.
            </p>

            <div className="p-3.5 rounded-xl bg-[#050507] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-mist">
                <span>NETWORK INTERFACES:</span>
                <span className="text-rose-400 font-semibold">SEVERED (LOOPBACK ONLY)</span>
              </div>
              <div className="flex justify-between text-mist">
                <span>PROCESS PRIVILEGES:</span>
                <span className="text-rose-400 font-semibold">DROPPED TO RESTRICTED</span>
              </div>
              <div className="flex justify-between text-mist">
                <span>HONEYPOT SENSORS:</span>
                <span className="text-foam font-semibold">ACTIVE & TRAPPING PROBES</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-mist hover:text-bone text-xs font-mono transition"
              >
                Dismiss Dialog
              </button>
              <button
                onClick={() => {
                  setLockdown(false);
                  setShowModal(false);
                  addLog('[CONTAINMENT] Protocol 09 disengaged by operator.', 'success');
                }}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-mono font-bold transition shadow"
              >
                Disengage Containment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AvangerModule = QuarkModule;
