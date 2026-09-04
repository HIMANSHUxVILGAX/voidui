import os
import json
import time
import asyncio
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, AsyncGenerator

import psutil
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Attempt to import google.genai
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


# System Prompt Personas
PERSONAS: Dict[str, Dict[str, str]] = {
    "security_consultant": {
        "name": "Security Consultant",
        "description": "Expert cybersecurity analyst offering threat assessment, vulnerability remediation, and incidence response guidance.",
        "system_prompt": (
            "You are SuperForge Security Consultant, an expert SOC cybersecurity analyst for Avanger Scanner & System Hardening.\n\n"
            "STRICT OUT-OF-SCOPE REFUSAL RULES:\n"
            "1. You deal EXCLUSIVELY with Avanger vulnerability scans, malware remediation, system lockdown fixes, and cybersecurity threats.\n"
            "2. Under NO circumstances will you assist with coding, programming, software development, writing code, or other modules (ashCode, elumPot, AshFinder).\n"
            "3. If the user asks about coding, programming, or non-security modules for the FIRST time, respond EXACTLY with:\n"
            "   'me isme help nahi kr skta, ye mera kaam nahi'\n"
            "4. If the user asks about coding, programming, or non-security modules AGAIN (second time onwards), respond EXACTLY with:\n"
            "   'app jitna bhi jesa puch le me isme help nahi kr skta'\n\n"
            "GENERAL GUIDELINES:\n"
            "1. For valid Avanger security & threat queries, be helpful, natural, and direct in whatever language/dialect the user uses (Hinglish, Hindi, English).\n"
            "2. Give clear, concise shell commands (like `rm`, `kill`) without dumping giant unnecessary disclaimers."
        )
    },
    "system_hardening": {
        "name": "System Hardening Advisor",
        "description": "OS security specialist focused on SSH configuration, firewall rules, and security tool installation.",
        "system_prompt": (
            "You are SuperForge System Hardening Advisor. You specialize in operating system security, "
            "configuring SSH daemon directives (e.g. PermitRootLogin, PasswordAuthentication), firewall setup (ufw/iptables), "
            "and installing CLI security suites (Nmap, ClamAV, Lynis). Provide clear step-by-step shell commands."
        )
    },
    "decoy_analyst": {
        "name": "Decoy & Honeypot Specialist",
        "description": "Deception technology analyst reviewing honeypot logs (elumPot) and web decoy trap events.",
        "system_prompt": (
            "You are SuperForge Decoy & Honeypot Analyst. You analyze deception network activity, "
            "investigate fake service intrusion attempts (SSH honeypot on port 2222, web traps), "
            "identify attacker techniques, and recommend perimeter blocking strategies."
        )
    },
    "code_auditor": {
        "name": "ashCode Auditor",
        "description": "Source code security reviewer searching for web backdoors, webshells, and unsafe code patterns.",
        "system_prompt": (
            "You are SuperForge ashCode Security Auditor. You specialize in static code analysis, detecting webshells, "
            "eval/exec injection vulnerabilities, double extension execution tricks, and obfuscated payloads."
        )
    },
    "roadmap_advisor": {
        "name": "Career & Security Roadmap Coach",
        "description": "Cybersecurity learning path advisor offering skill development and certification roadmaps.",
        "system_prompt": (
            "You are SuperForge Security Roadmap Coach. You guide developers and aspiring security specialists through "
            "learning pathways (SOC Analyst, Penetration Tester, DevSecOps), certifications (CompTIA Security+, CEH, OSCP), "
            "and practical lab challenges."
        )
    }
}

# Configurable settings
CONFIG = {
    "default_provider": os.getenv("DEFAULT_PROVIDER", "local_qwen"),  # 'local_qwen', 'auto', 'gemini'
    "ollama_url": os.getenv("OLLAMA_URL", "http://localhost:11434"),
    "ollama_model": os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b"),
    "gemini_model": "gemini-3.6-flash",
}


# Key Manager and Rate-Limit Tracker
class KeyManager:
    def __init__(self):
        self.keys: List[str] = []
        self.current_idx: int = 0
        self.rate_limited_until: Dict[str, float] = {}
        self._load_keys()

    def _load_keys(self):
        primary_key = os.getenv("GEMINI_API_KEY", "").strip()
        backup_keys_str = os.getenv("GEMINI_BACKUP_KEYS", "").strip()
        
        all_keys = []
        if primary_key:
            all_keys.append(primary_key)
        if backup_keys_str:
            all_keys.extend([k.strip() for k in backup_keys_str.split(",") if k.strip()])
            
        self.keys = list(dict.fromkeys(all_keys)) # Remove duplicates

    def get_valid_key(self) -> Optional[str]:
        if not self.keys:
            return None
        now = time.time()
        for i in range(len(self.keys)):
            idx = (self.current_idx + i) % len(self.keys)
            key = self.keys[idx]
            if self.rate_limited_until.get(key, 0) < now:
                self.current_idx = idx
                return key
        return None

    def mark_rate_limited(self, key: str, cooldown_seconds: float = 60.0):
        if key:
            self.rate_limited_until[key] = time.time() + cooldown_seconds
            print(f"[KeyManager] API Key ending with ...{key[-4:]} marked rate-limited for {cooldown_seconds}s")
            # Rotate index
            if self.keys:
                self.current_idx = (self.current_idx + 1) % len(self.keys)


