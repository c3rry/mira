# dynamic prompt refinement and tailored architectural clarifying questions generator
import asyncio
import json
import logging
import os
import re
from typing import List, Optional
from google import genai
from google.genai import types

from backend.app.schemas import (
    ChatRefineResponse,
    ClarifyingOption,
    ClarifyingQuestion,
)
from backend.app.services.gemini_generator import get_active_api_key, mark_key_cooldown

logger = logging.getLogger("mira.prompt_refiner")


def _detect_inferred_biome(text: str) -> str:
    lower = text.lower()
    if any(
        w in lower
        for w in (
            "neptune", "jupiter", "saturn", "uranus", "space", "station",
            "orbital", "moon", "lunar", "mars", "martian", "cosmos", "star",
            "observatory", "planet", "exoplanet", "methane", "astral", "asteroid"
        )
    ):
        return "space_station"
    if any(
        w in lower
        for w in (
            "forest", "garden", "babylon", "jungle", "woods", "grove",
            "sylvan", "tree", "plant", "botanical", "swamp", "bamboo", "kyoto"
        )
    ):
        return "enchanted_forest"
    if any(
        w in lower
        for w in (
            "giza", "pyramid", "sphinx", "egypt", "desert", "oasis",
            "dune", "sahara", "canyon", "mesa", "badlands"
        )
    ):
        return "desert_oasis"
    if any(
        w in lower
        for w in (
            "cyber", "neon", "tokyo", "arcade", "metropolis", "future",
            "city", "boulevard", "skybridge", "submarine", "steampunk", "industrial"
        )
    ):
        return "cyberpunk_alley"
    return "medieval_tavern"


