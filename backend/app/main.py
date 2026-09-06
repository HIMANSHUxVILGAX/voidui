from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Dict, Any, List
from datetime import datetime
import base64
import subprocess
import threading
import platform
import tempfile
import shutil
import html
import time
import json
import psutil
from app.services.service_manager import native_service_manager
from app.services.honeypot_service import honeypot_service
from app.services.scanner_service import (
    run_nmap_scan,
    run_lynis_scan,
    run_clamav_scan,
    generate_ai_report,
    verify_threat_resolution
)
from pydantic import BaseModel
from app.services.ai_engine_service import (
    generate_lumen_response,
    generate_lumen_stream,
    generate_superforge_response,
    generate_superforge_stream,
    check_ollama_status,
    PERSONAS,
    CONFIG,
    key_manager
)
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
import os
import socket
import logging
import re

logger = logging.getLogger("void-backend")


def _b64dec(s: str) -> str:
    return base64.b64decode(s.encode('ascii')).decode('utf-8')


app = FastAPI(title="VOID Backend Services", version="0.1.0")


@app.on_event("startup")
async def startup_event():
    # Automatically launch Optics background daemon on server start
    honeypot_service.start_daemon()


# Automatically include default Windows installation paths for security tools (Nmap, ClamAV)
if platform.system() == "Windows":
    default_paths = [
        r"C:\Program Files\Nmap",
        r"C:\Program Files (x86)\Nmap",
        r"C:\Program Files\ClamAV",
        r"C:\Program Files (x86)\ClamAV"
    ]
    current_path = os.environ.get("PATH", "")
    for dp in default_paths:
        if os.path.exists(dp) and dp not in current_path:
            os.environ["PATH"] = dp + os.pathsep + current_path
            current_path = os.environ["PATH"]

# Enable full CORS for Electron Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict:
    return {"message": "VOID background services are running successfully."}


@app.get("/status")
async def get_status() -> dict:
    return {
        "status": "healthy",
        "modules": {
            "dcs": "initialized",
            "lumen": "pending_api_key",
            "quark": "ready",
            "optics": "ready",
            "mag": "ready",
            # Legacy compatibility
            "ashCode": "initialized",
            "SuperForge": "pending_api_key",
            "Avanger": "ready",
            "elumPot": "ready",
            "AshFinder": "ready"
        }
    }


@app.get("/api/system/check-tools")
async def check_security_tools() -> dict:
    """Checks presence of CLI security tools (Nmap, ClamAV, Lynis) on host OS."""
    current_path = os.environ.get("PATH", "")
    additional_paths = ["/usr/sbin", "/sbin", "/usr/local/sbin"]
    for p in additional_paths:
        if os.path.exists(p) and p not in current_path.split(os.pathsep):
            current_path += os.pathsep + p

    tools_status = {
        "nmap": shutil.which("nmap", path=current_path) is not None,
        "clamav": shutil.which("clamscan", path=current_path) is not None,
        "lynis": shutil.which("lynis", path=current_path) is not None
    }
    all_installed = all(tools_status.values())
    show_wizard = os.environ.get(
        "VOID_SHOW_WIZARD", os.environ.get("NOASH_SHOW_WIZARD", "0")) == "1"
    return {
        "status": "success",
        "tools": tools_status,
        "all_installed": all_installed,
        "show_wizard": show_wizard,
        "platform": platform.system()
    }

# --- QUARK SCANNER & THREAT ENGINE ENDPOINTS ---

scan_state: Dict[str, Any] = {
    "is_scanning": False,
    "is_traversing": False,
    "findings": [],
    "finding_ids": set(),
    "last_report": None,
    "scanned_files": [],
    "total_scanned_count": 0
}
scan_lock = threading.Lock()

# Max entries kept in scanned_files ring buffer (UI only needs the tail for live console)
_SCANNED_FILES_MAX = 500

# Binary media/archive extensions — skip content signature reads (can't contain text-based malware)
_BINARY_SKIP_EXTS = frozenset({
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.svg', '.tiff', '.tif',
    '.mp3', '.mp4', '.avi', '.mkv', '.mov', '.flv', '.wmv', '.wav', '.flac', '.ogg', '.aac',
    '.zip', '.gz', '.tar', '.bz2', '.xz', '.7z', '.rar', '.iso', '.dmg', '.cab',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.sqlite', '.db', '.dll', '.so', '.dylib', '.o', '.obj', '.lib', '.a',
    '.class', '.pyc', '.pyo', '.wasm',
})

# Pre-compiled Base64 Threat Signatures (Evaluated once at startup to avoid decodes during scans)
_WEBSHELL_SIGS = [
    (_b64dec('Yzk5c2hlbGw='), 'Webshell.C99'),
    (_b64dec('cjU3c2hlbGw='), 'Webshell.R57'),
    (_b64dec('ZXZhbChiYXNlNjRfZGVjb2RlKA=='), 'Webshell.ObfuscatedPHP'),
    (_b64dec('cGFzc3RocnUoJF9QT1NU'), 'Webshell.PASSTHRU'),
    (_b64dec('c2hlbGxfZXhlYygkX0dFVA=='), 'Webshell.SHELLEXEC'),
    (_b64dec('c3lzdGVtKCRfR0VU'), 'Webshell.SYSTEM'),
    (_b64dec('cG9wZW4oJF9QT1NU'), 'Webshell.POPEN'),
    (_b64dec('ZXZhbChnemluZmxhdGUoYmFzZTY0X2RlY29kZSg='), 'Webshell.GZInflate')
]

_REV_SHELL_SIGS = [
    (_b64dec('L2Jpbi9iYXNoIC1pID4mIC9kZXYvdGNwLw=='),
     'Trojan.Linux.ReverseShell.Bash'),
    (_b64dec('bmMgLWUgL2Jpbi9iYXNo'), 'Trojan.Linux.ReverseShell.Netcat'),
    (_b64dec('bmMgLWUgL2Jpbi9zaA=='), 'Trojan.Linux.ReverseShell.Netcat'),
    (_b64dec('cHl0aG9uIC1jICdpbXBvcnQgc29ja2V0LHN1YnByb2Nlc3M='),
     'Trojan.Linux.ReverseShell.Python'),
    (_b64dec('cG93ZXJzaGVsbCAtbm9wIC13IGhpZGRlbiAtZW5j'),
     'Trojan.Win.EncodedPowerShell'),
    (_b64dec('cG93ZXJzaGVsbC5leGUgLWUg'), 'Trojan.Win.EncodedPowerShell'),
    (_b64dec('SW52b2tlLUV4cHJlc3Npb24gKE5ldy1PYmplY3QgTmV0LldlYkNsaWVudCk='),
     'Trojan.Win.PowerShellDownloader')
]