key_manager = KeyManager()


# Tool Calling Functions
def tool_get_system_metrics() -> Dict[str, Any]:
    """Retrieves real-time host CPU, RAM, and Disk metrics."""
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "ram_percent": psutil.virtual_memory().percent,
        "ram_used_gb": round(psutil.virtual_memory().used / (1024 ** 3), 2),
        "ram_total_gb": round(psutil.virtual_memory().total / (1024 ** 3), 2),
        "disk_percent": psutil.disk_usage("/").percent if os.path.exists("/") else psutil.disk_usage("C:\\").percent
    }


def tool_check_security_tools() -> Dict[str, Any]:
    """Checks presence of CLI security tools on host system."""
    import shutil, platform
    return {
        "nmap": shutil.which("nmap") is not None,
        "clamav": shutil.which("clamscan") is not None,
        "lynis": shutil.which("lynis") is not None,
        "platform": platform.system()
    }


# Helper function to check local Ollama availability
def check_ollama_status() -> Dict[str, Any]:
    url = f"{CONFIG['ollama_url']}/api/tags"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=2) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                models = [m.get("name") for m in data.get("models", [])]
                return {
                    "online": True,
                    "url": CONFIG["ollama_url"],
                    "models": models,
                    "target_model": CONFIG["ollama_model"]
                }
    except Exception:
        pass
    return {
        "online": False,
        "url": CONFIG["ollama_url"],
        "models": [],
        "target_model": CONFIG["ollama_model"]
    }


# Local Ollama Query Function
async def query_ollama(prompt: str, system_prompt: str, stream: bool = False) -> Dict[str, Any]:
    url = f"{CONFIG['ollama_url']}/api/generate"
    full_prompt = f"System: {system_prompt}\nUser: {prompt}\nAssistant:"
    payload = json.dumps({
        "model": CONFIG["ollama_model"],
        "prompt": full_prompt,
        "stream": stream
    }).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        loop = asyncio.get_event_loop()
        
        def _execute():
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
                
        result = await loop.run_in_executor(None, _execute)
        return {"status": "success", "text": result.get("response", ""), "provider": "local_qwen"}
    except Exception as e:
        return {"status": "error", "message": f"Local Ollama error: {e}", "provider": "local_qwen"}


def get_config_key(name: str) -> str:
    val = os.getenv(name, "").strip()
    if val:
        return val
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment") as reg:
            val, _ = winreg.QueryValueEx(reg, name)
            return str(val).strip()
    except Exception:
        pass
    return ""


# Free LLM API Pool Function (Groq / OpenRouter / Together AI)
async def query_free_llm_pool(prompt: str, system_prompt: str) -> Dict[str, Any]:
    openrouter_key = get_config_key("OPENROUTER_API_KEY")
    groq_key = get_config_key("GROQ_API_KEY")

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SuperForge/1.0"
    }
    
    if groq_key:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers["Authorization"] = f"Bearer {groq_key}"
        model = "qwen/qwen3.8-27b"
    elif openrouter_key:
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers["Authorization"] = f"Bearer {openrouter_key}"
        model = "meta-llama/llama-3.3-70b-instruct:free"
    else:
        return {
            "status": "warning",
            "text": (
                "**Free LLM Pool Notice**\n\n"
                "To use the Free API Pool (Groq / OpenRouter), set `GROQ_API_KEY` or `OPENROUTER_API_KEY` in `backend/.env`.\n"
                "Falling back to Local Qwen / Ollama."
            ),
            "provider": "free_pool"
        }

    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]
    }).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        loop = asyncio.get_event_loop()
        def _execute():
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.loads(resp.read().decode())
        res_data = await loop.run_in_executor(None, _execute)
        text = res_data["choices"][0]["message"]["content"]
        return {"status": "success", "text": text, "provider": "free_pool", "model": model}
    except Exception as e:
        return {"status": "error", "message": f"Free LLM Pool error: {e}", "provider": "free_pool"}