def _synthesize_tailored_questions(
    raw_prompt: str,
    selected_options: Optional[List[str]] = None,
) -> ChatRefineResponse:
    """
    Dynamic prompt-tailored synthesis that extracts the user's specific keywords
    and constructs bespoke clarifying questions (Spatial Scale: Rooms vs Vast Open Space,
    Architectural Density, Lighting/Atmosphere, and Underfoot Pathways).
    """
    clean_p = re.sub(r"[^a-zA-Z0-9\s-]", "", raw_prompt).strip()
    words = [w.capitalize() for w in clean_p.split() if len(w) > 2]
    subject = " ".join(words[:4]) if words else "The Realm"
    inferred_biome = _detect_inferred_biome(raw_prompt)
    lower = raw_prompt.lower()

    # Determine domain-tailored descriptors based on the user's input
    is_open_nature = any(
        w in lower
        for w in (
            "mountain", "summit", "peak", "ocean", "sea", "desert", "plain",
            "expanse", "sky", "horizon", "glacier", "wilderness", "canyon"
        )
    )
    is_interior = any(
        w in lower
        for w in (
            "shop", "room", "tavern", "chamber", "hall", "cathedral", "crypt",
            "library", "bunker", "cabin", "house", "dojo", "observatory", "temple"
        )
    )

    room_label = f"Enclosed Interior Rooms & Vaulted Chambers of {subject}"
    open_label = f"Vast Open Expanse & Infinite Horizon of {subject}"
    courtyard_label = f"Semi-Enclosed Colonnade & Central Courtyard of {subject}"
    terrace_label = f"Multi-Level Terraces & Panoramic Overlook of {subject}"

    questions = [
        ClarifyingQuestion(
            id="spatial_layout",
            question=f"What is the spatial layout and scale of {subject}?",
            options=[
                ClarifyingOption(
                    label=f"Vast Open Space & Boundless Horizon",
                    enhancement=f"vast boundless open-air panoramic expanse across {raw_prompt}, colossal sweeping horizon, open atmospheric sky, massive scale, zero indoor walls, deep perspective",
                ),
                ClarifyingOption(
                    label=f"Enclosed Interior Rooms & Vaulted Halls",
                    enhancement=f"interconnected enclosed interior rooms and chambers within {raw_prompt}, detailed interior walls, vaulted ceiling overhead, intimate architectural portals",
                ),
                ClarifyingOption(
                    label=f"Semi-Enclosed Courtyard / Portico",
                    enhancement=f"grand open-air courtyard within {raw_prompt} surrounded by covered porticos, colonnades, and central plaza open to the sky",
                ),
                ClarifyingOption(
                    label=f"Multi-Level Terraces & Overlook",
                    enhancement=f"multi-tiered vertical terraces and elevated walkways across {raw_prompt}, ascending ramps, and panoramic overlook across the surroundings",
                ),
            ],
        ),
        ClarifyingQuestion(
            id="architectural_density",
            question=f"Presence of architecture and craftsmanship in {subject}?",
            options=[
                ClarifyingOption(
                    label="Pure Untouched Wilderness",
                    enhancement=f"untouched raw natural terrain of {raw_prompt}, organic geological formations, pure nature, zero man-made buildings, zero artificial pavement",
                ),
                ClarifyingOption(
                    label="Monumental Hand-Crafted Masonry",
                    enhancement=f"hand-hewn stone masonry, monumental fluted pillars, weathered relief friezes, and authentic architectural craftsmanship of {raw_prompt}",
                ),
                ClarifyingOption(
                    label="Refined Historic / Cultural Architecture",
                    enhancement=f"authentic cultural architectural detailing, traditional timber framing, ornamental craftsmanship, and historical aesthetics of {raw_prompt}",
                ),
                ClarifyingOption(
                    label="Engineered / Technological Structures",
                    enhancement=f"precision-engineered structural architecture, reinforced observation decks, telemetry apertures, and utilitarian structural framing of {raw_prompt}",
                ),
            ],
        ),
        ClarifyingQuestion(
            id="atmospheric_lighting",
            question=f"Atmospheric lighting and environmental weather for {subject}?",
            options=[
                ClarifyingOption(
                    label="Golden Hour Warmth & Clear Sunlight",
                    enhancement=f"warm low-angle golden hour sunlight illuminating {raw_prompt}, long cinematic shadows, radiant atmospheric clarity",
                ),
                ClarifyingOption(
                    label="Turbulent Storm & Atmospheric Mists",
                    enhancement=f"kinetic atmospheric storm currents, swirling mists, volumetric fog, and dramatic high-contrast lighting across {raw_prompt}",
                ),
                ClarifyingOption(
                    label="Luminous Twilight & Celestial Glow",
                    enhancement=f"deep twilight hour, ethereal ambient luminescence, glowing horizon gradient, and velvet atmospheric shadows across {raw_prompt}",
                ),
                ClarifyingOption(
                    label="Warm Interior Lanterns / Torches",
                    enhancement=f"warm glowing lanterns, flickering torchlight, and radiant hearth embers casting warm ambient glows across {raw_prompt}",
                ),
            ],
        ),
        ClarifyingQuestion(
            id="pathway_ground",
            question=f"Floor pathway and ground terrain underfoot in {subject}?",
            options=[
                ClarifyingOption(
                    label="Paved Stone / Architectural Flooring",
                    enhancement=f"smooth hand-cut stone paving slabs, polished architectural flooring, and detailed masonry seams in {raw_prompt}",
                ),
                ClarifyingOption(
                    label="Natural Earth / Sand / Bedrock",
                    enhancement=f"untouched natural terrain, weathered bedrock, fine sedimentary ripples, and organic ground contours of {raw_prompt}",
                ),
                ClarifyingOption(
                    label="Reflective Polished Surface / Basin",
                    enhancement=f"mirror-smooth reflective surface reflecting the overhead environment of {raw_prompt} with crystalline specular highlights",
                ),
                ClarifyingOption(
                    label="Engineered Decking / Wooden Planks",
                    enhancement=f"richly textured wooden timber decking or modular panels with flush seams and perimeter boundary trim in {raw_prompt}",
                ),
            ],
        ),
    ]

    selected = selected_options or []
    enhancements = list(selected)
    if not enhancements:
        enhancements.append("photorealistic 8k, eye-level perspective, straight level horizon, ultra-detailed textures")

    joined = ", ".join(enhancements)
    refined = f"Eye-level National Geographic photography of {raw_prompt}, {joined}"

    return ChatRefineResponse(
        refined_prompt=refined,
        suggested_biome=inferred_biome,
        clarifying_questions=questions,
    )


