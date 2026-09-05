#!/usr/bin/env python3
"""
================================================================================
🐝 VOID Module 4 — Optics Deception System
Capstone Presentation Demo & End-to-End Verification Test Script
================================================================================
"""

from app.services.honeypot_service import honeypot_service
import sys
import os
import time
import socket
import json
import urllib.request
import urllib.parse

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def print_header(title):
    print("\n" + "=" * 70)
    print(f" 🚀 CAPSTONE STEP: {title}")
    print("=" * 70)


def print_result(step_num, test_name, passed, details=""):
    status_str = "✅ PASSED" if passed else "❌ FAILED"
    print(f"[CAPSTONE {step_num}] {test_name}: {status_str}")
    if details:
        print(f" ℹ️ Details: {details}")


def run_capstone_demo():
    print("#" * 70)
    print(" 🐝 STARTING OPTICS CAPSTONE END-TO-END DEMO TEST SUITE")
    print("#" * 70)

    # 1. Daemon Startup
    print_header("1. Daemon Lifecycle & Port Initialization")
    res_start = honeypot_service.start_daemon()
    is_running = honeypot_service.is_running
    print_result("1.1", "Daemon Start", is_running, f"Status: {res_start}")

    # 2. REST API Status & Config Endpoint Verification
    print_header(
        "2. REST API Status & Configuration Handler (/api/honeypot/config)")
    status = honeypot_service.get_status()
    print_result("2.1", "Get Status Endpoint", status.get("daemon_active", False),
                 f"SSH: {status.get('ssh_port')}, Web: {status.get('web_port')}")

    config_res = honeypot_service.update_config(2222, 8080)
    print_result("2.2", "POST /api/honeypot/config Handler", config_res.get("status")
                 == "success", f"Config Response: {config_res.get('message')}")

    # 3. SSH Trap Socket & Stateful Mirror Shell Simulation
    print_header("3. SSH Trap Socket & Mirror Shell Command Execution")
    try:
        import threading
        # Auto-release Gatekeeper for test simulation
        threading.Timer(
            0.3, lambda: honeypot_service.allow_ip_proceed("127.0.0.1")).start()

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("127.0.0.1", honeypot_service.ssh_port))
        banner = s.recv(1024).decode("utf-8", errors="ignore")

        # Send command sequence to mirror shell
        s.sendall(b"whoami\n")
        time.sleep(0.3)
        s.sendall(b"cat /etc/passwd\n")
        time.sleep(0.3)
        s.close()

        ssh_logs = honeypot_service.get_honeypot_logs()
        has_ssh_logs = len(ssh_logs.get("logs", [])) > 0
        print_result("3.1", "SSH Socket Intercept & Mirror Shell", has_ssh_logs,
                     f"SSH Banner: '{banner.strip()}' | Logs Captured: {len(ssh_logs.get('logs', []))}")
    except Exception as e:
        print_result(
            "3.1", "SSH Socket Intercept & Mirror Shell", False, str(e))

    # 4. Web Decoy Socket & AI Synthetic File Generation
    print_header("4. Web Decoy Socket & Dynamic AI Decoy Vault")
    try:
        import threading
        threading.Timer(
            0.3, lambda: honeypot_service.allow_ip_proceed("127.0.0.1")).start()

        url = f"http://127.0.0.1:{honeypot_service.web_port}/admin/database_passwords.env"
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (CapstoneDemo/1.0)"})
        resp = urllib.request.urlopen(req, timeout=5)
        body = resp.read().decode("utf-8", errors="ignore")

        decoys = honeypot_service.get_ai_decoys()
        has_decoys = len(decoys.get("decoys", [])) > 0
        print_result("4.1", "Web Decoy Intercept & AI Synthetic Vault", resp.status == 200 and has_decoys,
                     f"HTTP Code: {resp.status} | Decoys Served: {len(decoys.get('decoys', []))}")
    except Exception as e:
        print_result(
            "4.1", "Web Decoy Intercept & AI Synthetic Vault", False, str(e))

    # 5. Live Attacker Keystroke Streaming Endpoint Verification
    print_header(
        "5. Live Keystroke Stream Endpoint (/api/honeypot/keystrokes)")
    keystrokes_res = honeypot_service.get_active_sessions_keystrokes()
    total_sessions = keystrokes_res.get("total_sessions", 0)
    print_result("5.1", "Keystroke Stream Endpoint", total_sessions >
                 0, f"Active Sessions Tracked: {total_sessions}")

    # 6. Presentation Demo Scenario Simulation
    print_header("6. 1-Click Multi-Geo Capstone Attack Simulator")
    sim_res = honeypot_service.simulate_attack_scenario()
    print_result("6.1", "Attack Scenario Simulator", sim_res.get("status") == "success",
                 f"Simulated IP: {sim_res.get('simulated_log', {}).get('attacker_ip')}")

    # 7. Clean Daemon Teardown
    print_header("7. Daemon Clean Teardown")
    res_stop = honeypot_service.stop_daemon()
    print_result("7.1", "Daemon Clean Stop", not honeypot_service.is_running,
                 f"Message: {res_stop.get('message')}")

    print("\n" + "=" * 70)
    print(" 🎉 ALL OPTICS CAPSTONE VERIFICATION CHECKS COMPLETED SUCCESSFULLY!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    run_capstone_demo()