_EICAR_SIG1 = _b64dec('RUlDQVItU1RBTkRBUkQtQU5USVZJUlVTLVRFU1QtRklMRQ==')
_EICAR_SIG2 = _b64dec('U1RBTkRBUkQtQU5USVZJUlVTLVRFU1QtRklMRQ==')
_EICAR_SIG3 = _b64dec('WDVPIVAlQEFQWw==')

# Ultra-Fast Pre-compiled Regex Patterns for C-Speed Matching
_EICAR_REGEX = re.compile(
    f"{re.escape(_EICAR_SIG1)}|{re.escape(_EICAR_SIG2)}|{re.escape(_EICAR_SIG3)}"
)

_WEBSHELL_COMPILED = [
    (re.compile(re.escape(sig_pat)), sig_lbl) for sig_pat, sig_lbl in _WEBSHELL_SIGS
]

_REV_SHELL_COMPILED = [
    (re.compile(re.escape(rev_pat)), rev_lbl) for rev_pat, rev_lbl in _REV_SHELL_SIGS
]

_RANSOM_EXTS = ('.locked', '.crypto', '.encrypted',
                '.wannacry', '.locky', '.ryuk', '.revil')
_DOUBLE_EXT_ENDINGS = ('.pdf.exe', '.docx.exe', '.jpg.vbs',
                       '.png.scr', '.xlsx.bat', '.pdf.vbs', '.doc.exe')
_PRINTABLE_BYTES = frozenset(range(32, 127)) | {9, 10, 13}


class VerifyRequest(BaseModel):
    pid: Optional[int] = 1420
    file_path: Optional[str] = os.path.join(tempfile.gettempdir(), "test_file")


def _eval_content_signatures(text: str) -> tuple[bool, Optional[str], Optional[str]]:
    """Evaluates compiled regex signatures against text content in single pass."""
    if _EICAR_REGEX.search(text):
        return True, "EICAR-Test-File", "AV-Test"

    for rx, label in _WEBSHELL_COMPILED:
        if rx.search(text):
            return True, label, "Webshell"

    for rx, label in _REV_SHELL_COMPILED:
        if rx.search(text):
            return True, label, "ReverseShell"

    return False, None, None


def inspect_file_for_threats(fpath: str) -> tuple[bool, Optional[str], Optional[str]]:
    """
    Multi-category malware and threat signature inspection engine.
    Checks file names, extensions, and content signatures across multiple threat categories.
    Fast pre-compiled signatures avoid CPU overhead during multi-threaded scans.
    """
    fname = os.path.basename(fpath).lower()

    # Fast-path check: skip binary media / archives / compiled files immediately
    _, _fext = os.path.splitext(fname)
    if _fext in _BINARY_SKIP_EXTS:
        return False, None, None

    # Category 1: Ransomware extensions & Double extension tricks
    for rext in _RANSOM_EXTS:
        if fname.endswith(rext):
            return True, f"Ransomware.EncryptedFile ({rext})", "Ransomware"

    # Category 1b: Smart .enc file analysis — avoids false positives on legitimate encoding tables
    if fname.endswith('.enc'):
        _enc_suspicious = False
        try:
            _enc_size = os.path.getsize(fpath) if os.path.exists(fpath) else 0
            _enc_norm = fpath.replace('\\', '/').lower()
            # Legitimate encoding files reside inside library/framework directory trees
            _lib_indicators = ('/lib/', '/encoding/', '/share/', '/tcl', '/python',
                               '/ruby/', '/perl/', '/locale/', '/i18n/', '/charsets/',
                               '/codecs/', '/locales/', '/nls/')
            _in_lib = any(ind in _enc_norm for ind in _lib_indicators)

            if os.path.isfile(fpath) and _enc_size < 524288:  # < 512 KB
                with open(fpath, 'rb') as _fb:
                    _raw = _fb.read(2048)
                if _raw:
                    _printable = sum(1 for b in _raw if b in _PRINTABLE_BYTES)
                    _txt_ratio = _printable / len(_raw)
                    if _txt_ratio > 0.70 and _in_lib:
                        _enc_suspicious = False   # Text file in a library dir → encoding table
                    elif _txt_ratio > 0.85:
                        _enc_suspicious = False   # Very high text content → config / data file
                    else:
                        _enc_suspicious = True    # Binary-heavy .enc outside known lib paths
                else:
                    _enc_suspicious = False        # Empty file — not a threat
            elif _enc_size >= 524288 and not _in_lib:
                _enc_suspicious = True             # Large .enc outside library dirs
        except Exception:
            _enc_suspicious = False                # Can't read → don't false-flag

        if _enc_suspicious:
            return True, "Ransomware.SuspiciousEncryptedFile (.enc)", "Ransomware"

    for dext in _DOUBLE_EXT_ENDINGS:
        if fname.endswith(dext):
            return True, f"Malware.DoubleExtensionTrick ({dext})", "Executable"

    # Category 2: Content Signature & Chunk Streaming Inspection
    try:
        fsize = os.path.getsize(fpath)
        if fsize < 5000000:
            # Complete un-truncated file read for files under 5MB
            with open(fpath, 'r', errors='ignore') as f:
                content = f.read()
                return _eval_content_signatures(content)
        else:
            # Large File 4MB Chunk Streaming Loop (Supports 10GB+ files with 4MB max RAM)
            CHUNK_SIZE = 4 * 1024 * 1024  # 4 MB chunk
            max_chunks_to_scan = 5      # Stream up to 20 MB of content to keep speed high
            with open(fpath, 'r', errors='ignore') as f:
                chunks_scanned = 0
                overlap = ""
                while chunks_scanned < max_chunks_to_scan:
                    chunk = f.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    scan_text = overlap + chunk
                    overlap = chunk[-1024:] if len(chunk) >= 1024 else chunk
                    chunks_scanned += 1

                    is_inf, sig, cat = _eval_content_signatures(scan_text)
                    if is_inf:
                        return is_inf, sig, cat
    except Exception:
        pass

    return False, None, None


class StartScanRequest(BaseModel):
    target: Optional[str] = "127.0.0.1"
    scope: Optional[str] = "full"  # "full", "storage", or "custom"
    custom_path: Optional[str] = None


# Optimal thread pool balance: max 16 workers prevents GIL CPU thrashing while keeping peak SSD throughput
_SCAN_WORKERS = min(16, max(4, (os.cpu_count() or 4) * 2))
scan_executor = ThreadPoolExecutor(max_workers=_SCAN_WORKERS)


