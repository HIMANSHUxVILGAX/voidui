import os
import sys
import time
import socket
import urllib.request
import json

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

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.honeypot_service import honeypot_service, HoneypotService

INTERVAL_SECONDS = 2
ALL_TESTS_PASSED = True

def print_header(num, title):
    print(f"\n==================================================")
    print(f" 🧪 TEST {num}: {title}")
    print(f"==================================================")

def print_result(num, title, passed, details=""):
    global ALL_TESTS_PASSED
    ALL_TESTS_PASSED = ALL_TESTS_PASSED and bool(passed)
    status = "✅ PASSED" if passed else "❌ FAILED"

    print(f"[RESULT] Test {num} ({title}): {status}")
    if details:
        print(f" ℹ️ Details: {details}")
    print(f"⏳ Waiting {INTERVAL_SECONDS} seconds before next test...")
    time.sleep(INTERVAL_SECONDS)

def run_all_tests():
    print("\n" + "#" * 60)
    print("🚀 STARTING ELUMPOT PHASE 1 AUTOMATED TEST SUITE")
    print(f"⏱️ Delay between tests: {INTERVAL_SECONDS} seconds")
    print("#" * 60)

    # --- 1.1 Singleton Check ---
    print_header("1.1", "Singleton Pattern Check")
    try:
        s1 = HoneypotService()
        s2 = HoneypotService()
        is_singleton = (s1 is s2) and (s1 is honeypot_service)
        print_result("1.1", "Singleton Check", is_singleton, f"Same instance ID: {id(s1)}")
    except Exception as e:
        print_result("1.1", "Singleton Check", False, str(e))

    # --- 1.2 Initial State ---
    print_header("1.2", "Initial State Verification")
    try:
        init_ok = (
            honeypot_service.web_port == 8080 and
            honeypot_service.is_running is False and
            len(honeypot_service.ssh_logs) == 0 and
            len(honeypot_service.web_logs) == 0
        )
        print_result("1.2", "Initial State Verification", init_ok, f"Ports: SSH={honeypot_service.ssh_port}, Web={honeypot_service.web_port}, Running={honeypot_service.is_running}")
    except Exception as e:
        print_result("1.2", "Initial State Verification", False, str(e))

    # --- 2.1 Normal Daemon Start ---
    print_header("2.1", "Normal Daemon Start (Port Binding)")
    try:
        res = honeypot_service.start_daemon()
        passed = (res.get("status") == "success" and honeypot_service.is_running is True)
        print_result("2.1", "Normal Daemon Start", passed, f"Response: {res}")
    except Exception as e:
        print_result("2.1", "Normal Daemon Start", False, str(e))

    # --- 2.2 Already Running Guard ---
    print_header("2.2", "Already Running Guard Check")
    try:
        res = honeypot_service.start_daemon()
        passed = (res.get("status") == "already_running")
        print_result("2.2", "Already Running Guard", passed, f"Response: {res}")
    except Exception as e:
        print_result("2.2", "Already Running Guard", False, str(e))

    # --- 2.3 Port Conflict / Error Catch ---
    print_header("2.3", "Port Conflict & Binding Error Catch")
    try:
        honeypot_service.stop_daemon()
        honeypot_service.ssh_port = -1  # Invalid port to test error catching
        res = honeypot_service.start_daemon()
        passed = (res.get("status") == "error")
        
        # Reset ssh_port back to default 2222 for auto-fallback
        honeypot_service.ssh_port = 2222
        honeypot_service.stop_daemon()
        honeypot_service.start_daemon()
        print_result("2.3", "Port Conflict Error Catch", passed, f"Captured Error Message: '{res.get('message')}'")
    except Exception as e:
        print_result("2.3", "Port Conflict Error Catch", False, str(e))

    # --- 2.4 Clean Daemon Stop ---
    print_header("2.4", "Clean Daemon Stop Verification")
    try:
        res = honeypot_service.stop_daemon()
        passed = (res.get("status") == "success" and honeypot_service.is_running is False)
        # Restart daemon cleanly on available ports (2223 & 8088)
        honeypot_service.start_daemon()
        print_result("2.4", "Clean Daemon Stop", passed, f"Response: {res}")
    except Exception as e:
        print_result("2.4", "Clean Daemon Stop", False, str(e))

    # --- 3.1 SSH Socket Connection ---
    if not honeypot_service.is_running:
        honeypot_service.start_daemon()
    print_header("3.1", f"SSH Socket Connection & Log Capture (Port {honeypot_service.ssh_port})")
    try:
        import threading
        threading.Timer(0.2, lambda: honeypot_service.allow_ip_proceed("127.0.0.1")).start()
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("127.0.0.1", honeypot_service.ssh_port))
        banner = s.recv(1024).decode("utf-8", errors="ignore")
        s.sendall(b"root\n")
        time.sleep(1)
        s.close()

        has_ssh_log = len(honeypot_service.ssh_logs) > 0
        print_result("3.1", "SSH Socket Test", has_ssh_log, f"SSH Banner Received: '{banner.strip()}', Total SSH Logs: {len(honeypot_service.ssh_logs)}")
    except Exception as e:
        print_result("3.1", "SSH Socket Test", False, str(e))

    # --- 3.2 Web Decoy Connection ---
    print_header("3.2", f"Web Decoy HTTP Connection & Trace Capture (Port {honeypot_service.web_port})")
    try:
        import threading
        threading.Timer(0.5, lambda: honeypot_service.allow_ip_proceed("127.0.0.1")).start()
        url = f"http://127.0.0.1:{honeypot_service.web_port}/admin/confidential_passwords.txt"
        req = urllib.request.Request(url, headers={"User-Agent": "AttackerBrowser/1.0"})
        resp = urllib.request.urlopen(req, timeout=5)
        body = resp.read().decode("utf-8", errors="ignore")

        has_web_log = len(honeypot_service.web_traces) > 0 or len(honeypot_service.web_logs) > 0
        print_result("3.2", "Web Decoy Test", has_web_log, f"HTTP Status: {resp.status}, Total Web Traces: {len(honeypot_service.web_traces)}")
    except Exception as e:
        print_result("3.2", "Web Decoy Test", False, str(e))

    # --- 3.3 SECURE & BLOCK Decision ---
    print_header("3.3", "SECURE & BLOCK Gatekeeper Firewall Decision")
    try:
        res = honeypot_service.block_ip_firewall("192.168.1.50")
        passed = ("192.168.1.50" in honeypot_service.blocked_ips and honeypot_service.decision_results.get("192.168.1.50") == "block")
        print_result("3.3", "SECURE & BLOCK Decision", passed, f"Response: {res}")
    except Exception as e:
        print_result("3.3", "SECURE & BLOCK Decision", False, str(e))

    # --- 3.4 VIEW & MANIPULATE Decision ---
    print_header("3.4", "VIEW & MANIPULATE Gatekeeper Decision")
    try:
        res = honeypot_service.allow_ip_proceed("192.168.1.51")
        passed = (honeypot_service.decision_results.get("192.168.1.51") == "view")
        print_result("3.4", "VIEW & MANIPULATE Decision", passed, f"Response: {res}")
    except Exception as e:
        print_result("3.4", "VIEW & MANIPULATE Decision", False, str(e))

    # --- 4.1 Local & Public IP Geolocation ---
    print_header("4.1", "IP Geolocation Resolver (Local & Public IP)")
    try:
        geo_local = honeypot_service.resolve_geolocation("127.0.0.1")
        geo_public = honeypot_service.resolve_geolocation("8.8.8.8")
        passed = ("location" in geo_local and "location" in geo_public)
        print_result("4.1", "IP Geolocation Resolver", passed, f"Local Geo: {geo_local['location']}, Public Geo: {geo_public['location']}")
    except Exception as e:
        print_result("4.1", "IP Geolocation Resolver", False, str(e))

    # --- 4.2 Plain-English Log Formatting ---
    print_header("4.2", "Plain-English Summary Card Formatting")
    try:
        summary_ok = True
        if len(honeypot_service.ssh_logs) > 0:
            log = honeypot_service.ssh_logs[0]
            summary_ok = "plain_english_summary" in log and len(log["plain_english_summary"]) > 0
        print_result("4.2", "Plain-English Log Summary", summary_ok, f"Sample Summary: '{honeypot_service.ssh_logs[0].get('plain_english_summary') if honeypot_service.ssh_logs else 'N/A'}'")
    except Exception as e:
        print_result("4.2", "Plain-English Log Summary", False, str(e))

    # --- 5.1 AI Synthetic Decoy Generation ---
    print_header("5.1", "AI Synthetic Decoy Engine Content Generation")
    try:
        content = honeypot_service.generate_ai_decoy_content("config/passwords.txt", "10.0.0.99")
        passed = len(content) > 0
        print_result("5.1", "AI Decoy Generation", passed, f"Generated Decoy Snippet: '{content[:60]}...'")
    except Exception as e:
        print_result("5.1", "AI Decoy Generation", False, str(e))

    # --- 5.2 Session Memory Cache ---
    print_header("5.2", "Session Memory Cache Consistency")
    try:
        content2 = honeypot_service.generate_ai_decoy_content("config/passwords.txt", "10.0.0.99")
        session = honeypot_service.sessions.get("10.0.0.99")
        passed = (session is not None and "config/passwords.txt" in session.cached_ai_decoys)
        print_result("5.2", "Session Memory Cache", passed, f"Cached match: {session.cached_ai_decoys.get('config/passwords.txt') == content2}")
    except Exception as e:
        print_result("5.2", "Session Memory Cache", False, str(e))

    # --- 5.3 Decoy Vault Retrieval ---
    print_header("5.3", "AI Decoy Vault Retrieval (get_ai_decoys)")
    try:
        res = honeypot_service.get_ai_decoys()
        passed = (res.get("status") == "success" and len(res.get("decoys", [])) > 0)
        print_result("5.3", "AI Decoy Vault Retrieval", passed, f"Total Cached Decoys Found: {len(res.get('decoys', []))}")
    except Exception as e:
        print_result("5.3", "AI Decoy Vault Retrieval", False, str(e))

    # --- 6.1 Clear Logs Management ---
    print_header("6.1", "Clear Logs Reset Functionality (clear_logs)")
    try:
        res = honeypot_service.clear_logs()
        passed = (
            res.get("status") == "success" and
            len(honeypot_service.ssh_logs) == 0 and
            len(honeypot_service.web_logs) == 0 and
            len(honeypot_service.web_traces) == 0 and
            len(honeypot_service.sessions) == 0
        )
        print_result("6.1", "Clear Logs Functionality", passed, f"Response: {res}")
    except Exception as e:
        print_result("6.1", "Clear Logs Functionality", False, str(e))

    # --- 6.2 Simulated Attack Generator ---
    print_header("6.2", "1-Click Simulated Attack Generator (simulate_attack_scenario)")
    try:
        res = honeypot_service.simulate_attack_scenario()
        passed = (res.get("status") == "success" and "simulated_log" in res)
        print_result("6.2", "Simulated Attack Generator", passed, f"Simulated Attacker IP: {res.get('simulated_log', {}).get('attacker_ip')}")
    except Exception as e:
        print_result("6.2", "Simulated Attack Generator", False, str(e))

    # Final Cleanup
    honeypot_service.stop_daemon()

    print("\n" + "=" * 60)
    if ALL_TESTS_PASSED:
        print("🎉 ALL PHASE 1 TESTS PASSED")
    else:
        print("❌ PHASE 1 TEST SUITE FAILED: one or more checks did not pass")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    run_all_tests()
