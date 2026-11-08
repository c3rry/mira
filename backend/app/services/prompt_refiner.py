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
            "sylvan", "tree", "plant", "botanical", "swamp", "bamboo", "kyoto",
            "tea", "zen", "moss", "shrine"
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
            "city", "boulevard", "skybridge", "submarine", "steampunk", "industrial", "bunker"
        )
    ):
        return "cyberpunk_alley"
    return "medieval_tavern"


def _synthesize_tailored_questions(
    raw_prompt: str,
    selected_options: Optional[List[str]] = None,
) -> ChatRefineResponse:
    """
    Intelligent prompt-tailored fallback that extracts the user's specific nouns,
    places, and themes to construct bespoke clarifying questions and options.
    """
    clean_p = re.sub(r"[^a-zA-Z0-9\s-]", "", raw_prompt).strip()
    words = [w.capitalize() for w in clean_p.split() if len(w) > 2]
    subject = " ".join(words[:4]) if words else "The Realm"
    inferred_biome = _detect_inferred_biome(raw_prompt)
    lower = raw_prompt.lower()

    # Dynamic contextual descriptors based on detected subject themes
    if any(k in lower for k in ("tea", "kyoto", "japan", "zen", "bamboo", "shoji", "tatami")):
        q1_opts = [
            ClarifyingOption(label="Tatami Room Interior", enhancement=f"intimate tatami mat interior with low cedar tables, sliding washi shoji screens, and view of the autumn garden within {raw_prompt}"),
            ClarifyingOption(label="Covered Engawa Veranda", enhancement=f"open-air polished wooden engawa veranda running along the edge of {raw_prompt}, listening to rain dripping from cedar eaves"),
            ClarifyingOption(label="Rain-Swept Stone Courtyard", enhancement=f"traditional wet moss garden courtyard with stone lanterns, bamboo water spouts, and scarlet maple leaves within {raw_prompt}"),
            ClarifyingOption(label="Elevated Bamboo Overlook", enhancement=f"elevated tea pavilion terrace looking out across the misty bamboo groves and hills of {raw_prompt}"),
        ]
        q2_opts = [
            ClarifyingOption(label="Traditional Edo / Sukiya Woodcraft", enhancement="hand-planed hinoki cedar joinery, woven reed ceilings, mud plaster walls, and minimalist Japanese craftsmanship"),
            ClarifyingOption(label="Rustic Mountain Hut (Wabi-Sabi)", enhancement="weathered cedar timbers, rough-hewn posts, natural stone foundations, and rustic simplicity"),
            ClarifyingOption(label="Imperial Aristocratic Villa", enhancement="ornate gilded lacquer accents, painted silk sliding screens, and refined Kyoto craftsmanship"),
        ]
        q3_opts = [
            ClarifyingOption(label="Warm Paper Lantern Glow", enhancement="soft amber lantern light filtering through washi paper screens against twilight autumn rain"),
            ClarifyingOption(label="Overcast Rainy Afternoon", enhancement="moody overcast sky with gentle rain drizzling over mossy stones and wet tiles"),
            ClarifyingOption(label="Sunken Irori Hearth Fire", enhancement="flickering golden firelight and charcoal embers from a traditional sunken irori hearth"),
        ]
    elif any(k in lower for k in ("submarine", "underwater", "arctic", "ice", "ocean", "naval", "sonar", "bunker")):
        q1_opts = [
            ClarifyingOption(label="Pressurized Control Room", enhancement=f"dense interior command compartment with glowing analog sonar consoles, brass dials, valve wheels, and submarine bulkheads within {raw_prompt}"),
            ClarifyingOption(label="Vast Windswept Polar Ice Shelf", enhancement=f"colossal open-air arctic ice shelf with jagged pressure ridges and frozen sea stretching to the infinite horizon around {raw_prompt}"),
            ClarifyingOption(label="Conning Tower Deck Overlook", enhancement=f"standing atop the frost-coated conning tower sail looking across the docked submarine hull and arctic floes"),
            ClarifyingOption(label="Subterranean Ice Dock Pen", enhancement=f"hollowed-out glacial cavern submarine pen with hanging stalactites and frozen dark water berths"),
        ]
        q2_opts = [
            ClarifyingOption(label="Soviet Cold-War Industrial Alloy", enhancement="riveted titanium steel hull plates, stenciled cyrillic maintenance markings, and utilitarian pressure seals"),
            ClarifyingOption(label="Abandoned Weathered Relic", enhancement="thick sea salt encrustations, rusted steel seams, frost heave cracks, and derelict maritime decay"),
            ClarifyingOption(label="Active Polar Research Outpost", enhancement="reinforced composite thermal insulation, satellite telemetry antennas, and modern scientific instruments"),
        ]
        q3_opts = [
            ClarifyingOption(label="Aurora Borealis Green Glow", enhancement="dramatic emerald and violet aurora borealis curtains rippling across the dark polar sky"),
            ClarifyingOption(label="Dim Emergency Red Lighting", enhancement="moody red battle-lanterns casting stark shadows across steel bulkheads and frosted glass"),
            ClarifyingOption(label="Blinding Arctic Whiteout", enhancement="harsh pale arctic daylight diffusing through swirling snow flurries and blue glacial ice"),
        ]
    elif any(k in lower for k in ("neptune", "jupiter", "saturn", "gas giant", "methane", "cosmos", "space", "orbital")):
        q1_opts = [
            ClarifyingOption(label="Vast Methane Cloud Decks", enhancement=f"boundless sweeping horizon across swirling azure and cobalt methane cloud decks stretching infinitely in {raw_prompt}, zero buildings"),
            ClarifyingOption(label="Pressurized Observation Dome", enhancement=f"reinforced transparent quartz observation dome of a tropospheric station looking out into the raging storms of {raw_prompt}"),
            ClarifyingOption(label="Cantilevered Station Gantry", enhancement=f"exterior metal walkway suspended directly above supersonic storm bands and swirling vortexes"),
            ClarifyingOption(label="High Mantle Diamond Hail", enhancement=f"descent into the deep high-pressure mantle with crystalline diamond hail and electric blue auroral sheets"),
        ]
        q2_opts = [
            ClarifyingOption(label="Pure Cosmic Wilderness", enhancement="untouched gas giant planetary expanse, pure nature, zero terrestrial masonry, zero buildings"),
            ClarifyingOption(label="Orbital Aerospace Titanium", enhancement="precision-machined titanium-alloy trusses, thermal shielding tiles, and scientific telemetry arrays"),
            ClarifyingOption(label="Ethereal Alien Monolith", enhancement="mysterious polished obsidian geometric structures anchored within the planetary clouds"),
        ]
        q3_opts = [
            ClarifyingOption(label="Electric Cyan Storm Arcs", enhancement="bioluminescent cyan and violet lightning sheets illuminating dense sapphire atmospheric clouds"),
            ClarifyingOption(label="Faint Pinprick Sunlight", enhancement="faint distant solar glint reflecting off high-altitude methane ice crystals across a velvet black sky"),
            ClarifyingOption(label="Deep Indigo Twilight", enhancement="monochromatic deep indigo tropospheric darkness with luminous atmospheric aurora sheets"),
        ]
    else:
        # Dynamic extraction for any user prompt
        q1_opts = [
            ClarifyingOption(label=f"Vast Open Expanse of {subject}", enhancement=f"vast boundless open-air panoramic expanse across {raw_prompt}, colossal sweeping horizon, open atmospheric sky, massive scale, zero indoor walls, deep perspective"),
            ClarifyingOption(label=f"Enclosed Interior Rooms of {subject}", enhancement=f"interconnected enclosed interior rooms and chambers within {raw_prompt}, detailed interior walls, vaulted ceiling overhead, intimate architectural portals"),
            ClarifyingOption(label=f"Central Courtyard of {subject}", enhancement=f"grand open-air courtyard within {raw_prompt} surrounded by covered porticos, colonnades, and central plaza open to the sky"),
            ClarifyingOption(label=f"Elevated Terraces of {subject}", enhancement=f"multi-tiered vertical terraces and elevated walkways across {raw_prompt}, ascending ramps, and panoramic overlook across the surroundings"),
        ]
        q2_opts = [
            ClarifyingOption(label="Pure Untouched Wilderness", enhancement=f"untouched raw natural terrain of {raw_prompt}, organic geological formations, pure nature, zero man-made buildings, zero artificial pavement"),
            ClarifyingOption(label="Monumental Hand-Crafted Masonry", enhancement=f"hand-hewn stone masonry, monumental fluted pillars, weathered relief friezes, and authentic architectural craftsmanship of {raw_prompt}"),
            ClarifyingOption(label="Refined Historic / Cultural Architecture", enhancement=f"authentic cultural architectural detailing, traditional materials, ornamental craftsmanship, and historical aesthetics of {raw_prompt}"),
            ClarifyingOption(label="Engineered / Modern Structures", enhancement=f"precision-engineered structural architecture, reinforced observation decks, telemetry apertures, and utilitarian structural framing of {raw_prompt}"),
        ]
        q3_opts = [
            ClarifyingOption(label="Golden Hour Warmth & Clear Sunlight", enhancement=f"warm low-angle golden hour sunlight illuminating {raw_prompt}, long cinematic shadows, radiant atmospheric clarity"),
            ClarifyingOption(label="Turbulent Storm & Atmospheric Mists", enhancement=f"kinetic atmospheric storm currents, swirling mists, volumetric fog, and dramatic high-contrast lighting across {raw_prompt}"),
            ClarifyingOption(label="Luminous Twilight & Ambient Glow", enhancement=f"deep twilight hour, ethereal ambient luminescence, glowing horizon gradient, and velvet atmospheric shadows across {raw_prompt}"),
            ClarifyingOption(label="Warm Interior Lanterns / Torches", enhancement=f"warm glowing lanterns, flickering torchlight, and radiant hearth embers casting warm ambient glows across {raw_prompt}"),
        ]

    questions = [
        ClarifyingQuestion(id="spatial_layout", question=f"What is the spatial layout and scale of {subject}?", options=q1_opts),
        ClarifyingQuestion(id="architectural_density", question=f"What architectural style and materials define {subject}?", options=q2_opts),
        ClarifyingQuestion(id="atmospheric_lighting", question=f"Atmospheric lighting and environmental mood for {subject}?", options=q3_opts),
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
    Tries live Gemini structured generation first (gemini-3.5-flash-lite); falls back dynamically to prompt-tailored synthesis.
    """
    raw_prompt = (prompt or "The Great Pyramids of Giza").strip()
    api_key = get_active_api_key()

    if api_key:
        candidate_models = ["gemini-3.5-flash-lite", "gemini-3.8-flash"]
        sys_instruction = (
            "You are an expert 3D environmental architect and level designer for an RPG engine. "
            "Given the user's initial world prompt, generate 3 to 4 tailored, insightful follow-up questions "
            "specifically crafted for this exact prompt to help clarify the user's vision before generating 360 neural panoramas. "
            "CRITICAL REQUIREMENTS:\n"
            "1. Every question and option MUST be dynamically crafted from the user's subject keywords (e.g. if Kyoto tea shop, ask about tatami tea rooms vs open garden veranda vs bamboo courtyard; if submarine, ask about control room vs torpedo bay vs ice shelf; if cathedral, ask about nave vs crypt vs rose window).\n"
            "2. ALWAYS include a question clarifying spatial layout (e.g. enclosed interior rooms/corridors vs vast open space/horizon vs open courtyard/terrace) tailored specifically to their subject.\n"
            "3. For each question, provide 3 to 4 distinct, evocative options.\n"
            "4. Each option MUST have:\n"
            "   - 'label': Short 2-5 word title for the button chip (e.g., 'Tatami Room View', 'Open Garden Veranda').\n"
            "   - 'enhancement': Detailed visual descriptor specifying materials, lighting, perspective, and architectural details to inject into the diffusion prompt.\n"
            "5. Also suggest the most fitting base biome from ['medieval_tavern', 'desert_oasis', 'enchanted_forest', 'space_station', 'cyberpunk_alley'].\n"
            "6. Assemble a refined_prompt incorporating the user's original prompt.\n"
            "Return valid JSON strictly matching the schema with keys: 'refined_prompt', 'suggested_biome', 'clarifying_questions' (list of {id, question, options: [{label, enhancement}]})."
        )

        user_content = f"User initial prompt: {raw_prompt}"
        if selected_options:
            user_content += f"\nCurrently selected options: {json.dumps(selected_options)}"

        for model_name in candidate_models:
            try:
                client = genai.Client(api_key=api_key)
                resp = client.models.generate_content(
                    model=model_name,
                    contents=user_content,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_instruction,
                        response_mime_type="application/json",
                        temperature=0.7,
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
                logger.warning(f"Model {model_name} prompt refinement failed: {exc}")
                continue

    # Fallback to prompt-tailored synthesis
    return _synthesize_tailored_questions(raw_prompt, selected_options)