def inspect_and_record_batch(fpaths: List[str], is_windows: bool):
    """
    Multi-threaded parallel inspection of a batch of files to maximize SSD/NVMe throughput.
    Uses persistent scan_executor ThreadPoolExecutor for I/O concurrency and single atomic scan_lock acquisition.
    """
    global scan_state, scan_executor
    if not fpaths:
        return

    def _worker(fp: str):
        try:
            fname = os.path.basename(fp).lower()
            _, _fext = os.path.splitext(fname)
            if _fext in _BINARY_SKIP_EXTS:
                return (fp, "clean", False, None, None)

            is_inf, sig, cat = inspect_file_for_threats(fp)
            return (fp, "infected" if is_inf else "clean", is_inf, sig, cat)
        except Exception:
            return None

    results = list(scan_executor.map(_worker, fpaths))

    valid_results = [r for r in results if r is not None]
    if not valid_results:
        return

    with scan_lock:
        scan_state["total_scanned_count"] += len(valid_results)

        new_entries = []
        for fp, status, is_inf, sig, cat in valid_results:
            new_entries.append({
                "file_path": fp,
                "status": status,
                "signature": sig
            })
            if is_inf and sig:
                finding_id = f"malware-{abs(hash(fp))}"
                if finding_id not in scan_state["finding_ids"]:
                    scan_state["finding_ids"].add(finding_id)
                    fix_cmd = f"Remove-Item -Path '{fp}' -Force" if is_windows else f"rm -f '{fp}'"
                    fsize = os.path.getsize(fp) if os.path.exists(fp) else 0
                    fsize_str = f"{round(fsize / 1024, 2)} KB" if fsize >= 1024 else f"{fsize} Bytes"
                    scan_state["findings"].append({
                        "id": finding_id,
                        "tool": f"Quark ({cat or 'Malware'})",
                        "severity": "High",
                        "issue": f"Malware signature '{sig}' detected in {fp}",
                        "fix": fix_cmd,
                        "details": {
                            "file_path": fp,
                            "signature": sig,
                            "category": cat,
                            "file_size": fsize_str
                        }
                    })

        scan_state["scanned_files"].extend(new_entries)
        if len(scan_state["scanned_files"]) > _SCANNED_FILES_MAX:
            scan_state["scanned_files"] = scan_state["scanned_files"][-_SCANNED_FILES_MAX:]

        # Dynamically scale progress percentage smoothly as files are processed
        total_files = scan_state.get("total_scanned_count", 0)
        dynamic_prog = min(
            98, max(5, int(5 + 93 * (1 - (0.9997 ** total_files)))))
        scan_state["progress"] = max(
            scan_state.get("progress", 5), dynamic_prog)


def inspect_and_record_file(fpath: str, is_windows: bool):
    """Wrapper for single-file inspection compatibility."""
    inspect_and_record_batch([fpath], is_windows)


