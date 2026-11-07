# pre-flight validation script asserting cloud nim and gemini keys return http 200
import asyncio
import os
import sys
import time
from dotenv import load_dotenv
import httpx

# load environment variables from backend/.env
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(env_path)


async def check_nim_key():
    api_key = os.getenv("NVIDIA_API_KEY", "")
    if not api_key or "replace-with" in api_key:
        print("[NVIDIA NIM] SKIP: NVIDIA_API_KEY not configured in backend/.env")
        return False

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    # probe candidate nemotron models
    candidate_models = [
        "nvidia/llama-3.1-nemotron-70b-instruct",
        "nvidia/nemotron-3.5-lightning-30b-a3b",
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    ]

    for model in candidate_models:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 64,
            "temperature": 0.1,
        }
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                latency = (time.perf_counter() - start) * 1000.0
                if resp.status_code == 200:
                    print(f"[NVIDIA NIM] PASS: {model} responded HTTP 200 ({latency:.1f}ms)")
                    return True
                else:
                    print(f"[NVIDIA NIM] INFO: {model} HTTP {resp.status_code} ({resp.text[:60]}...)")
        except Exception as exc:
            print(f"[NVIDIA NIM] ERROR: {model} {type(exc).__name__} - {exc}")

    return False


async def check_gemini_key(key_name: str):
    api_key = os.getenv(key_name, "")
    if not api_key or "replace-with" in api_key:
        print(f"[GEMINI] SKIP: {key_name} not configured in backend/.env")
        return False

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": "ping"}]}],
        "generationConfig": {"maxOutputTokens": 5},
    }

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
            latency = (time.perf_counter() - start) * 1000.0
            if resp.status_code == 200:
                print(f"[GEMINI] PASS: {key_name} responded HTTP 200 ({latency:.1f}ms)")
                return True
            else:
                print(f"[GEMINI] FAIL: {key_name} HTTP {resp.status_code} - {resp.text[:120]}")
                return False
    except Exception as exc:
        print(f"[GEMINI] ERROR: {key_name} {type(exc).__name__} - {exc}")
        return False


async def main():
    print("=== MIRA PRE-FLIGHT KEY VERIFICATION ===")
    results = []
    results.append(await check_nim_key())
    for key in ["GEMINI_API_KEY_PRIMARY", "GEMINI_API_KEY_SECONDARY", "GEMINI_API_KEY_TERTIARY"]:
        results.append(await check_gemini_key(key))

    print("\nVerification finished.")


if __name__ == "__main__":
    asyncio.run(main())
