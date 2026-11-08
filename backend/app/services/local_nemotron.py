# Local NVIDIA Nemotron inference pipeline running on local GPU
# Uses nvidia/Nemotron-Mini-4B-Instruct in bfloat16 directly on CUDA in < 1 second

import json
import logging
import os
import re
import threading
import time
from typing import Any, Dict, Optional

logger = logging.getLogger("mira.local_nemotron")

_MODEL = None
_TOKENIZER = None
_LOCK = threading.Lock()


def get_local_nemotron():
    global _MODEL, _TOKENIZER
    if _MODEL is not None and _TOKENIZER is not None:
        return _MODEL, _TOKENIZER

    with _LOCK:
        if _MODEL is not None and _TOKENIZER is not None:
            return _MODEL, _TOKENIZER

        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        model_id = os.getenv("LOCAL_NEMOTRON_MODEL", "nvidia/Nemotron-Mini-4B-Instruct")
        logger.info(f"Loading local Nemotron on GPU: {model_id}...")
        t0 = time.perf_counter()

        try:
            tokenizer = AutoTokenizer.from_pretrained(model_id, local_files_only=True)
            dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
            model = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype=dtype,
                use_safetensors=False,
                local_files_only=True,
                low_cpu_mem_usage=False,
            ).to("cuda:0")
            model.eval()
            _TOKENIZER = tokenizer
            _MODEL = model
            logger.info(f"Loaded local Nemotron {model_id} on CUDA in {time.perf_counter() - t0:.2f}s")
            return _MODEL, _TOKENIZER
        except Exception as e:
            logger.error(f"Failed to load local Nemotron model: {e}")
            return None, None


def clean_ai_artifacts(text: str) -> str:
    """Removes em dashes and emojis from text for clean, human-crafted tone."""
    if not text:
        return ""
    # Replace em dashes with standard punctuation
    text = text.replace("—", ", ").replace("–", "-")
    # Remove emoji characters
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags (iOS)
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "\U0001F900-\U0001F9FF"  # supplemental symbols
        "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-a
        "]+",
        flags=re.UNICODE,
    )
    return emoji_pattern.sub("", text).strip()


def format_chip_label(text: str) -> str:
    """Formats chip options from raw snake_case or messy text to clean Title Case."""
    if not text:
        return ""
    clean = clean_ai_artifacts(str(text))
    # Replace underscores and hyphens with spaces
    clean = clean.replace("_", " ").replace("-", " ")
    # Capitalize words
    words = [w.capitalize() if not w.isupper() or len(w) > 4 else w for w in clean.split()]
    formatted = " ".join(words)
    return formatted.strip()