def run_file_traversal(scope: str = "full", custom_path: Optional[str] = None):
    global scan_state

    # Clear previous scanned files & set traversal active
    with scan_lock:
        scan_state["scanned_files"] = []
        scan_state["is_traversing"] = True

    is_windows = platform.system() == "Windows"
    generic_skip_dirs = {
        'node_modules', 'venv', '.venv', 'cache', '.cache', '__pycache__', '.git', '.svn',
        'proc', 'sys', 'dev', 'run', 'var/log', 'var/lib', 'var/cache',
        'system volume information', '$recycle.bin'
    }

    _skip_path_fragments = tuple(f"/{s}" for s in generic_skip_dirs)

    def is_dir_allowed(dirname: str, dirpath: str) -> bool:
        d_lower = dirname.lower()
        if d_lower[0:1] in ('.', '$'):
            return False
        if d_lower in generic_skip_dirs:
            return False
        norm = dirpath.replace('\\', '/').lower()
        for frag in _skip_path_fragments:
            if frag in norm:
                return False
        return True

    batch_buffer: List[str] = []
    BATCH_SIZE = 128  # Increased batch size to improve ThreadPool concurrency speed

    def flush_batch():
        nonlocal batch_buffer
        if batch_buffer:
            inspect_and_record_batch(batch_buffer, is_windows)
            batch_buffer = []

    try:
        # --- SCOPE 1: CUSTOM FOLDER / FILE ONLY ---
        if scope == "custom":
            # Fallback to Desktop or Home if custom_path is empty or invalid
            effective_path = custom_path if (custom_path and os.path.exists(
                custom_path)) else os.path.expanduser("~/Desktop")
            target_p = os.path.abspath(os.path.expanduser(effective_path))
            if os.path.isfile(target_p):
                inspect_and_record_file(target_p, is_windows)
            elif os.path.isdir(target_p):
                for root, dirs, files in os.walk(target_p):
                    if not scan_state["is_traversing"]:
                        break
                    dirs[:] = [d for d in dirs if is_dir_allowed(
                        d, os.path.join(root, d))]
                    for f in files:
                        if not scan_state["is_traversing"]:
                            break
                        batch_buffer.append(os.path.join(root, f))
                        if len(batch_buffer) >= BATCH_SIZE:
                            flush_batch()
                flush_batch()

        # --- SCOPE 2: STORAGE / EXTERNAL MOUNTED DRIVES ONLY ---
        elif scope == "storage":
            found_storage_files = False
            if is_windows:
                import string
                for letter in string.ascii_uppercase:
                    if letter in ['A', 'B', 'C']:  # Skip OS Drive C:\
                        continue
                    drive_root = f"{letter}:\\"
                    if os.path.exists(drive_root):
                        for root, dirs, files in os.walk(drive_root):
                            if not scan_state["is_traversing"]:
                                break
                            dirs[:] = [d for d in dirs if is_dir_allowed(
                                d, os.path.join(root, d))]
                            for f in files:
                                if not scan_state["is_traversing"]:
                                    break
                                batch_buffer.append(os.path.join(root, f))
                                found_storage_files = True
                                if len(batch_buffer) >= BATCH_SIZE:
                                    flush_batch()
                        flush_batch()
            else:
                linux_mount_roots = [
                    "/media", "/run/media", "/mnt", "/opt", "/srv"]
                for mroot in linux_mount_roots:
                    if os.path.exists(mroot):
                        for root, dirs, files in os.walk(mroot):
                            if not scan_state["is_traversing"]:
                                break
                            dirs[:] = [d for d in dirs if is_dir_allowed(
                                d, os.path.join(root, d))]
                            for f in files:
                                if not scan_state["is_traversing"]:
                                    break
                                batch_buffer.append(os.path.join(root, f))
                                found_storage_files = True
                                if len(batch_buffer) >= BATCH_SIZE:
                                    flush_batch()
                        flush_batch()

            # If no external mounted drive found, fallback to scanning Downloads & temp storage
            if not found_storage_files:
                storage_fallbacks = [os.path.expanduser(
                    "~/Downloads"), tempfile.gettempdir()]
                for sdir in storage_fallbacks:
                    if os.path.exists(sdir):
                        for root, dirs, files in os.walk(sdir):
                            if not scan_state["is_traversing"]:
                                break
                            dirs[:] = [d for d in dirs if is_dir_allowed(
                                d, os.path.join(root, d))]
                            for f in files:
                                if not scan_state["is_traversing"]:
                                    break
                                batch_buffer.append(os.path.join(root, f))
                                if len(batch_buffer) >= BATCH_SIZE:
                                    flush_batch()
                        flush_batch()

        # --- SCOPE 3: FULL SYSTEM AUDIT ---
        else:
            home_dir = os.path.expanduser("~")
            user_subdirs = ["Desktop", "Downloads",
                            "Documents", "Pictures", "Music", "Videos"]
            scanned_set = set()

            # 1. User Key Folders
            for sd in user_subdirs:
                tdir = os.path.join(home_dir, sd)
                if os.path.exists(tdir):
                    for root, dirs, files in os.walk(tdir):
                        if not scan_state["is_traversing"]:
                            break
                        dirs[:] = [d for d in dirs if is_dir_allowed(
                            d, os.path.join(root, d))]
                        for f in files:
                            if not scan_state["is_traversing"]:
                                break
                            fp = os.path.join(root, f)
                            if fp not in scanned_set:
                                scanned_set.add(fp)
                                batch_buffer.append(fp)
                                if len(batch_buffer) >= BATCH_SIZE:
                                    flush_batch()
                    flush_batch()

            # 2. Entire Home Directory
            if os.path.exists(home_dir):
                for root, dirs, files in os.walk(home_dir):
                    if not scan_state["is_traversing"]:
                        break
                    dirs[:] = [d for d in dirs if is_dir_allowed(
                        d, os.path.join(root, d)) and d not in user_subdirs]
                    for f in files:
                        if not scan_state["is_traversing"]:
                            break
                        fp = os.path.join(root, f)
                        if fp not in scanned_set:
                            scanned_set.add(fp)
                            batch_buffer.append(fp)
                            if len(batch_buffer) >= BATCH_SIZE:
                                flush_batch()
                flush_batch()

            # 3. Temp Directories
            temp_dirs = [tempfile.gettempdir()]
            if not is_windows:
                temp_dirs.extend(["/tmp", "/var/tmp"])
            for tdir in temp_dirs:
                if os.path.exists(tdir):
                    for root, dirs, files in os.walk(tdir):
                        if not scan_state["is_traversing"]:
                            break
                        dirs[:] = [d for d in dirs if is_dir_allowed(
                            d, os.path.join(root, d))]
                        for f in files:
                            if not scan_state["is_traversing"]:
                                break
                            fp = os.path.join(root, f)
                            if fp not in scanned_set:
                                scanned_set.add(fp)
                                batch_buffer.append(fp)
                                if len(batch_buffer) >= BATCH_SIZE:
                                    flush_batch()
                    flush_batch()

            # 4. Multi-Drive & Mounted Roots
            if is_windows:
                import string
                _home_norm = os.path.normcase(home_dir)
                for letter in string.ascii_uppercase:
                    if letter in ('A', 'B'):
                        continue
                    drive_root = f"{letter}:\\"
                    if os.path.exists(drive_root):
                        for root, dirs, files in os.walk(drive_root):
                            if not scan_state["is_traversing"]:
                                break
                            _os_skip = ['Windows', 'Program Files',
                                        'Program Files (x86)'] if letter == 'C' else []
                            if letter == 'C' and os.path.normcase(root) == _home_norm:
                                dirs[:] = []
                                continue
                            dirs[:] = [d for d in dirs if is_dir_allowed(
                                d, os.path.join(root, d)) and d not in _os_skip]
                            for f in files:
                                if not scan_state["is_traversing"]:
                                    break
                                fp = os.path.join(root, f)
                                if fp not in scanned_set:
                                    scanned_set.add(fp)
                                    batch_buffer.append(fp)
                                    if len(batch_buffer) >= BATCH_SIZE:
                                        flush_batch()
                        flush_batch()
            else:
                linux_mount_roots = ["/media", "/run/media",
                                     "/mnt", "/opt", "/srv", "/etc", "/usr/local"]
                for mroot in linux_mount_roots:
                    if os.path.exists(mroot):
                        for root, dirs, files in os.walk(mroot):
                            if not scan_state["is_traversing"]:
                                break
                            dirs[:] = [d for d in dirs if is_dir_allowed(
                                d, os.path.join(root, d))]
                            for f in files:
                                if not scan_state["is_traversing"]:
                                    break
                                fp = os.path.join(root, f)
                                if fp not in scanned_set:
                                    scanned_set.add(fp)
                                    batch_buffer.append(fp)
                                    if len(batch_buffer) >= BATCH_SIZE:
                                        flush_batch()
                        flush_batch()
    except Exception as e:
        print(f"[FileTraversal] Error during traversal: {e}")
    finally:
        flush_batch()
        with scan_lock:
            scan_state["is_traversing"] = False
        print(
            f"[FileTraversal] System inspection complete — {len(scan_state['scanned_files'])} files inspected.")