# Main AI Response Function
async def generate_superforge_response(
    user_message: str,
    persona_id: str = "security_consultant",
    provider_preference: str = "auto",
    history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    persona_info = PERSONAS.get(persona_id, PERSONAS["security_consultant"])
    system_prompt = persona_info["system_prompt"]

    # 1. Direct request to Local Qwen
    if provider_preference == "local_qwen":
        return await query_ollama(user_message, system_prompt)

    # 2. Direct request to Free LLM Pool
    if provider_preference == "free_pool":
        free_res = await query_free_llm_pool(user_message, system_prompt)
        if free_res.get("status") == "success":
            return free_res
        if free_res.get("text"):
            return free_res
        if free_res.get("message"):
            free_res["text"] = f"**Free LLM Pool Error**: {free_res['message']}"
            return free_res
        # Fallback to local Qwen if free pool fails
        ollama_stat = check_ollama_status()
        if ollama_stat["online"]:
            return await query_ollama(user_message, system_prompt)

    # 3. Gemini Cloud Execution
    active_key = key_manager.get_valid_key()
    if GENAI_AVAILABLE and active_key and provider_preference in ("auto", "gemini"):
        try:
            client = genai.Client(api_key=active_key)
            contents = f"{system_prompt}\n\nUser Question: {user_message}"
            
            loop = asyncio.get_event_loop()
            def _gen():
                return client.models.generate_content(
                    model=CONFIG["gemini_model"],
                    contents=contents
                )
            
            response = await loop.run_in_executor(None, _gen)
            return {
                "status": "success",
                "text": response.text,
                "provider": "gemini",
                "model": CONFIG["gemini_model"],
                "persona": persona_id
            }
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "Quota exceeded" in err_str:
                key_manager.mark_rate_limited(active_key, cooldown_seconds=60.0)
                # Failover sequence in auto mode: Free LLM Pool -> Local Qwen
                if provider_preference == "auto":
                    free_res = await query_free_llm_pool(user_message, system_prompt)
                    if free_res.get("status") == "success":
                        free_res["text"] = "[Notice: Gemini rate-limited. Served via Free LLM Pool]\n\n" + free_res["text"]
                        return free_res

                    ollama_stat = check_ollama_status()
                    if ollama_stat["online"]:
                        res = await query_ollama(user_message, system_prompt)
                        res["text"] = f"[Notice: Cloud API rate-limited. Served via Local Qwen]\n\n" + res.get("text", "")
                        return res

    # 4. Fallback to Free LLM Pool / Local Ollama
    free_res = await query_free_llm_pool(user_message, system_prompt)
    if free_res.get("status") == "success":
        return free_res

    ollama_stat = check_ollama_status()
    if ollama_stat["online"]:
        res = await query_ollama(user_message, system_prompt)
        res["text"] = f"[Notice: Served via Local Ollama / Qwen]\n\n" + res.get("text", "")
        return res

    # 4. Deterministic offline guidance. This is intentionally useful rather than
    # a refusal: it never claims that a scan, fix, or provider action occurred.
    return {
        "status": "warning",
        "text": (
            "**SuperForge Offline Security Guidance**\n\n"
            "The configured AI providers are unavailable, so this response was generated locally from a safe checklist. "
            "No system changes were made.\n\n"
            "**Immediate review**\n"
            "1. Confirm the finding's exact path, service, or configuration before applying any fix.\n"
            "2. For a suspicious file, isolate it first and preserve its hash and evidence; do not execute it.\n"
            "3. For a network source, validate the IP and review the proposed firewall rule before applying it.\n"
            "4. Re-run Avanger after remediation and verify that the finding is resolved.\n\n"
            "**Provider status**\n"
            "Gemini is not available and the local Ollama endpoint is offline. Configure a provider in SuperForge settings "
            "when AI-assisted analysis is required."
        ),
        "provider": "none",
        "persona": persona_id,
        "guidance_mode": "deterministic_offline"
    }


# SSE Stream Generator
async def generate_superforge_stream(
    user_message: str,
    persona_id: str = "security_consultant",
    provider_preference: str = "auto"
) -> AsyncGenerator[str, None]:
    persona_info = PERSONAS.get(persona_id, PERSONAS["security_consultant"])
    system_prompt = persona_info["system_prompt"]
    
    active_key = key_manager.get_valid_key()
    
    if GENAI_AVAILABLE and active_key and provider_preference in ("auto", "gemini"):
        try:
            client = genai.Client(api_key=active_key)
            contents = f"{system_prompt}\n\nUser Question: {user_message}"
            
            # Sync to async generator wrapper for Gemini stream
            loop = asyncio.get_event_loop()
            def _get_stream():
                return client.models.generate_content_stream(
                    model=CONFIG["gemini_model"],
                    contents=contents
                )
            
            stream = await loop.run_in_executor(None, _get_stream)
            for chunk in stream:
                if chunk.text:
                    payload = json.dumps({"text": chunk.text, "provider": "gemini"})
                    yield f"data: {payload}\n\n"
                    await asyncio.sleep(0.01)
            yield f"data: [DONE]\n\n"
            return
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                key_manager.mark_rate_limited(active_key)

    # Fallback to local Ollama stream or static notice
    res = await generate_superforge_response(user_message, persona_id, provider_preference)
    payload = json.dumps({"text": res.get("text", ""), "provider": res.get("provider", "fallback")})
    yield f"data: {payload}\n\n"
    yield f"data: [DONE]\n\n"
