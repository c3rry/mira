#!/usr/bin/env python
"""
Mira Launcher: One-click launcher for Mira Frontend and Backend.
Run inside conda env:
    python start.py
"""

import os
import sys
import shutil
import subprocess
import time
import signal

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

# Discover node executable
NODE_PATHS = [
    shutil.which("node"),
    r"C:\ProgramData\anaconda3\pkgs\nodejs-26.13.0-h80d1838_1\node.exe",
    r"C:\Program Files\nodejs\node.exe",
    r"C:\Program Files (x86)\nodejs\node.exe",
]
node_exe = next((p for p in NODE_PATHS if p and os.path.exists(p)), "node")
python_exe = sys.executable

def main():
    print("=" * 60)
    print("              STARTING MIRA RPG ENGINE")
    print("=" * 60)
    print(f" [Python]   {python_exe}")
    print(f" [Node]     {node_exe}")
    print(f" [Root]     {ROOT_DIR}")
    print("=" * 60)

    # Build environment variables
    env = os.environ.copy()
    env["PYTHONPATH"] = ROOT_DIR
    if os.path.dirname(node_exe):
        env["PATH"] = os.path.dirname(node_exe) + os.pathsep + env.get("PATH", "")

    # 1. Start FastAPI Backend on port 8001
    print("\n[1/2] Launching Backend Server on http://localhost:8001 ...")
    backend_cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "backend.app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8001",
    ]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=ROOT_DIR,
        env=env,
    )

    time.sleep(2)

    # 2. Start Next.js Frontend on port 3000
    print("[2/2] Launching Frontend Server on http://localhost:3000 ...")
    next_bin = os.path.join(FRONTEND_DIR, "node_modules", "next", "dist", "bin", "next")
    if not os.path.exists(next_bin):
        frontend_cmd = [node_exe, os.path.join(FRONTEND_DIR, "node_modules", ".bin", "next"), "dev", "-p", "3000"]
    else:
        frontend_cmd = [node_exe, next_bin, "dev", "-p", "3000"]

    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        env=env,
    )

    print("\n" + "=" * 60)
    print("  Mira is running!")
    print("  Frontend UI : http://localhost:3000")
    print("  Backend API : http://localhost:8001")
    print("  Press Ctrl+C to stop both servers.")
    print("=" * 60 + "\n")

    def shutdown(sig, frame):
        print("\nShutting down Mira servers...")
        try:
            frontend_proc.terminate()
        except Exception:
            pass
        try:
            backend_proc.terminate()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("\nBackend stopped.")
                break
            if frontend_proc.poll() is not None:
                print("\nFrontend stopped.")
                break
    except KeyboardInterrupt:
        shutdown(None, None)

if __name__ == "__main__":
    main()