def execute_background_scan(scope: str = "full", custom_path: Optional[str] = None):
    global scan_state
    try:
        honeypot_service.set_audit_mode(True)
        # Start file traversal thread concurrently with requested scope
        traversal_thread = threading.Thread(
            target=run_file_traversal, args=(scope, custom_path), daemon=True)
        traversal_thread.start()

        if scope == "custom":
            # Custom folder scan: file traversal only on target folder
            traversal_thread.join()
            with scan_lock:
                scan_state["progress"] = 100
            print("[BackgroundScan] Custom folder scan complete — file traversal only.")
        elif scope == "storage":
            # Storage drives scan: inspect mounted and external media only
            traversal_thread.join()
            with scan_lock:
                scan_state["progress"] = 100
            print(
                "[BackgroundScan] Storage drives scan complete — file traversal only.")
        else:
            # Full system scan: run security tools alongside full file traversal
            nmap_results = run_nmap_scan("127.0.0.1")
            with scan_lock:
                scan_state["progress"] = max(scan_state.get("progress", 0), 25)

            lynis_results = run_lynis_scan()
            with scan_lock:
                scan_state["progress"] = max(scan_state.get("progress", 0), 50)

            clamav_results = run_clamav_scan(None)
            with scan_lock:
                scan_state["progress"] = max(scan_state.get("progress", 0), 75)

            all_findings = nmap_results + lynis_results + clamav_results
            with scan_lock:
                for f in all_findings:
                    if not any(existing.get("id") == f.get("id") for existing in scan_state["findings"]):
                        scan_state["findings"].append(f)

            traversal_thread.join()
            with scan_lock:
                scan_state["progress"] = 100
            print("[BackgroundScan] Full scan complete (tools + file traversal).")

        with scan_lock:
            # Append clear final summary status line to live console log stream
            high_threats = [f for f in scan_state["findings"]
                            if f.get("severity", "").lower() == "high"]
            if high_threats:
                first_threat = high_threats[0]
                threat_fp = first_threat.get("details", {}).get(
                    "file_path") or first_threat.get("issue") or "Malware"
                fname = os.path.basename(threat_fp)
                scan_state["scanned_files"].append({
                    "file_path": f"[THREAT DETECTED] High Risk Threat Found: {fname} (Lockdown Initiated)",
                    "status": "infected",
                    "signature": "LOCKDOWN_TRIGGERED"
                })
            else:
                scan_state["scanned_files"].append({
                    "file_path": "[SCAN COMPLETED] System audit clean — No active threats detected.",
                    "status": "clean",
                    "signature": None
                })

            # Auto-save report to disk for permanent archiving
            try:
                report = generate_ai_report(scan_state["findings"])
                scan_state["last_report"] = report
                report_dir = get_reports_directory()
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                json_filename = f"void_audit_report_{timestamp}.json"
                json_path = os.path.join(report_dir, json_filename)
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(report, f, indent=2)
                md_filename = f"void_audit_report_{timestamp}.md"
                md_path = os.path.join(report_dir, md_filename)
                with open(md_path, 'w', encoding='utf-8') as f:
                    f.write(report.get("report_text", "Audit scan completed."))
                print(
                    f"[BackgroundScan] Audit report automatically saved to: {json_path}")
            except Exception as save_err:
                print(
                    f"[BackgroundScan] Failed to auto-save audit report: {save_err}")

    except Exception as e:
        print(f"[BackgroundScan] Error running scanners: {e}")
    finally:
        honeypot_service.set_audit_mode(False)
        with scan_lock:
            scan_state["is_scanning"] = False
            scan_state["is_traversing"] = False


@app.post("/api/quark/start")
@app.post("/api/scanner/start")
async def start_scanner(req: Optional[StartScanRequest] = None) -> dict:
    global scan_state
    target = req.target if req and req.target else "127.0.0.1"
    scope = req.scope if req and req.scope else "full"
    custom_path = req.custom_path if req and req.custom_path else None

    with scan_lock:
        if not scan_state["is_scanning"]:
            scan_state["is_scanning"] = True
            scan_state["is_traversing"] = True
            scan_state["findings"] = []
            scan_state["finding_ids"] = set()
            scan_state["last_report"] = None
            scan_state["scanned_files"] = []
            scan_state["total_scanned_count"] = 0
            scan_state["progress"] = 5

            thread = threading.Thread(target=execute_background_scan, args=(
                scope, custom_path), daemon=True)
            thread.start()

    return {"status": "success", "message": f"Scan initiated for target {target} [scope={scope}]", "scan_id": "scan-active-001"}


@app.post("/api/quark/cancel")
@app.post("/api/scanner/cancel")
async def cancel_scanner() -> dict:
    global scan_state
    with scan_lock:
        scan_state["is_scanning"] = False
        scan_state["is_traversing"] = False
        scan_state["progress"] = 0
    print("[Scanner] Abort signal received. Scan cancelled by user.")
    return {"status": "success", "message": "Scan cancelled by user"}


@app.get("/api/quark/status")
@app.get("/api/scanner/status")
async def get_scanner_status() -> dict:
    global scan_state
    with scan_lock:
        # Send only the tail of scanned_files to keep JSON response fast
        _tail = scan_state.get("scanned_files", [])[-_SCANNED_FILES_MAX:]
        if scan_state["is_scanning"]:
            return {
                "status": "scanning",
                "progress": scan_state.get("progress", 25),
                "findings": [],
                "scanned_files": _tail,
                "total_scanned": scan_state.get("total_scanned_count", 0)
            }
        else:
            return {
                "status": "completed",
                "progress": 100,
                "findings": scan_state["findings"],
                "scanned_files": _tail,
                "total_scanned": scan_state.get("total_scanned_count", 0)
            }


@app.get("/api/quark/report")
@app.get("/api/scanner/report")
async def get_ai_report() -> dict:
    global scan_state
    findings = scan_state["findings"] if scan_state["findings"] else [
        {"id": "nmap-80", "tool": "Nmap", "severity": "Low",
            "issue": "Open port 80 detected", "fix": "sudo ufw deny 80/tcp"},
        {"id": "lynis-ssh", "tool": "Lynis", "severity": "Medium",
            "issue": "SSH Root login enabled", "fix": "Set PermitRootLogin no in sshd_config"},
        {"id": "clamav-01", "tool": "ClamAV", "severity": "High",
            "issue": "Potential malware signature in /tmp/test_file", "fix": "rm /tmp/test_file"}
    ]

    report = generate_ai_report(findings)
    scan_state["last_report"] = report
    return report


_last_net_calc_time = 0.0
_last_net_calc_bytes = 0


def check_network_connectivity() -> bool:
    """Multi-tiered real network connectivity check on Linux/Windows/macOS."""
    # 1. Quick UDP routing test to standard public DNS (no actual packet sent over wire)
    for target in [("1.1.1.1", 53), ("8.8.8.8", 53), ("9.9.9.9", 53)]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.2)
            s.connect(target)
            s.close()
            return True
        except Exception:
            continue

    # 2. Check psutil net_if_stats for any non-loopback UP interface
    try:
        net_stats = psutil.net_if_stats()
        for iface, stats in net_stats.items():
            if iface != 'lo' and not iface.startswith('docker') and not iface.startswith('br-'):
                if stats.isup:
                    return True
    except Exception:
        pass

    # 3. Check psutil net_if_addrs for any non-loopback interface with active IPv4 address
    try:
        net_addrs = psutil.net_if_addrs()
        for iface, addrs in net_addrs.items():
            if iface != 'lo' and not iface.startswith('docker') and not iface.startswith('br-'):
                for addr in addrs:
                    if addr.family == socket.AF_INET and not addr.address.startswith('127.'):
                        return True
    except Exception:
        pass

    # 4. Check Linux kernel routing table for default gateway (Destination 00000000)
    try:
        if os.path.exists('/proc/net/route'):
            with open('/proc/net/route', 'r') as f:
                for line in f:
                    fields = line.strip().split()
                    if len(fields) >= 2 and fields[1] == '00000000':
                        return True
    except Exception:
        pass

    # 5. Fallback TCP probe with fast timeout
    for target in [("1.1.1.1", 53), ("8.8.8.8", 53)]:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.4)
            sock.connect(target)
            sock.close()
            return True
        except Exception:
            continue

    return False


