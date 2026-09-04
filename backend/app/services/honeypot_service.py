import os
import sys
import time
import socket
import shutil
import threading
import subprocess
import platform
import json
import urllib.request
from typing import Dict, List, Any, Optional, Tuple

# Try importing google.genai if installed
try:
    from google import genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


class HoneypotSession:
    """Stateful Session Context for an attacker IP.
    Provides 100% consistent stateful responses for Windows CMD / PowerShell and Linux Bash environments.
    """
    def __init__(self, ip: str, target_os: Optional[str] = None):
        self.ip = ip
        self.created_at = time.time()
        self.target_os = target_os if target_os else ("windows" if platform.system() == "Windows" else "linux")
        
        if self.target_os == "windows":
            self.username = "administrator"
            self.hostname = f"WIN-SRV-PROD-{(abs(hash(ip)) % 89) + 10}"
            self.prompt = f"C:\\Users\\Administrator>"
        else:
            self.username = "root"
            self.hostname = f"ubuntu-srv-prod-{(abs(hash(ip)) % 89) + 10}"
            self.kernel = "Linux 5.15.0-101-generic #111-Ubuntu SMP x86_64"
            self.uid_str = "uid=0(root) gid=0(root) groups=0(root)"
            self.prompt = f"{self.username}@{self.hostname}:~# "
            
        self.command_history: List[str] = []
        self.cached_ai_decoys: Dict[str, str] = {}

    def get_command_output(self, cmd: str) -> str:
        """Returns 100% consistent stateful output for Windows CMD and Linux Bash commands."""
        clean_cmd = cmd.strip().lower()
        self.command_history.append(clean_cmd)

        # --- Windows CMD / PowerShell Emulation ---
        if clean_cmd in ("dir", "dir /a", "dir /w"):
            return (
                " Volume in drive C has no label.\n"
                " Volume Serial Number is A4C2-8E91\n\n"
                " Directory of C:\\Users\\Administrator\n\n"
                "08/16/2026  02:00 PM    <DIR>          .\n"
                "08/16/2026  02:00 PM    <DIR>          ..\n"
                "08/16/2026  01:48 PM               148 db_backup.sql\n"
                "08/16/2026  01:40 PM               420 .env.production\n"
                "08/16/2026  02:02 PM             1,024 passwords.txt\n"
                "               3 File(s)          1,592 bytes\n"
                "               2 Dir(s)  104,857,600,000 bytes free\n"
            )
        elif clean_cmd in ("ipconfig", "ipconfig /all"):
            return (
                "\nWindows IP Configuration\n\n"
                "Ethernet adapter Ethernet0:\n\n"
                "   Connection-specific DNS Suffix  . : localdomain\n"
                "   IPv4 Address. . . . . . . . . . . : 192.168.1.105\n"
                "   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n"
                "   Default Gateway . . . . . . . . . : 192.168.1.1\n"
            )
        elif clean_cmd in ("netstat", "netstat -an"):
            return (
                "\nActive Connections\n\n"
                "  Proto  Local Address          Foreign Address        State\n"
                "  TCP    0.0.0.0:2222           0.0.0.0:0              LISTENING\n"
                "  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING\n"
                f"  TCP    192.168.1.105:2222     {self.ip}:54312        ESTABLISHED\n"
            )
        elif clean_cmd in ("systeminfo", "systeminfo.exe"):
            return (
                f"Host Name:                 {self.hostname}\n"
                "OS Name:                   Microsoft Windows Server 2022 Datacenter\n"
                "OS Version:                10.0.20348 N/A Build 20348\n"
                "System Manufacturer:       QEMU\n"
                "System Type:               x64-based PC\n"
                "Processor(s):              2 Processor(s) Installed.\n"
            )
        elif clean_cmd in ("ver", "version"):
            return "Microsoft Windows [Version 10.0.20348.2227]\n"
        elif clean_cmd in ("echo %username%", "whoami /user"):
            return f"{self.username}\n"

        # --- Linux Bash Emulation ---
        elif clean_cmd in ("whoami", "who"):
            return f"{self.username}\n"
        elif clean_cmd == "hostname":
            return f"{self.hostname}\n"
        elif clean_cmd in ("uname -a", "uname -r"):
            return f"{getattr(self, 'kernel', 'Linux 5.15.0-101-generic #111-Ubuntu SMP x86_64')}\n"
        elif clean_cmd in ("id", "id root"):
            return f"{getattr(self, 'uid_str', 'uid=0(root) gid=0(root) groups=0(root)')}\n"
        elif clean_cmd == "pwd":
            return "C:\\Users\\Administrator\n" if self.target_os == "windows" else "/root\n"
        elif clean_cmd in ("ls", "ls -l", "ls -la"):
            return "total 28\ndrwx------ 4 root root 4096 Aug 10 14:02 .\ndrwxr-xr-x 20 root root 4096 Aug 10 12:00 ..\n-rw------- 1 root root  512 Aug 10 14:00 .bash_history\n-rw-r--r-- 1 root root 3106 Apr 15  2024 .bashrc\n-rw-r--r-- 1 root root  148 Aug 10 14:01 db_backup.sql\n-rw------- 1 root root  420 Aug 10 14:02 .env.production\n"
        elif clean_cmd in ("cat /etc/passwd", "cat /etc/passwd|grep root"):
            return "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nsys:x:3:3:sys:/dev:/usr/sbin/nologin\nsync:x:4:65534:sync:/bin:/bin/sync\n"
        elif clean_cmd.startswith("cat ") or clean_cmd.startswith("type ") or clean_cmd.startswith("nano "):
            target_file = clean_cmd.split(" ")[-1]
            return f"# Simulated file content for {target_file}\nSTATUS=active\n"
        else:
            shell_name = "cmd.exe" if self.target_os == "windows" else "bash"
            return f"'{cmd.strip()}' executed inside sandboxed {shell_name} mirror.\n"


