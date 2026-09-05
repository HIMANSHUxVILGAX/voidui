import os
import sys
import subprocess
import PyInstaller.__main__


def build_standalone_backend():
    """Builds VOID Python Backend into a single executable binary using PyInstaller.
    Eliminates dependency on virtualenv (venv) or system python installation.
    """
    print("[PyInstaller] Building VOID Standalone Backend Binary...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    main_script = os.path.join(base_dir, "app", "main.py")
    dist_dir = os.path.join(base_dir, "dist")
    build_dir = os.path.join(base_dir, "build")

    args = [
        main_script,
        "--name=void-backend",
        "--onedir",
        "--noconfirm",
        "--clean",
        f"--paths={base_dir}",
        f"--distpath={dist_dir}",
        f"--workpath={build_dir}",
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        "--hidden-import=anyio",
        "--hidden-import=anyio._backends._asyncio",
        "--hidden-import=fastapi",
        "--hidden-import=pydantic",
        "--hidden-import=starlette",
        "--hidden-import=psutil",
        "--hidden-import=dotenv",
        "--hidden-import=google.genai",
        "--hidden-import=google.genai.types",
        "--hidden-import=app.services.ai_engine_service",
        "--hidden-import=app.services.gemini_client",
        "--hidden-import=app.services.honeypot_service",
        "--hidden-import=app.services.scanner_service",
        "--hidden-import=app.services.service_manager"
    ]

    print(f"[PyInstaller] Executing PyInstaller with args: {args}")
    PyInstaller.__main__.run(args)
    print(
        f"[PyInstaller] Standalone backend binary successfully created at: {os.path.join(dist_dir, 'void-backend')}")


if __name__ == "__main__":
    build_standalone_backend()