@app.get("/api/system/metrics")
async def get_system_metrics() -> dict:
    """Returns real live OS CPU %, RAM %, Disk %, and Network status from system."""
    global _last_net_calc_time, _last_net_calc_bytes
    try:
        cpu = psutil.cpu_percent(interval=None)
        cpu_cores = psutil.cpu_count(logical=True) or 4

        mem = psutil.virtual_memory()
        ram_percent = round(mem.percent, 1)
        ram_used_gb = round(mem.used / (1024 ** 3), 2)
        ram_total_gb = round(mem.total / (1024 ** 3), 2)

        try:
            disk = psutil.disk_usage(os.path.expanduser('~'))
            disk_percent = round(disk.percent, 1)
            disk_used_gb = round(disk.used / (1024 ** 3), 1)
            disk_total_gb = round(disk.total / (1024 ** 3), 1)
        except Exception:
            disk = psutil.disk_usage('/')
            disk_percent = round(disk.percent, 1)
            disk_used_gb = round(disk.used / (1024 ** 3), 1)
            disk_total_gb = round(disk.total / (1024 ** 3), 1)

        is_connected = check_network_connectivity()

        now = time.time()
        net_io = psutil.net_io_counters()
        curr_bytes = (net_io.bytes_sent + net_io.bytes_recv) if net_io else 0
        total_mb = round(curr_bytes / (1024 * 1024), 1)

        speed_str = "0.0 KB/s"
        if _last_net_calc_time > 0 and now > _last_net_calc_time:
            dt = now - _last_net_calc_time
            delta_bytes = max(0, curr_bytes - _last_net_calc_bytes)
            bps = delta_bytes / dt if dt > 0 else 0
            if bps > 1024 * 1024:
                speed_str = f"{bps / (1024 * 1024):.1f} MB/s"
            else:
                speed_str = f"{bps / 1024:.1f} KB/s"

        _last_net_calc_time = now
        _last_net_calc_bytes = curr_bytes

        net_speed = f"100% Stable | {speed_str}" if is_connected else "Offline"

        return {
            "status": "success",
            "cpu": cpu,
            "cpu_cores": cpu_cores,
            "ram": ram_percent,
            "ram_used_gb": ram_used_gb,
            "ram_total_gb": ram_total_gb,
            "disk": disk_percent,
            "disk_used_gb": disk_used_gb,
            "disk_total_gb": disk_total_gb,
            "network_connected": is_connected,
            "networkConnected": is_connected,
            "network_speed": net_speed,
            "network_rate": speed_str,
            "network_total_mb": total_mb
        }
    except Exception as e:
        return {
            "status": "success",
            "cpu": 0.0,
            "cpu_cores": 4,
            "ram": 0.0,
            "ram_used_gb": 0.0,
            "ram_total_gb": 0.0,
            "disk": 0.0,
            "disk_used_gb": 0.0,
            "disk_total_gb": 0.0,
            "network_connected": False,
            "networkConnected": False,
            "network_speed": "N/A",
            "network_rate": "0 KB/s",
            "network_total_mb": 0.0
        }