def sanitize_mira_self_references(text: str) -> str:
    """Removes awkward self-referential AI phrases like 'As the World Architect', 'I am an AI', etc."""
    if not text:
        return ""
    text = re.sub(r"^(?:As the World Architect|As Mira,? the World Architect|As an AI|As your Narrative Director)[,:\s]+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"(?:As the World Architect|As your Narrative Director)[,:\s]+", "", text, flags=re.IGNORECASE)
    return text.strip()


def parse_nemotron_structured_response(response_text: str, user_prompt: str = "") -> Dict[str, Any]:
    """
    Parses both strict JSON, relaxed JSON, or labeled Utterance/Follow-up text into a valid dict.
    Guarantees 'utterance', 'follow_up', and 'suggested_chips' are returned.
    """
    import json_repair

    cleaned_raw = response_text.strip()

    # 1. First attempt: JSON or markdown code block parse
    candidate_json = cleaned_raw
    if "```json" in candidate_json:
        candidate_json = candidate_json.split("```json")[1].split("```")[0].strip()
    elif "```" in candidate_json:
        candidate_json = candidate_json.split("```")[1].split("```")[0].strip()

    try:
        parsed = json_repair.loads(candidate_json)
        if isinstance(parsed, dict) and parsed:
            u = parsed.get("utterance") or parsed.get("synopsis") or parsed.get("text") or ""
            f = parsed.get("follow_up") or parsed.get("question") or parsed.get("next_question") or ""
            chips = parsed.get("suggested_chips") or parsed.get("options") or []
            if isinstance(chips, list):
                norm_chips = []
                for c in chips:
                    if isinstance(c, dict):
                        norm_chips.append(format_chip_label(c.get("name") or c.get("title") or str(c)))
                    elif isinstance(c, str):
                        norm_chips.append(format_chip_label(c))
                chips = norm_chips

            if u or f or chips:
                # If utterance is empty but we have chips, give an inspiring narrative intro
                cleaned_u = sanitize_mira_self_references(clean_ai_artifacts(str(u)))
                cleaned_f = sanitize_mira_self_references(clean_ai_artifacts(str(f)))
                if not cleaned_u and chips:
                    cleaned_u = f"The realm unfolds. Which pathway or clue calls to you?"
                return {
                    "utterance": cleaned_u,
                    "follow_up": cleaned_f,
                    "suggested_chips": chips,
                    **{k: v for k, v in parsed.items() if k not in ["utterance", "follow_up", "suggested_chips"]},
                }
    except Exception:
        pass

    # 2. Second attempt: Extract with regex labeled Utterance: and Follow-up:
    u_match = re.search(
        r"(?:utterance|mira|narrator):\s*(.*?)(?=(?:follow[\s_-]?up|question|chips|options|$))",
        cleaned_raw,
        re.IGNORECASE | re.DOTALL,
    )
    f_match = re.search(
        r"(?:follow[\s_-]?up|question):\s*(.*?)(?=(?:chips|options|$))",
        cleaned_raw,
        re.IGNORECASE | re.DOTALL,
    )

    utterance = u_match.group(1).strip() if u_match else ""
    follow_up = f_match.group(1).strip() if f_match else ""

    # 3. Third attempt: Split into paragraphs
    if not utterance and not follow_up:
        paras = [p.strip() for p in cleaned_raw.split("\n\n") if p.strip()]
        if len(paras) >= 2:
            utterance = paras[0]
            follow_up = paras[1]
        elif len(paras) == 1:
            utterance = paras[0]
            follow_up = "What specific mystery shall we uncover next?"

    # Contextual chips generation if none extracted
    p_lower = f"{user_prompt} {cleaned_raw}".lower()
    if any(k in p_lower for k in ["cyber", "neon", "city", "tokyo", "street", "subway"]):
        default_chips = [
            "Subterranean Market Alley and Neon Gully Crossing",
            "Rooftop Glass Skybridge and Hologram Promenade",
            "Abandoned Transit Line and Steaming Grate Pass",
        ]
    elif any(k in p_lower for k in ["pyramid", "giza", "desert", "egypt", "ruins"]):
        default_chips = [
            "Sphinx Causeway and Sunken Water Basin",
            "Grand Gallery Corbelled Vault",
            "Outer Basalt Colonnade and Horizon Crest",
        ]
    elif any(k in p_lower for k in ["space", "station", "orbit", "ship"]):
        default_chips = [
            "Zenith Biosphere Atrium and Gravity Ring",
            "Zero-G Maintenance Conduit",
            "Planetary Observation Lounge",
        ]
    else:
        default_chips = [
            "Ancient Archive and Secret Chamber",
            "Colonnaded Rotunda Sanctuary",
            "High Vista Promenade",
        ]

    return {
        "utterance": sanitize_mira_self_references(clean_ai_artifacts(utterance or "Welcome explorer. The world unfolds before you.")),
        "follow_up": sanitize_mira_self_references(clean_ai_artifacts(follow_up or "What distinct sector or clue shall we investigate?")),
        "suggested_chips": [format_chip_label(c) for c in default_chips],
    }


def generate_local_nemotron(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 400,
    temperature: float = 0.5,
) -> Optional[Dict[str, Any]]:
    """
    Executes real inference through local nvidia/Nemotron-Mini-4B-Instruct on GPU.
    Returns structured JSON output.
    """
    import torch

    model, tokenizer = get_local_nemotron()
    if model is None or tokenizer is None:
        return None

    with _LOCK:
        try:
            formatted_prompt = (
                f"<extra_id_0>System\n{system_prompt}\n"
                f"<extra_id_1>User\n{user_prompt}\n"
                f"<extra_id_1>Assistant\n"
            )

            inputs = tokenizer(formatted_prompt, return_tensors="pt").to("cuda:0")

            with torch.inference_mode():
                output_ids = model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    top_p=0.9,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id or 3,
                )

            new_tokens = output_ids[0][inputs["input_ids"].shape[1] :]
            response_text = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

            parsed = parse_nemotron_structured_response(response_text, user_prompt=user_prompt)
            return parsed
        except Exception as e:
            logger.warning(f"Error during local Nemotron generation: {e}")
            return None