def refine_prompt_and_ask_clarifications(
    prompt: str,
    selected_options: Optional[List[str]] = None,
) -> ChatRefineResponse:
    """
    Generates tailored clarifying questions based directly on the user's initial prompt.
    Tries live Gemini structured generation first; falls back dynamically to prompt-tailored synthesis.
    """
    raw_prompt = (prompt or "The Great Pyramids of Giza").strip()
    api_key = get_active_api_key()

    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            sys_instruction = (
                "You are an expert 3D environmental architect and level designer for an RPG engine. "
                "Given the user's initial world prompt, generate 3 to 4 tailored, insightful follow-up questions "
                "specifically crafted for this exact prompt to help clarify the user's vision before generating 360 neural panoramas. "
                "CRITICAL REQUIREMENTS:\n"
                "1. Every question and option MUST be dynamically tailored to the user's subject keywords (e.g. if the prompt is about Kyoto, name Kyoto/Japan features; if about a submarine, name control rooms, torpedo bays, arctic ice; if about Neptune, name methane clouds, orbital stations).\n"
                "2. ALWAYS include a question clarifying spatial layout (e.g. enclosed interior rooms/corridors vs vast open space/horizon vs open courtyard/terrace) tailored specifically to their subject.\n"
                "3. For each question, provide 3 to 4 distinct, evocative options.\n"
                "4. Each option MUST have:\n"
                "   - 'label': Short 2-5 word title for the button chip (e.g., 'Tatami Tea Room', 'Open Garden Veranda').\n"
                "   - 'enhancement': Detailed visual descriptor specifying materials, lighting, perspective, and architectural details to inject into the diffusion prompt.\n"
                "5. Also suggest the most fitting base biome from ['medieval_tavern', 'desert_oasis', 'enchanted_forest', 'space_station', 'cyberpunk_alley'].\n"
                "6. Assemble a refined_prompt incorporating the user's original prompt and any selected options.\n"
                "Return valid JSON strictly matching the schema."
            )

            user_content = f"User initial prompt: {raw_prompt}"
            if selected_options:
                user_content += f"\nCurrently selected options: {json.dumps(selected_options)}"

            resp = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=user_content,
                config=types.GenerateContentConfig(
                    system_instruction=sys_instruction,
                    response_mime_type="application/json",
                    temperature=0.7,
                    http_options=types.HttpOptions(timeout=10000),
                ),
            )

            if resp and resp.text:
                data = json.loads(resp.text)
                questions_raw = data.get("clarifying_questions") or []
                if isinstance(questions_raw, list) and len(questions_raw) > 0:
                    parsed_questions: List[ClarifyingQuestion] = []
                    for q in questions_raw:
                        q_id = q.get("id") or f"q_{len(parsed_questions)}"
                        q_text = q.get("question") or "Clarify this dimension:"
                        raw_opts = q.get("options") or []
                        opts: List[ClarifyingOption] = []
                        for opt in raw_opts:
                            lbl = opt.get("label") or "Option"
                            enh = opt.get("enhancement") or lbl
                            opts.append(ClarifyingOption(label=lbl, enhancement=enh))
                        if opts:
                            parsed_questions.append(
                                ClarifyingQuestion(id=q_id, question=q_text, options=opts)
                            )

                    if parsed_questions:
                        refined_prompt = data.get("refined_prompt") or f"Eye-level National Geographic photography of {raw_prompt}"
                        suggested_biome = data.get("suggested_biome") or _detect_inferred_biome(raw_prompt)
                        return ChatRefineResponse(
                            refined_prompt=refined_prompt,
                            suggested_biome=suggested_biome,
                            clarifying_questions=parsed_questions,
                        )

        except Exception as exc:
            err_str = str(exc)
            if "429" in err_str or "quota" in err_str.lower() or "exhausted" in err_str.lower():
                mark_key_cooldown(api_key, cooldown_seconds=60.0)
            logger.warning(f"Live Gemini prompt refinement failed, falling back to prompt synthesis: {exc}")

    # Fallback to prompt-tailored synthesis
    return _synthesize_tailored_questions(raw_prompt, selected_options)