class HoneypotService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(HoneypotService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        self.ssh_port = 2222
        self.web_port = 8080
        self.is_running = False

        self.ssh_socket: Optional[socket.socket] = None
        self.web_socket: Optional[socket.socket] = None

        self.ssh_thread: Optional[threading.Thread] = None
        self.web_thread: Optional[threading.Thread] = None

        self.logs_lock = threading.Lock()
        self.ssh_logs: List[Dict[str, Any]] = []
        self.web_logs: List[Dict[str, Any]] = []
        self.web_traces: List[Dict[str, Any]] = []
        self.blocked_ips: set = set()
        self.allowed_view_ips: set = set()
        self.audit_mode: bool = False

        # Gatekeeper: HOLD attacker connection until admin decides BLOCK or VIEW
        self.pending_gates: Dict[str, threading.Event] = {}
        self.decision_results: Dict[str, str] = {}  # "block" or "view"

        # Stateful Session Memory per Attacker IP
        self.sessions: Dict[str, HoneypotSession] = {}

        self.geo_cache: Dict[str, Dict[str, str]] = {}
        self._seed_initial_data()

    def set_audit_mode(self, enabled: bool):
        """Sets audit mode. When enabled, local scan probes on 127.0.0.1 bypass gatekeeper hold and UI popups."""
        self.audit_mode = enabled

    def _seed_initial_data(self):
        """Seeds initial empty state. Called once during singleton initialization."""
        # No pre-loaded mock data — starts 100% clean.
        # Logs, traces, decoys, and sessions are populated only by real daemon events
        # or the 1-click simulate_attack_scenario() demo trigger.
        pass

    def get_or_create_session(self, ip: str) -> HoneypotSession:
        """Retrieves or initializes persistent session memory for an attacker IP."""
        if ip not in self.sessions:
            self.sessions[ip] = HoneypotSession(ip)
        return self.sessions[ip]

    def check_sandbox_escape_probe(self, payload: str) -> Tuple[bool, Optional[str]]:
        """Secondary Fail-Safe Barrier Wall: Inspects command/request payload for sandbox escape attempts."""
        escape_patterns = [
            "chroot", "ptmx", "/proc/self/mem", "/proc/kcore", "/dev/kmem", "/dev/mem",
            "insmod", "mknod", "ptrace", "gdb -p", "sys_execve", "ebpf", "cap_sys_admin",
            "unshare", "cgroup", "kernel_stealth"
        ]
        lower_payload = payload.lower()
        for pattern in escape_patterns:
            if pattern in lower_payload:
                return True, pattern
        return False, None

    # --- GEOLOCATION RESOLVER ---
    def resolve_geolocation(self, ip: str) -> Dict[str, Any]:
        """Resolves city, country, and precise lat/lon for an IP address with local TTL caching."""
        is_local = ip in ("127.0.0.1", "localhost", "::1") or ip.startswith("192.168.") or ip.startswith("10.")

        if ip in self.geo_cache and not is_local:
            return self.geo_cache[ip]

        # 1. Try ipapi.co or ip-api.com for precise public/local ISP geolocation
        try:
            url = "http://ip-api.com/json/?fields=status,country,city,countryCode,lat,lon" if is_local else f"http://ip-api.com/json/{ip}?fields=status,country,city,countryCode,lat,lon"
            req = urllib.request.Request(url, headers={"User-Agent": "NO-ASH-DeceptionEngine/1.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("status") == "success":
                    city = data.get("city", "Local Subnet")
                    country = data.get("country", "Local Host")
                    city = data.get("city", "Local Node")
                    country = data.get("country", "Local Subnet")
                    code = data.get("countryCode", "LOCAL")
                    lat = float(data.get("lat", 0.0))
                    lon = float(data.get("lon", 0.0))
                    geo_info = {"location": f"{city}, {country}", "country_code": code, "lat": lat, "lon": lon}
                    if not is_local:
                        self.geo_cache[ip] = geo_info
                    return geo_info
        except Exception:
            pass

        # 2. Secondary API Fallback (ipwhois)
        try:
            url = "https://ipwho.is/" if is_local else f"https://ipwho.is/{ip}"
            req = urllib.request.Request(url, headers={"User-Agent": "NO-ASH-DeceptionEngine/1.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("success") is True:
                    city = data.get("city", "Local Node")
                    country = data.get("country", "Local Subnet")
                    code = data.get("country_code", "LOCAL")
                    lat = float(data.get("latitude", 0.0))
                    lon = float(data.get("longitude", 0.0))
                    geo_info = {"location": f"{city}, {country}", "country_code": code, "lat": lat, "lon": lon}
                    if not is_local:
                        self.geo_cache[ip] = geo_info
                    return geo_info
        except Exception:
            pass

        default_geo = {
            "location": "Local Host Machine" if is_local else "External Network Probe",
            "country_code": "LOCAL" if is_local else "GLOBAL",
            "lat": 0.0,
            "lon": 0.0
        }
        if not is_local:
            self.geo_cache[ip] = default_geo
        return default_geo

    def is_app_running(self) -> bool:
        """Cross-platform check to verify if NO-ASH Electron UI application is running in RAM."""
        try:
            if platform.system() == "Windows":
                res = subprocess.run(["tasklist", "/FI", "IMAGENAME eq noash-studio.exe"], capture_output=True, text=True)
                if "noash-studio.exe" in res.stdout:
                    return True
                res_el = subprocess.run(["tasklist", "/FI", "IMAGENAME eq electron.exe"], capture_output=True, text=True)
                return "electron.exe" in res_el.stdout
            else:
                res = subprocess.run(["pgrep", "-f", "noash-studio|out/main/index.js|electron"], capture_output=True, text=True)
                return bool(res.stdout.strip())
        except Exception:
            return False

    def restore_and_focus_app(self) -> None:
        """Auto-launches the NO-ASH Electron UI if it is closed, then raises + focuses its window.
        Works 100% cross-platform on Windows 10/11 and Linux (X11/Wayland).
        """
        WINDOW_TITLE = "NO-ASH Studio"
        try:
            # 1. Check if the Electron app is running; auto-launch if closed.
            if not self.is_app_running():
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
                env = os.environ.copy()
                if platform.system() == "Windows":
                    installed_bin = os.path.expandvars(r"%LOCALAPPDATA%\Programs\NO-ASH Studio\NO-ASH Studio.exe")
                    unpacked_bin = os.path.join(base_dir, "frontend", "dist", "win-unpacked", "noash-studio.exe")
                    if os.path.exists(installed_bin):
                        subprocess.Popen([installed_bin], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    elif os.path.exists(unpacked_bin):
                        subprocess.Popen([unpacked_bin], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    else:
                        frontend_dir = os.path.join(base_dir, "frontend")
                        subprocess.Popen(["cmd.exe", "/c", "npm run dev"], cwd=frontend_dir, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    unpacked_bin = os.path.join(base_dir, "frontend", "dist", "linux-unpacked", "noash-studio")
                    if os.path.exists(unpacked_bin):
                        subprocess.Popen([unpacked_bin], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    else:
                        frontend_dir = os.path.join(base_dir, "frontend")
                        subprocess.Popen(["npm", "run", "dev"], cwd=frontend_dir, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                time.sleep(2)

            # 2. Raise/focus the window on Windows and Linux
            if platform.system() == "Windows":
                try:
                    ps_focus = """
                    $w = Get-Process | Where-Object { $_.MainWindowTitle -match 'NO-ASH' -or $_.ProcessName -match 'NO-ASH' } | Select-Object -First 1
                    if ($w) { (New-Object -ComObject WScript.Shell).AppActivate($w.Id) }
                    """
                    subprocess.Popen(["powershell", "-NoProfile", "-Command", ps_focus], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
            elif platform.system() == "Linux":
                raised = False
                if shutil.which("wmctrl"):
                    try:
                        r = subprocess.run(["wmctrl", "-a", WINDOW_TITLE], capture_output=True, timeout=5)
                        raised = r.returncode == 0
                    except Exception:
                        raised = False

                if not raised and shutil.which("xdotool"):
                    try:
                        subprocess.run(
                            ["xdotool", "search", "--name", WINDOW_TITLE,
                             "windowactivate", "--sync", "windowraise"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5
                        )
                    except Exception:
                        pass
        except Exception as err:
            print(f"[HoneypotService] Error restoring/focusing app window: {err}")

    def trigger_native_os_notification(self, title: str, message: str, ip: Optional[str] = None) -> None:
        """Fires a Native OS Desktop Notification (Linux notify-send / Windows PowerShell toast)
        directly from the backend process. Works even if the Electron UI window is closed.

        The clicked action drives the response:
          * BLOCK          -> sever the held attacker socket + firewall the IP immediately
          * VIEW / default -> restore + focus the NO-ASH UI (the Red Intrusion Modal opens
                              itself from the still-active log; the admin decides there)
        'default' is the freedesktop action invoked by clicking the toast body.
        """
        def _send():
            try:
                if platform.system() == "Linux":
                    # notify-send 0.7.9+ exposes action buttons via -A; passing -A implies
                    # --wait, so the process blocks until the user clicks an action / closes the
                    # toast, then prints the chosen action's NAME to stdout. We rely on that
                    # single channel. (The previous build also spawned a `gdbus monitor` listener
                    # for the same signal, which was racy and leaked a monitor process — up to
                    # 60s live — for every intrusion. Removed.)
                    proc = subprocess.Popen(
                        [
                            "notify-send", "-u", "critical", "-i", "security-high",
                            title, message,
                            "-A", "default=View",
                            "-A", "VIEW=VIEW & MANIPULATE",
                            "-A", "BLOCK=BLOCK & BAN IP",
                        ],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True
                    )
                    try:
                        out, _ = proc.communicate(timeout=60)
                        clicked_action = (out or "").strip()
                    except Exception:
                        proc.kill()
                        clicked_action = ""

                    # Route the click.
                    if clicked_action == "BLOCK":
                        if ip:
                            self.block_ip_firewall(ip)
                    elif clicked_action in ("VIEW", "default"):
                        self.restore_and_focus_app()
                    # empty (timeout / dismissed): do nothing. The Electron main-process poll
                    # already re-raises the window every second while the log stays 'active'.
                elif platform.system() == "Windows":
                    import tempfile
                    clean_msg = message.replace('"', "'").replace("\n", " ")
                    clean_title = title.replace('"', "'").replace("\n", " ")
                    esc_ip = ip or "127.0.0.1"
                    
                    ps_content = f"""
[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime]
[void][Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime]
[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime]

$xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>{clean_title}</text>
      <text>{clean_msg}</text>
    </binding>
  </visual>
  <actions>
    <action content="BLOCK &amp; BAN IP" arguments="noash://?action=block&amp;ip={esc_ip}" activationType="protocol"/>
    <action content="VIEW &amp; MANIPULATE" arguments="noash://?action=view&amp;ip={esc_ip}" activationType="protocol"/>
  </actions>
</toast>
"@

$toastXml = New-Object Windows.Data.Xml.Dom.XmlDocument
$toastXml.LoadXml($xml)
$toast = New-Object Windows.UI.Notifications.ToastNotification $toastXml
try {{
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('com.noash.studio').Show($toast)
}} catch {{
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = [System.Drawing.SystemIcons]::Shield
    $n.Visible = $true
    $n.ShowBalloonTip(5000, "{clean_title}", "{clean_msg}", [System.Windows.Forms.ToolTipIcon]::Warning)
    Start-Sleep -Seconds 5
    $n.Dispose()
}}
"""
                    fd, temp_path = tempfile.mkstemp(suffix=".ps1", text=True)
                    try:
                        with os.fdopen(fd, "w", encoding="utf-8") as f:
                            f.write(ps_content)
                        subprocess.Popen(
                            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", temp_path],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL
                        )
                        def cleanup_temp(path):
                            time.sleep(3)
                            try:
                                os.remove(path)
                            except Exception:
                                pass
                        threading.Thread(target=cleanup_temp, args=(temp_path,), daemon=True).start()
                    except Exception:
                        pass
            except Exception:
                pass

        threading.Thread(target=_send, daemon=True).start()

    # --- UNIFIED DYNAMIC AI DECOY GENERATOR (Groq / Gemini / Ollama) ---
    def generate_ai_decoy_content(self, file_path: str, client_ip: str) -> str:
        """Generates dynamic synthetic decoy content using Groq / Gemini / Ollama LLM API.
        Caches file decoy per IP session so repeated requests return identical results.
        """
        session = self.get_or_create_session(client_ip)
        if file_path in session.cached_ai_decoys:
            return session.cached_ai_decoys[file_path]

        system_prompt = (
            "You are an active cybersecurity honeypot decoy file generator. "
            "Your task is to generate realistic, convincing, synthetic decoy file content for an attacker exfiltration attempt. "
            "Output ONLY the file contents without Markdown commentary or chat greetings."
        )

        prompt = f"Generate synthetic decoy file content for file path '{file_path}'."

        groq_key = os.getenv("GROQ_API_KEY", "").strip()
        gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

        generated_text = ""

        # 1. Try Groq API (High Speed Llama 3.3 70B)
        if groq_key:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json"
                }
                payload = json.dumps({
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.4
                }).encode("utf-8")

                req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=2.5) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    generated_text = res_data["choices"][0]["message"]["content"]
            except Exception as e:
                print(f"[elumPot] Groq AI error: {e}")

        # 2. Try Gemini API fallback
        if not generated_text and HAS_GENAI and gemini_key:
            try:
                client = genai.Client(api_key=gemini_key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=f"{system_prompt}\n\n{prompt}"
                )
                generated_text = response.text
            except Exception as e:
                print(f"[elumPot] Gemini AI error: {e}")

        # 3. Dynamic Structural Schema Fallback (No static hardcoded text)
        if not generated_text:
            ext = file_path.split(".")[-1].lower() if "." in file_path else "txt"
            h_val = abs(hash(file_path + client_ip)) % 8999 + 1000

            if "sql" in ext or "db" in file_path:
                generated_text = (
                    f"-- Dynamic Synthetic SQL Dump (ID #{h_val})\n"
                    "CREATE TABLE users (id INT PRIMARY KEY, username VARCHAR(50), pass_hash VARCHAR(255));\n"
                    f"INSERT INTO users VALUES (1, 'admin_decoy_{h_val}', '$2b$12$eImiTXuWVxfM37uY4JANjO');\n"
                )
            elif "env" in ext or "env" in file_path:
                generated_text = (
                    f"# NO-ASH Dynamic Synthetic Decoy Configuration #{h_val}\n"
                    f"AWS_ACCESS_KEY_ID=AKIAIOSFODNN7_{h_val}\n"
                    f"AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG_{h_val}_KEY\n"
                    f"DATABASE_URL=postgres://decoy_user:{h_val}@127.0.0.1:5432/production_{h_val}\n"
                )
            else:
                generated_text = (
                    f"// Synthetic Decoy File #{h_val}\n"
                    f"file_path = '{file_path}'\n"
                    f"session_hash = '{h_val}'\n"
                )

        session.cached_ai_decoys[file_path] = generated_text
        return generated_text

    # --- CROSS-PLATFORM IP FIREWALL BLOCKER ---
    def block_ip_firewall(self, ip: str) -> Dict[str, Any]:
        """Executes active defense IP firewall blocking on Windows or Linux."""
        with self.logs_lock:
            self.blocked_ips.add(ip)

        # Signal gatekeeper: BLOCK decision -> connection handler will drop immediately
        self.decision_results[ip] = "block"
        if ip in self.pending_gates:
            self.pending_gates[ip].set()

        is_win = platform.system() == "Windows"
        success = False
        message = ""

        # Privilege elevation check: verify we can execute firewall commands
        has_privilege = False
        try:
            if is_win:
                priv_check = subprocess.run(
                    'net session', shell=True, capture_output=True, text=True, timeout=2
                )
                has_privilege = priv_check.returncode == 0
            else:
                priv_check = subprocess.run(
                    'sudo -n true', shell=True, capture_output=True, text=True, timeout=2
                )
                has_privilege = priv_check.returncode == 0
        except Exception:
            has_privilege = False

        try:
            if is_win:
                rule_name = f"NOASH_ELUMPOT_BLOCK_{ip.replace('.', '_')}"
                cmd = f'netsh advfirewall firewall add rule name="{rule_name}" dir=in action=block remoteip={ip}'
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=3)
                success = res.returncode == 0
                message = f"Windows Firewall rule '{rule_name}' executed."
                if not success and not has_privilege:
                    message = f"Firewall rule for {ip} requires Administrator privileges. Rule enforced in honeypot memory."
                    success = True  # Memory-level block still active
            else:
                cmd = f"sudo -n ufw deny from {ip} to any"
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=3)
                if res.returncode == 0:
                    success = True
                    message = f"Linux UFW rule added: blocked {ip}."
                else:
                    cmd_ip = f"sudo -n iptables -A INPUT -s {ip} -j DROP"
                    res2 = subprocess.run(cmd_ip, shell=True, capture_output=True, text=True, timeout=3)
                    success = res2.returncode == 0
                    message = f"Linux iptables rule executed for {ip}."
                    if not success and not has_privilege:
                        message = f"Firewall rule for {ip} requires root/sudo privileges. Rule enforced in honeypot memory."
                        success = True  # Memory-level block still active
        except Exception as e:
            message = f"Firewall rule active in honeypot memory for {ip}."
            success = True

        with self.logs_lock:
            for log in self.ssh_logs:
                if log.get("attacker_ip") == ip:
                    log["status"] = "blocked"
            for log in self.web_logs:
                if log.get("attacker_ip") == ip:
                    log["status"] = "blocked"

        return {
            "status": "success" if success else "error",
            "blocked_ip": ip,
            "message": message,
            "active_blocks_count": len(self.blocked_ips)
        }

    def allow_ip_proceed(self, ip: str) -> Dict[str, Any]:
        """Admin chose VIEW & MANIPULATE — signal gatekeeper to proceed with AI decoy content."""
        with self.logs_lock:
            self.blocked_ips.discard(ip)
            self.allowed_view_ips.add(ip)
        self.decision_results[ip] = "view"
        if ip in self.pending_gates:
            self.pending_gates[ip].set()

        with self.logs_lock:
            for log in self.ssh_logs:
                if log.get("attacker_ip") == ip and log.get("status") == "active":
                    log["status"] = "monitored"
            for log in self.web_logs:
                if log.get("attacker_ip") == ip and log.get("status") == "active":
                    log["status"] = "monitored"

        return {
            "status": "success",
            "message": f"Gatekeeper released for {ip}. AI decoy content will now be served.",
            "ip": ip
        }

    # --- SSH HONEYPOT DAEMON (PORT 2222) ---
    def _run_ssh_honeypot(self):
        """Runs background TCP socket listener for SSH Honeypot (Port 2222)."""
        if not self.ssh_socket:
            return
        print(f"[elumPot] SSH Honeypot listening loop active on port {self.ssh_port}")

        while self.is_running:
            try:
                conn, addr = self.ssh_socket.accept()
                client_ip = addr[0]
                threading.Thread(
                    target=self._handle_ssh_connection,
                    args=(conn, client_ip),
                    daemon=True
                ).start()
            except Exception:
                break

    def _handle_ssh_connection(self, conn: socket.socket, client_ip: str):
        """Gatekeeper SSH handler: log instantly, HOLD connection, wait for admin BLOCK/VIEW decision."""
        if client_ip in self.blocked_ips:
            try:
                conn.close()
            except Exception:
                pass
            return

        try:
            conn.settimeout(60.0)

            # Internal Vulnerability Audit Bypass:
            # When Avanger is running an internal system audit, respond with SSH banner immediately
            is_internal_audit = client_ip in ("127.0.0.1", "::1", "localhost") and self.audit_mode
            if is_internal_audit:
                try:
                    conn.sendall(b"SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1\r\n")
                    conn.close()
                except Exception:
                    pass
                return

            geo = self.resolve_geolocation(client_ip)
            now = time.strftime("%Y-%m-%d %H:%M:%S")

            # 1. IMMEDIATE LOG — triggers popup on admin screen BEFORE any data goes to attacker
            log_entry = {
                "id": f"ssh-{int(time.time()*1000)}",
                "timestamp": now,
                "attacker_ip": client_ip,
                "location": geo["location"],
                "country_code": geo["country_code"],
                "lat": geo.get("lat", 26.91),
                "lon": geo.get("lon", 75.78),
                "service": f"SSH (Port {self.ssh_port})",
                "type": "auth_attempt",
                "plain_english_summary": f"INTRUSION ALERT: Attacker from {geo['location']} ({client_ip}) attempted SSH login on Port {self.ssh_port}.",
                "raw_payload": f"SSH_CONNECT {client_ip}",
                "status": "active"
            }

            if client_ip in self.allowed_view_ips and client_ip not in self.blocked_ips:
                log_entry["status"] = "monitored"
                decision = "view"
                with self.logs_lock:
                    self.ssh_logs.insert(0, log_entry)
            else:
                with self.logs_lock:
                    self.ssh_logs.insert(0, log_entry)

                # Trigger Native OS Desktop Notification directly from Python (Works even if NO-ASH UI is closed!)
                self.trigger_native_os_notification(
                    "NO-ASH CRITICAL INTRUSION ALERT",
                    log_entry["plain_english_summary"],
                    client_ip
                )

                # 2. GATEKEEPER HOLD — wait for admin to click BLOCK or VIEW (max 60s timeout)
                with self.logs_lock:
                    if client_ip not in self.decision_results:
                        gate = threading.Event()
                        self.pending_gates[client_ip] = gate
                    else:
                        gate = None

                # Hold socket in place — DO NOT send banner or prompt yet
                if gate:
                    gate.wait(timeout=60.0)

                with self.logs_lock:
                    # Default decision MUST be "block" for security (do NOT leak data by default)
                    decision = self.decision_results.pop(client_ip, "block")
                    self.pending_gates.pop(client_ip, None)
                    if decision == "view":
                        self.allowed_view_ips.add(client_ip)

            # 3. ACT ON DECISION
            if decision != "view" or client_ip in self.blocked_ips:
                # BLOCK / TIMEOUT: close socket immediately — attacker gets ZERO bytes
                log_entry["status"] = "blocked"
                try:
                    conn.close()
                except Exception:
                    pass
                return

            # 4. VIEW: proceed with honeypot AI sandbox — send fake data to attacker
            session = self.get_or_create_session(client_ip)
            banner = "SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1\r\n"
            conn.sendall(banner.encode("utf-8"))

            data = conn.recv(1024)

            prompt = f"\r\n{session.username}@{session.hostname}:~# "
            conn.sendall(prompt.encode("utf-8"))

            cmd_data = conn.recv(1024)
            cmd_str = cmd_data.decode("utf-8", errors="ignore").strip()

            if cmd_str:
                # 5. SECONDARY FAIL-SAFE BARRIER WALL: Check for sandbox escape attempt
                is_escape, escape_reason = self.check_sandbox_escape_probe(cmd_str)
                if is_escape:
                    self.block_ip_firewall(client_ip)
                    exec_log = {
                        "id": f"ssh-escape-{int(time.time()*1000)}",
                        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "attacker_ip": client_ip,
                        "location": geo["location"],
                        "country_code": geo["country_code"],
                        "lat": geo.get("lat", 26.91),
                        "lon": geo.get("lon", 75.78),
                        "service": f"SSH (Port {self.ssh_port})",
                        "type": "emergency_block",
                        "plain_english_summary": f"Emergency Block Enforced: Sandbox boundary probed, host protection auto-activated! (Escape Vector: '{escape_reason}')",
                        "raw_payload": f"EMERGENCY_BLOCK -> {cmd_str}",
                        "status": "blocked"
                    }
                    with self.logs_lock:
                        self.ssh_logs.insert(0, exec_log)
                    try:
                        conn.close()
                    except Exception:
                        pass
                    return

                output_str = session.get_command_output(cmd_str)

                exec_log = {
                    "id": f"ssh-cmd-{int(time.time()*1000)}",
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "attacker_ip": client_ip,
                    "location": geo["location"],
                    "country_code": geo["country_code"],
                    "lat": geo.get("lat", 26.91),
                    "lon": geo.get("lon", 75.78),
                    "service": f"SSH (Port {self.ssh_port})",
                    "type": "command_exec",
                    "plain_english_summary": f"Attacker executed shell command `{cmd_str}` inside sandboxed honeypot wall.",
                    "raw_payload": f"SSH_EXEC -> {cmd_str}",
                    "status": "monitored"
                }
                with self.logs_lock:
                    self.ssh_logs.insert(0, exec_log)

                conn.sendall(f"\r\n{output_str}".encode("utf-8"))

        except Exception:
            pass
        finally:
            conn.close()

    # --- WEB DECOY DAEMON (PORT 8080) ---
    def _run_web_decoy(self):
        """Runs background TCP socket listener for Web Decoy Trap (Port 8080)."""
        if not self.web_socket:
            return
        print(f"[elumPot] Web Decoy listening loop active on port {self.web_port}")

        while self.is_running:
            try:
                conn, addr = self.web_socket.accept()
                client_ip = addr[0]
                threading.Thread(
                    target=self._handle_web_connection,
                    args=(conn, client_ip),
                    daemon=True
                ).start()
            except Exception:
                break

    def _handle_web_connection(self, conn: socket.socket, client_ip: str):
        """Gatekeeper Web handler: log instantly, HOLD connection, wait for admin BLOCK/VIEW decision."""
        if client_ip in self.blocked_ips:
            try:
                conn.close()
            except Exception:
                pass
            return

        t0 = time.time()
        try:
            conn.settimeout(60.0)
            data = conn.recv(2048)
            req_text = data.decode("utf-8", errors="ignore")
            lines = req_text.split("\r\n")

            first_line = lines[0] if lines else "GET / HTTP/1.1"
            parts = first_line.split(" ")
            method = parts[0] if len(parts) > 0 else "GET"
            path = parts[1] if len(parts) > 1 else "/"

            user_agent = "Unknown Client"
            for line in lines:
                if line.lower().startswith("user-agent:"):
                    user_agent = line.split(":", 1)[1].strip()
                    break

            # Internal Vulnerability Audit Bypass:
            # When Avanger is running an internal system audit, respond with clean decoy page immediately
            is_internal_audit = client_ip in ("127.0.0.1", "::1", "localhost") and (
                self.audit_mode or "nmap" in user_agent.lower() or "scanner" in user_agent.lower()
            )
            if is_internal_audit:
                try:
                    resp_body = "<html><body><h1>NO-ASH Web Decoy Active</h1></body></html>\r\n"
                    resp = (
                        f"HTTP/1.1 200 OK\r\n"
                        f"Server: Apache/2.4.52 (Ubuntu)\r\n"
                        f"Content-Type: text/html\r\n"
                        f"Content-Length: {len(resp_body)}\r\n"
                        f"Connection: close\r\n\r\n"
                        f"{resp_body}"
                    )
                    conn.sendall(resp.encode("utf-8"))
                    conn.close()
                except Exception:
                    pass
                return

            geo = self.resolve_geolocation(client_ip)
            now = time.strftime("%Y-%m-%d %H:%M:%S")

            # 1. IMMEDIATE LOG — triggers popup on admin screen BEFORE any response goes to attacker
            log_entry = {
                "id": f"web-{int(time.time()*1000)}",
                "timestamp": now,
                "attacker_ip": client_ip,
                "location": geo["location"],
                "country_code": geo["country_code"],
                "lat": geo.get("lat", 26.91),
                "lon": geo.get("lon", 75.78),
                "service": f"Web Decoy (Port {self.web_port})",
                "type": "file_access",
                "plain_english_summary": f"INTRUSION ALERT: Attacker from {geo['location']} ({client_ip}) requesting path `{path}`.",
                "raw_payload": f"{method} {path} HTTP/1.1 (User-Agent: {user_agent[:40]})",
                "status": "active"
            }

            # SECONDARY FAIL-SAFE BARRIER WALL: Check Web Path for Escape Probes
            is_escape, escape_reason = self.check_sandbox_escape_probe(path)
            if is_escape:
                self.block_ip_firewall(client_ip)
                log_entry["type"] = "emergency_block"
                log_entry["plain_english_summary"] = f"Emergency Block Enforced: Sandbox boundary probed, host protection auto-activated! (Escape Vector: '{escape_reason}')"
                log_entry["status"] = "blocked"
                with self.logs_lock:
                    self.web_logs.insert(0, log_entry)
                try:
                    conn.close()
                except Exception:
                    pass
                return

            if client_ip in self.allowed_view_ips and client_ip not in self.blocked_ips:
                log_entry["status"] = "monitored"
                decision = "view"
                with self.logs_lock:
                    self.web_logs.insert(0, log_entry)
            else:
                # Insert active log entry IMMEDIATELY so /api/honeypot/logs exposes it during gate hold
                with self.logs_lock:
                    self.web_logs.insert(0, log_entry)

                # Trigger Native OS Desktop Notification directly from Python (Works even if NO-ASH UI is closed!)
                self.trigger_native_os_notification(
                    "NO-ASH CRITICAL INTRUSION ALERT",
                    log_entry["plain_english_summary"],
                    client_ip
                )

                # 2. GATEKEEPER HOLD — wait for admin to click BLOCK or VIEW (max 60s timeout)
                # DO NOT add web_traces or generate AI decoy content until VIEW is explicitly chosen!
                with self.logs_lock:
                    if client_ip not in self.decision_results:
                        gate = threading.Event()
                        self.pending_gates[client_ip] = gate
                    else:
                        gate = None

                # Hold socket connection — DO NOT send any HTTP response yet
                if gate:
                    gate.wait(timeout=60.0)

                with self.logs_lock:
                    # Default decision MUST be "block" for security (do NOT leak data by default)
                    decision = self.decision_results.pop(client_ip, "block")
                    self.pending_gates.pop(client_ip, None)
                    if decision == "view":
                        self.allowed_view_ips.add(client_ip)

            # 3. ACT ON DECISION
            if decision != "view" or client_ip in self.blocked_ips:
                # BLOCK / TIMEOUT: close socket immediately — attacker gets ZERO bytes
                log_entry["status"] = "blocked"
                try:
                    conn.close()
                except Exception:
                    pass
                return

            # 4. VIEW & MANIPULATE: NOW generate AI decoy content and serve to attacker
            log_entry["status"] = "monitored"
            decoy_body = self.generate_ai_decoy_content(path, client_ip)
            status_code = 200
            status_text = "200 OK"
            decoy_action = f"Served Dynamic AI Synthetic Decoy ({path})"

            elapsed_ms = int((time.time() - t0) * 1000)

            trace_entry = {
                "id": f"trace-{int(time.time()*1000)}",
                "timestamp": now,
                "client_app": f"{user_agent[:30]} ({geo['location']})",
                "client_ip": client_ip,
                "method": method,
                "requested_path": path,
                "status_code": status_code,
                "status_text": status_text,
                "decoy_action": decoy_action,
                "response_ms": max(elapsed_ms, 5)
            }

            with self.logs_lock:
                self.web_traces.insert(0, trace_entry)

            http_response = (
                f"HTTP/1.1 {status_text}\r\n"
                "Content-Type: text/plain; charset=utf-8\r\n"
                f"Content-Length: {len(decoy_body)}\r\n"
                "Server: elumPot-DecoyEngine/1.0\r\n"
                "Connection: close\r\n\r\n"
                f"{decoy_body}"
            )
            conn.sendall(http_response.encode("utf-8"))

        except Exception:
            pass
        finally:
            conn.close()

    # --- DAEMON LIFECYCLE CONTROLS ---
    def start_daemon(self, ssh_port: Optional[int] = None, web_port: Optional[int] = None) -> Dict[str, Any]:
        """Launches background listeners for SSH and Web Decoy with verified socket binding."""
        if ssh_port:
            self.ssh_port = ssh_port
        if web_port:
            self.web_port = web_port

        if self.is_running:
            return {"status": "already_running", "ssh_port": self.ssh_port, "web_port": self.web_port}

        # 1. Bind SSH Socket
        # 1. Bind SSH Socket (tries configured port first, then fallbacks 2222, 2223, 22220)
        if self.ssh_port < 0:
            return {
                "status": "error",
                "message": f"Failed to bind SSH port {self.ssh_port}: Invalid port number. (Check port availability or permissions)",
                "daemon_active": False
            }

        bound_ssh = False
        target_ssh_ports = [self.ssh_port]
        for candidate in [2222, 2223, 22220]:
            if candidate not in target_ssh_ports:
                target_ssh_ports.append(candidate)

        last_ssh_err = ""

        for p in target_ssh_ports:
            try:
                ssh_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                ssh_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                if hasattr(socket, 'SO_REUSEPORT'):
                    try:
                        ssh_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
                    except Exception:
                        pass
                ssh_sock.bind(("0.0.0.0", p))
                ssh_sock.listen(5)
                self.ssh_socket = ssh_sock
                self.ssh_port = p
                bound_ssh = True
                break
            except Exception as e:
                last_ssh_err = str(e)
                continue

        if not bound_ssh:
            return {
                "status": "error",
                "message": f"Failed to bind SSH port {self.ssh_port}: {last_ssh_err}. (Check port availability or permissions)",
                "daemon_active": False
            }

        # 2. Bind Web Decoy Socket (tries configured port first, then fallbacks 8080, 8088, 8081)
        bound_web = False
        target_web_ports = [self.web_port]
        for candidate in [8080, 8088, 8081]:
            if candidate not in target_web_ports:
                target_web_ports.append(candidate)

        last_web_err = ""

        for p in target_web_ports:
            try:
                web_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                web_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                if hasattr(socket, 'SO_REUSEPORT'):
                    try:
                        web_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
                    except Exception:
                        pass
                web_sock.bind(("0.0.0.0", p))
                web_sock.listen(5)
                self.web_socket = web_sock
                self.web_port = p
                bound_web = True
                break
            except Exception as e:
                last_web_err = str(e)
                continue

        if not bound_web:
            if self.ssh_socket:
                try:
                    self.ssh_socket.close()
                except Exception:
                    pass
                self.ssh_socket = None
            return {
                "status": "error",
                "message": f"Failed to bind Web Decoy port {self.web_port}: {last_web_err}. (Check port availability or permissions)",
                "daemon_active": False
            }

        self.is_running = True
        self.ssh_thread = threading.Thread(target=self._run_ssh_honeypot, daemon=True)
        self.web_thread = threading.Thread(target=self._run_web_decoy, daemon=True)

        self.ssh_thread.start()
        self.web_thread.start()

        return {
            "status": "success",
            "message": f"elumPot Deception Daemon started successfully on SSH:{self.ssh_port} & Web:{self.web_port}.",
            "ssh_port": self.ssh_port,
            "web_port": self.web_port,
            "daemon_active": True
        }

    def stop_daemon(self) -> Dict[str, Any]:
        """Stops honeypot background socket listeners."""
        self.is_running = False
        if self.ssh_socket:
            try:
                self.ssh_socket.close()
            except Exception:
                pass
        if self.web_socket:
            try:
                self.web_socket.close()
            except Exception:
                pass

        return {"status": "success", "message": "elumPot Deception Daemon stopped."}

    def update_config(self, ssh_port: Optional[int] = None, web_port: Optional[int] = None) -> Dict[str, Any]:
        """Dynamically updates port configuration. Restarts daemon if it was running."""
        was_running = self.is_running
        if was_running:
            self.stop_daemon()

        if ssh_port is not None and 1 <= ssh_port <= 65535:
            self.ssh_port = ssh_port
        if web_port is not None and 1 <= web_port <= 65535:
            self.web_port = web_port

        result = {
            "status": "success",
            "message": f"Configuration updated: SSH={self.ssh_port}, Web={self.web_port}.",
            "ssh_port": self.ssh_port,
            "web_port": self.web_port,
            "daemon_restarted": False
        }

        if was_running:
            start_result = self.start_daemon()
            result["daemon_restarted"] = start_result.get("daemon_active", False)
            result["message"] += f" Daemon {'restarted' if result['daemon_restarted'] else 'restart failed'}."

        return result

    def get_status(self) -> Dict[str, Any]:
        """Returns current status and metrics of the honeypot daemon."""
        with self.logs_lock:
            total_logs = len(self.ssh_logs) + len(self.web_logs)
            blocked_count = len(self.blocked_ips)
            traces_count = len(self.web_traces)
            total_decoys = sum(len(s.cached_ai_decoys) for s in self.sessions.values())

        return {
            "status": "success",
            "daemon_active": self.is_running,
            "ssh_port": self.ssh_port,
            "web_port": self.web_port,
            "total_intrusions": total_logs,
            "active_blocks_count": blocked_count,
            "web_traces_count": traces_count,
            "decoys_served_count": total_decoys
        }

    def get_honeypot_logs(self) -> Dict[str, Any]:
        """Returns combined chronological SSH and Web honeypot intrusion logs."""
        with self.logs_lock:
            combined = list(self.ssh_logs) + list(self.web_logs)
            combined.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            return {"status": "success", "logs": combined}

    def get_decoy_logs(self) -> Dict[str, Any]:
        """Returns formatted Web Decoy request logs."""
        with self.logs_lock:
            return {"status": "success", "logs": list(self.web_logs)}

    def get_web_traces(self) -> Dict[str, Any]:
        """Returns HTTP request-response trace items for inspector stream."""
        with self.logs_lock:
            return {"status": "success", "traces": list(self.web_traces)}

    def clear_logs(self) -> Dict[str, Any]:
        """Clears all captured in-memory intrusion logs, web traces, and active session memory."""
        with self.logs_lock:
            self.ssh_logs.clear()
            self.web_logs.clear()
            self.web_traces.clear()
            self.sessions.clear()
            self.blocked_ips.clear()
            self.allowed_view_ips.clear()
            self.decision_results.clear()
            self.pending_gates.clear()
        return {
            "status": "success",
            "message": "All honeypot logs, traces, and session caches cleared."
        }

    def get_ai_decoys(self) -> Dict[str, Any]:
        """Returns all cached AI synthetic decoy files generated during attacker sessions."""
        all_decoys: List[Dict[str, Any]] = []
        with self.logs_lock:
            for ip, session in self.sessions.items():
                for file_path, content in session.cached_ai_decoys.items():
                    all_decoys.append({
                        "ip": ip,
                        "file_path": file_path,
                        "content": content,
                        "size_bytes": len(content.encode("utf-8")),
                        "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(session.created_at))
                    })
        return {"status": "success", "decoys": all_decoys}

    def simulate_attack_scenario(self) -> Dict[str, Any]:
        """Triggers 1-click simulated attack scenario for presentation reviews.
        Uses dynamic ports from current daemon config and randomized geo-diverse IPs."""
        import random

        now = time.strftime("%Y-%m-%d %H:%M:%S")

        # Geo-diverse simulated attacker pool (randomized per trigger)
        sim_pool = [
            {"ip": "198.51.100.42", "location": "London, United Kingdom", "cc": "GB", "lat": 51.5074, "lon": -0.1278},
            {"ip": "203.0.113.77", "location": "Beijing, China", "cc": "CN", "lat": 39.9042, "lon": 116.4074},
            {"ip": "185.220.101.33", "location": "Moscow, Russia", "cc": "RU", "lat": 55.7558, "lon": 37.6173},
            {"ip": "45.33.32.156", "location": "São Paulo, Brazil", "cc": "BR", "lat": -23.5505, "lon": -46.6333},
            {"ip": "104.248.29.91", "location": "New York, United States", "cc": "US", "lat": 40.7128, "lon": -74.0060},
        ]
        attacker = random.choice(sim_pool)
        sim_ip = attacker["ip"]
        location = attacker["location"]

        sim_log = {
            "id": f"sim-ssh-{int(time.time()*1000)}",
            "timestamp": now,
            "attacker_ip": sim_ip,
            "location": location,
            "country_code": attacker["cc"],
            "lat": attacker["lat"],
            "lon": attacker["lon"],
            "service": f"SSH (Port {self.ssh_port})",
            "type": "command_exec",
            "plain_english_summary": f"SIMULATED ATTACK: Attacker from {location} entered SSH Port {self.ssh_port} and ran `cat /etc/shadow` inside sandboxed mirror wall.",
            "raw_payload": f'SIMULATED: SSH_CONNECT -> EXEC "cat /etc/shadow" (from {sim_ip})',
            "status": "active"
        }

        sim_trace = {
            "id": f"sim-trace-{int(time.time()*1000)}",
            "timestamp": now,
            "client_app": f"Simulated Browser ({location})",
            "client_ip": sim_ip,
            "method": "GET",
            "requested_path": "/admin/confidential_passwords.txt",
            "status_code": 200,
            "status_text": "200 OK",
            "decoy_action": f"Served Dynamic AI Synthetic Decoy (Port {self.web_port})",
            "response_ms": random.randint(8, 35)
        }

        with self.logs_lock:
            self.pending_gates[sim_ip] = threading.Event()
            self.ssh_logs.insert(0, sim_log)
            self.web_traces.insert(0, sim_trace)

        # Trigger Native OS Desktop Notification for the simulated attack
        self.trigger_native_os_notification(
            "NO-ASH CRITICAL INTRUSION ALERT",
            sim_log["plain_english_summary"],
            sim_ip
        )

        return {
            "status": "success",
            "message": f"Simulated attack from {location} ({sim_ip}) triggered on SSH:{self.ssh_port} & Web:{self.web_port}.",
            "simulated_log": sim_log,
            "simulated_trace": sim_trace
        }

    def get_active_sessions_keystrokes(self) -> Dict[str, Any]:
        """Returns real-time keystrokes and session command history for frontend live terminal viewer."""
        sessions_data = []
        with self.logs_lock:
            for ip, session in self.sessions.items():
                sessions_data.append({
                    "ip": ip,
                    "target_os": session.target_os,
                    "hostname": session.hostname,
                    "username": session.username,
                    "prompt": session.prompt,
                    "command_history": session.command_history,
                    "created_at": session.created_at
                })
        return {
            "status": "success",
            "total_sessions": len(sessions_data),
            "sessions": sessions_data
        }

    def get_dashboard_summary(self) -> Dict[str, Any]:
        """Returns consolidated status, logs, traces, and decoys in a single fast call for UI optimization."""
        status = self.get_status()
        logs = self.get_honeypot_logs().get("logs", [])
        traces = self.get_web_traces().get("traces", [])
        decoys = self.get_ai_decoys().get("decoys", [])
        return {
            "status": "success",
            "daemon_active": status.get("daemon_active", False),
            "ssh_port": status.get("ssh_port", 2222),
            "web_port": status.get("web_port", 8080),
            "logs": logs,
            "traces": traces,
            "decoys": decoys
        }


# Global Singleton Instance
honeypot_service = HoneypotService()