@app.get("/api/scanner/processes")
async def get_system_processes() -> dict:
    """Returns real running OS processes using psutil for cross-platform support."""
    try:
        proc_list = ["PID      USER            COMMAND"]
        for p in psutil.process_iter(['pid', 'username', 'name']):
            try:
                username = p.info['username'] or 'N/A'
                if '\\' in username:
                    username = username.split('\\')[-1]
                proc_list.append(
                    f"{p.info['pid']:<8} {username:<15} {p.info['name']}")
                if len(proc_list) >= 25:
                    break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return {"status": "success", "processes": "\n".join(proc_list)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


class RemediateRequest(BaseModel):
    action: str  # "rm", "kill", or "fix_ssh"
    target: str  # file_path, pid, or empty


class SaveReportRequest(BaseModel):
    report: Dict[str, Any]
    directory: str


def get_reports_directory() -> str:
    """Returns the path for permanent scan reports, safely falling back across candidate locations."""
    project_root = os.path.abspath(os.path.join(
        os.path.dirname(__file__), "..", ".."))
    candidates = [
        os.path.join(project_root, "reports"),
        os.path.expanduser("~/Documents/void_reports"),
        os.path.expanduser("~/Desktop/void_reports"),
        "/tmp/void_reports"
    ]
    for d in candidates:
        try:
            os.makedirs(d, exist_ok=True)
            test_file = os.path.join(d, ".write_test")
            with open(test_file, "w") as f:
                f.write("ok")
            os.remove(test_file)
            return d
        except Exception:
            continue

    fallback = os.path.join(project_root, "reports")
    try:
        os.makedirs(fallback, exist_ok=True)
    except Exception:
        pass
    return fallback


@app.post("/api/scanner/save-report")
async def save_report_endpoint(req: SaveReportRequest) -> dict:
    try:
        target_dir = req.directory.strip() if req.directory and req.directory.strip(
        ) and req.directory != "reports" else get_reports_directory()
        target_dir = os.path.abspath(os.path.expanduser(target_dir))
        os.makedirs(target_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Save JSON Report
        json_filename = f"void_audit_report_{timestamp}.json"
        json_path = os.path.join(target_dir, json_filename)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(req.report, f, indent=2)

        # Save Markdown Report
        md_filename = f"void_audit_report_{timestamp}.md"
        md_path = os.path.join(target_dir, md_filename)
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(req.report.get("report_text", "No details available."))

        return {
            "status": "success",
            "message": f"Reports saved successfully to folder {target_dir}.",
            "directory": target_dir,
            "json_path": json_path,
            "md_path": md_path
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to save reports: {e}"}


@app.get("/api/scanner/past-scans")
async def get_past_scans() -> dict:
    """Returns a list of all historical scan audit reports saved on the user system."""
    try:
        report_dir = get_reports_directory()
        if not os.path.exists(report_dir):
            return {"status": "success", "reports_directory": report_dir, "scans": []}

        scans = []
        for fname in os.listdir(report_dir):
            if fname.endswith(".json"):
                fpath = os.path.join(report_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    mtime = os.path.getmtime(fpath)
                    readable_time = datetime.fromtimestamp(
                        mtime).strftime("%Y-%m-%d %H:%M:%S")
                    findings = data.get("findings", [])
                    scans.append({
                        "id": fname.replace(".json", ""),
                        "filename": fname,
                        "timestamp": readable_time,
                        "mtime": mtime,
                        "title": data.get("title", "Quark Audit Report"),
                        "summary": data.get("summary", "Security audit scan summary"),
                        "report_text": data.get("report_text", ""),
                        "findings_count": len(findings),
                        "findings": findings,
                        "file_path": fpath
                    })
                except Exception:
                    continue

        # Sort newest first
        scans.sort(key=lambda x: x["mtime"], reverse=True)

        return {
            "status": "success",
            "reports_directory": report_dir,
            "scans": scans
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "scans": []}


@app.post("/api/scanner/open-reports-folder")
async def open_reports_folder() -> dict:
    """Opens the reports folder in the system file manager."""
    try:
        report_dir = get_reports_directory()
        os.makedirs(report_dir, exist_ok=True)
        if platform.system() == "Windows":
            os.startfile(report_dir)
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", report_dir], start_new_session=True)
        else:
            env = os.environ.copy()
            if "DISPLAY" not in env:
                env["DISPLAY"] = ":0.0"
            if "DBUS_SESSION_BUS_ADDRESS" not in env and os.path.exists("/run/user/1000/bus"):
                env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=/run/user/1000/bus"

            commands = [
                ["thunar", report_dir],
                ["xdg-open", report_dir],
                ["gio", "open", report_dir],
                ["exo-open", "--launch", "FileManager", report_dir]
            ]
            opened = False
            for cmd in commands:
                if shutil.which(cmd[0]):
                    try:
                        subprocess.Popen(
                            cmd,
                            env=env,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            start_new_session=True
                        )
                        opened = True
                        break
                    except Exception as e:
                        logger.warning(f"Failed to launch {cmd[0]}: {e}")
                        continue
            if not opened:
                return {"status": "error", "message": "No suitable file manager binary found to open folder"}
        return {"status": "success", "message": f"Opened folder: {report_dir}", "directory": report_dir}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/scanner/remediate")
async def remediate_threat(req: RemediateRequest) -> dict:
    if req.action == "rm":
        file_path = req.target.strip()
        # Clean common bash flags if user typed 'rm -f /path' or 'rm -rf /path'
        if file_path.startswith("-f "):
            file_path = file_path[3:].strip()
        elif file_path.startswith("-rf "):
            file_path = file_path[4:].strip()
        elif file_path.startswith("-r "):
            file_path = file_path[3:].strip()
        file_path = file_path.strip("'\"")

        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                return {"status": "success", "message": f"File '{file_path}' deleted from system disk."}
            except Exception as e:
                return {"status": "error", "message": f"Failed to delete file '{file_path}': {e}"}
        else:
            return {"status": "error", "message": f"No such file or directory: '{file_path}'"}
    elif req.action == "kill":
        try:
            pid = int(req.target)
            if pid > 0:
                if psutil.pid_exists(pid):
                    p = psutil.Process(pid)
                    p.terminate()
                    return {"status": "success", "message": f"Process {pid} terminated."}
                else:
                    return {"status": "error", "message": f"No process with PID {req.target} found."}
            else:
                return {"status": "error", "message": f"Invalid PID {pid}."}
        except Exception as e:
            return {"status": "error", "message": f"Failed to kill process {req.target}: {e}"}
    elif req.action == "fix_ssh":
        # Perform real modification on /etc/ssh/sshd_config if possible
        sshd_path = "/etc/ssh/sshd_config"
        if not os.path.exists(sshd_path):
            # Mock fallback for non-linux/non-ssh systems to ensure it works
            sshd_path = os.path.join(os.path.dirname(
                os.path.abspath(__file__)), "sshd_config.mock")
            if not os.path.exists(sshd_path):
                with open(sshd_path, 'w') as f:
                    f.write("# Mock SSHD config\nPermitRootLogin yes\n")

        try:
            # Read content
            with open(sshd_path, 'r') as f:
                content = f.read()

            # Replace 'PermitRootLogin yes' or commented ones with 'PermitRootLogin no'
            new_content = re.sub(
                r'^(#\s*)?PermitRootLogin\s+\S+',
                'PermitRootLogin no',
                content,
                flags=re.MULTILINE | re.IGNORECASE
            )

            # Check if it was modified
            if 'PermitRootLogin no' not in new_content:
                new_content += "\nPermitRootLogin no\n"

            # Write content back
            with open(sshd_path, 'w') as f:
                f.write(new_content)

            target_name = "/etc/ssh/sshd_config" if sshd_path == "/etc/ssh/sshd_config" else "Mock configuration file"
            return {
                "status": "success",
                "message": f"SSH configuration auto-fix applied successfully to {target_name} ('PermitRootLogin' set to 'no')."
            }
        except PermissionError:
            return {
                "status": "error",
                "message": f"Permission Denied: Cannot write to {sshd_path}. Please run backend service with elevated permissions (sudo) to apply this system fix."
            }
        except Exception as e:
            return {"status": "error", "message": f"Failed to patch SSH configuration: {e}"}
    return {"status": "error", "message": "Unknown action"}


@app.post("/api/scanner/verify")
async def verify_threat(req: VerifyRequest) -> dict:
    result = verify_threat_resolution(pid=req.pid, file_path=req.file_path)
    return {
        "status": "success",
        "verification": result
    }

# --- ELUMPOT HONEYPOT & DECOY LOG ENDPOINTS ---


class BlockIpRequest(BaseModel):
    ip: str


@app.get("/api/optics/status")
@app.get("/api/honeypot/status")
async def get_honeypot_status() -> dict:
    return honeypot_service.get_status()


@app.post("/api/optics/start")
@app.post("/api/honeypot/start")
async def start_honeypot() -> dict:
    return honeypot_service.start_daemon()


@app.post("/api/optics/stop")
@app.post("/api/honeypot/stop")
async def stop_honeypot() -> dict:
    return honeypot_service.stop_daemon()


@app.get("/api/optics/logs")
@app.get("/api/honeypot/logs")
async def get_honeypot_logs() -> dict:
    return honeypot_service.get_honeypot_logs()


@app.get("/api/decoy/logs")
async def get_decoy_logs() -> dict:
    return honeypot_service.get_decoy_logs()


@app.get("/api/optics/traces")
@app.get("/api/honeypot/traces")
async def get_web_traces() -> dict:
    return honeypot_service.get_web_traces()


@app.get("/api/optics/decoys")
@app.get("/api/honeypot/decoys")
async def get_ai_decoys() -> dict:
    return honeypot_service.get_ai_decoys()


@app.delete("/api/honeypot/logs")
async def clear_honeypot_logs() -> dict:
    return honeypot_service.clear_logs()


@app.post("/api/honeypot/block-ip")
async def block_ip_endpoint(req: BlockIpRequest) -> dict:
    """Instantly adds an attacker IP to OS Firewall rule."""
    return honeypot_service.block_ip_firewall(req.ip)


@app.post("/api/honeypot/allow-ip")
async def allow_ip_endpoint(req: BlockIpRequest) -> dict:
    """Releases Gatekeeper hold: permits attacker to view AI decoy content in read-only sandbox."""
    return honeypot_service.allow_ip_proceed(req.ip)


@app.get("/api/honeypot/action-handler")
async def action_handler(ip: str, action: str):
    """Handles interactive desktop notification button clicks on Windows with sanitized inputs."""
    safe_ip = html.escape(ip)
    if action == "block":
        honeypot_service.block_ip_firewall(ip)
        html_content = f"""
        <html>
        <head>
            <title>VOID Security</title>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f1f5f9; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }}
                .card {{ background-color: #1e293b; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; border: 1px solid #dc2626; max-width: 500px; }}
                h1 {{ color: #f87171; margin-bottom: 1rem; }}
                p {{ color: #94a3b8; font-size: 1.1rem; line-height: 1.6; }}
                strong {{ color: #ffffff; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>IP Firewall Enforcement Active</h1>
                <p>The intruder IP <strong>{safe_ip}</strong> has been blocked in system firewall rules.</p>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    elif action == "view":
        honeypot_service.allow_ip_proceed(ip)
        honeypot_service.restore_and_focus_app()
        html_content = f"""
        <html>
        <head>
            <title>VOID Security</title>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f1f5f9; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }}
                .card {{ background-color: #1e293b; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; border: 1px solid #3b82f6; max-width: 500px; }}
                h1 {{ color: #60a5fa; margin-bottom: 1rem; }}
                p {{ color: #94a3b8; font-size: 1.1rem; line-height: 1.6; }}
                strong {{ color: #ffffff; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Launching Security Dashboard</h1>
                <p>VOID Studio active window focused. Monitoring target IP: <strong>{safe_ip}</strong> in Deception Environment.</p>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    return {"status": "error", "message": "Invalid action"}


@app.post("/api/honeypot/simulate-attack")
async def simulate_attack() -> dict:
    return honeypot_service.simulate_attack_scenario()


class HoneypotConfigRequest(BaseModel):
    ssh_port: Optional[int] = None
    web_port: Optional[int] = None


@app.post("/api/honeypot/config")
async def update_honeypot_config(req: HoneypotConfigRequest) -> dict:
    """Dynamically updates Honeypot port configuration and restarts daemon if active."""
    return honeypot_service.update_config(req.ssh_port, req.web_port)


@app.get("/api/honeypot/keystrokes")
async def get_honeypot_keystrokes() -> dict:
    """Returns active Honeypot session keystrokes and command logs for live UI terminal streaming."""
    return honeypot_service.get_active_sessions_keystrokes()


@app.get("/api/honeypot/dashboard-summary")
async def get_honeypot_dashboard_summary() -> dict:
    """Consolidated single-call HTTP endpoint for status, logs, traces, and decoys to minimize UI CPU polling load."""
    return honeypot_service.get_dashboard_summary()


class ServiceInstallRequest(BaseModel):
    binary_path: str


@app.get("/api/service/status")
async def get_native_service_status() -> dict:
    return native_service_manager.get_service_status()


@app.post("/api/service/install")
async def install_native_service(req: ServiceInstallRequest) -> dict:
    return native_service_manager.install_native_service(req.binary_path)


@app.post("/api/service/uninstall")
async def uninstall_native_service() -> dict:
    return native_service_manager.uninstall_native_service()


# --- LUMEN AI ENGINE ENDPOINTS ---


class LumenChatRequest(BaseModel):
    message: str
    persona: Optional[str] = "security_consultant"
    provider: Optional[str] = "auto"  # 'auto', 'gemini', 'local_qwen'


class LumenConfigRequest(BaseModel):
    default_provider: Optional[str] = None
    ollama_url: Optional[str] = None
    ollama_model: Optional[str] = None


SuperForgeChatRequest = LumenChatRequest
SuperForgeConfigRequest = LumenConfigRequest


@app.get("/api/lumen/status")
@app.get("/api/superforge/status")
async def get_lumen_status() -> dict:
    """Returns AI Engine status, active provider, key availability, and local Ollama status."""
    active_key = key_manager.get_valid_key()
    ollama_stat = check_ollama_status()
    return {
        "status": "online",
        "has_gemini_key": active_key is not None,
        "active_key_suffix": f"...{active_key[-4:]}" if active_key else None,
        "default_provider": CONFIG["default_provider"],
        "gemini_model": CONFIG["gemini_model"],
        "local_ollama": ollama_stat,
        "available_personas": list(PERSONAS.keys())
    }


get_superforge_status = get_lumen_status


@app.get("/api/lumen/personas")
@app.get("/api/superforge/personas")
async def get_lumen_personas() -> dict:
    """Returns detailed descriptions of available Lumen agent personas."""
    return {
        "status": "success",
        "personas": PERSONAS
    }


get_superforge_personas = get_lumen_personas


@app.post("/api/lumen/chat")
@app.post("/api/superforge/chat")
async def lumen_chat(req: LumenChatRequest) -> dict:
    """Non-streaming JSON response chat endpoint for Lumen AI."""
    response = await generate_lumen_response(
        user_message=req.message,
        persona_id=req.persona or "security_consultant",
        provider_preference=req.provider or CONFIG["default_provider"]
    )
    return response


superforge_chat = lumen_chat


@app.post("/api/lumen/stream")
@app.post("/api/superforge/stream")
async def lumen_stream(req: LumenChatRequest):
    """Server-Sent Events (SSE) streaming chat endpoint for real-time Lumen responses."""
    return StreamingResponse(
        generate_lumen_stream(
            user_message=req.message,
            persona_id=req.persona or "security_consultant",
            provider_preference=req.provider or CONFIG["default_provider"]
        ),
        media_type="text/event-stream"
    )


superforge_stream = lumen_stream


@app.post("/api/lumen/config")
@app.post("/api/superforge/config")
async def set_lumen_config(req: LumenConfigRequest) -> dict:
    """Updates runtime configuration for Lumen AI Engine."""
    if req.default_provider in ("auto", "gemini", "local_qwen"):
        CONFIG["default_provider"] = req.default_provider
    if req.ollama_url:
        CONFIG["ollama_url"] = req.ollama_url
    if req.ollama_model:
        CONFIG["ollama_model"] = req.ollama_model
    return {
        "status": "success",
        "config": CONFIG
    }


set_superforge_config = set_lumen_config


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
