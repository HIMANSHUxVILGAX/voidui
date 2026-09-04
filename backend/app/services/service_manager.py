import os
import sys
import platform
import subprocess
from typing import Dict, Any

class NativeOSServiceManager:
    """Enterprise Native OS Service Manager for NO-ASH Deception System.
    Provides zero-script native service installation for Windows SCM & Linux Systemd.
    """
    def __init__(self):
        self.os_type = platform.system()
        self.service_name = "NoAshDeception"
        self.display_name = "NO-ASH Enterprise Deception System Daemon"
        self.description = "Always-On Honeypot & Deception System Daemon for Port 2222 (SSH) and Port 8080 (Web)."

    def get_service_status(self) -> Dict[str, Any]:
        """Queries native OS service status."""
        try:
            if self.os_type == "Linux":
                res = subprocess.run(
                    ["systemctl", "is-active", self.service_name],
                    capture_output=True,
                    text=True
                )
                is_active = res.stdout.strip() == "active"
                return {
                    "status": "success",
                    "installed": os.path.exists(f"/etc/systemd/system/{self.service_name}.service"),
                    "running": is_active,
                    "os": "Linux"
                }
            elif self.os_type == "Windows":
                res = subprocess.run(
                    f"sc query {self.service_name}",
                    shell=True,
                    capture_output=True,
                    text=True
                )
                is_running = "RUNNING" in res.stdout
                is_installed = "FAILED 1060" not in res.stdout
                return {
                    "status": "success",
                    "installed": is_installed,
                    "running": is_running,
                    "os": "Windows"
                }
        except Exception as e:
            return {"status": "error", "message": str(e), "os": self.os_type}
        return {"status": "unknown", "os": self.os_type}

    def install_native_service(self, binary_path: str) -> Dict[str, Any]:
        """Installs native OS daemon service."""
        try:
            if self.os_type == "Linux":
                service_content = f"""[Unit]
Description={self.description}
After=network.target

[Service]
Type=simple
ExecStart={binary_path}
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
"""
                service_file = f"/tmp/{self.service_name}.service"
                with open(service_file, "w") as f:
                    f.write(service_content)

                # Move service file and reload systemd
                subprocess.run(f"sudo cp {service_file} /etc/systemd/system/{self.service_name}.service", shell=True, check=True)
                subprocess.run("sudo systemctl daemon-reload", shell=True, check=True)
                subprocess.run(f"sudo systemctl enable {self.service_name}", shell=True, check=True)
                subprocess.run(f"sudo systemctl start {self.service_name}", shell=True, check=True)

                return {
                    "status": "success",
                    "message": "Linux Systemd service installed and started successfully.",
                    "service": self.service_name
                }
            elif self.os_type == "Windows":
                cmd = (
                    f'sc create {self.service_name} binPath= "{binary_path}" '
                    f'DisplayName= "{self.display_name}" start= auto'
                )
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                if res.returncode == 0:
                    subprocess.run(f"sc start {self.service_name}", shell=True, capture_output=True)
                    return {
                        "status": "success",
                        "message": "Windows Service Control Manager service registered successfully.",
                        "service": self.service_name
                    }
                else:
                    return {"status": "error", "message": res.stderr or res.stdout}
        except Exception as e:
            return {"status": "error", "message": str(e)}

        return {"status": "error", "message": "Unsupported operating system"}

    def uninstall_native_service(self) -> Dict[str, Any]:
        """Removes native OS service."""
        try:
            if self.os_type == "Linux":
                subprocess.run(f"sudo systemctl stop {self.service_name}", shell=True)
                subprocess.run(f"sudo systemctl disable {self.service_name}", shell=True)
                subprocess.run(f"sudo rm -f /etc/systemd/system/{self.service_name}.service", shell=True)
                subprocess.run("sudo systemctl daemon-reload", shell=True)
                return {"status": "success", "message": "Linux Systemd service removed."}
            elif self.os_type == "Windows":
                subprocess.run(f"sc stop {self.service_name}", shell=True)
                subprocess.run(f"sc delete {self.service_name}", shell=True)
                return {"status": "success", "message": "Windows Service removed."}
        except Exception as e:
            return {"status": "error", "message": str(e)}
        return {"status": "error", "message": "Unsupported OS"}

native_service_manager = NativeOSServiceManager()
