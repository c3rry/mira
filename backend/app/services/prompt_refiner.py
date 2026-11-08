# prompt refinement and universal architectural clarifying questions generator
import os
import re
from typing import List, Optional
from backend.app.schemas import (
    ChatRefineRequest,
    ChatRefineResponse,
    ClarifyingOption,
    ClarifyingQuestion,
)


def refine_prompt_and_ask_clarifications(
    prompt: str,
    selected_options: Optional[List[str]] = None,
) -> ChatRefineResponse:
    raw_prompt = (prompt or "The Great Pyramids of Giza").strip()
    lower = raw_prompt.lower()
    selected = selected_options or []

    # Detect broad thematic biome
    if any(
        w in lower
        for w in (
            "neptune", "jupiter", "saturn", "uranus", "space", "station",
            "orbital", "moon", "lunar", "mars", "martian", "cosmos", "star",
            "observatory", "planet", "exoplanet", "methane", "astral"
        )
    ):
        suggested_biome = "space_station"
    elif any(
        w in lower
        for w in (
            "forest", "garden", "babylon", "jungle", "woods", "grove",
            "sylvan", "tree", "plant", "botanical", "swamp"
        )
    ):
        suggested_biome = "enchanted_forest"
    elif any(
        w in lower
        for w in (
            "giza", "pyramid", "sphinx", "egypt", "desert", "oasis",
            "dune", "sahara", "canyon", "mesa"
        )
    ):
        suggested_biome = "desert_oasis"
    elif any(
        w in lower
        for w in (
            "cyber", "neon", "tokyo", "arcade", "metropolis", "future",
            "city", "boulevard", "skybridge"
        )
    ):
        suggested_biome = "cyberpunk_alley"
    else:
        suggested_biome = "medieval_tavern"

    # Universal architectural follow-up questions:
    # 1. Spatial Scale & Layout (Enclosed Rooms vs Vast Open Space)
    # 2. Architectural Presence & Era (Untouched Nature vs Classical vs Advanced Tech vs Sacred)
    # 3. Atmospheric Lighting & Mood (Golden Hour vs Turbulent Storm vs Luminous Twilight vs Interior Torches)
    # 4. Underfoot Pathway & Ground (Stone Flagstones vs Natural Earth/Bedrock vs Reflective Basin vs Modular Decking)
    questions = [
        ClarifyingQuestion(
            id="spatial_layout",
            question="What is the spatial scale and layout of this environment?",
            options=[
                ClarifyingOption(
                    label="Vast Open Space & Boundless Horizon",
                    enhancement="vast boundless open-air panoramic expanse, colossal sweeping horizon stretching infinitely, open sky, massive scale, zero indoor walls, deep atmospheric depth",
                ),
                ClarifyingOption(
                    label="Enclosed Interior Rooms & Vaulted Halls",
                    enhancement="interconnected enclosed interior chambers, monumental vaulted ceiling overhead, intimate architectural rooms with stone walls, archways, and interior portals",
                ),
                ClarifyingOption(
                    label="Open Colonnade / Central Courtyard",
                    enhancement="grand open-air courtyard surrounded by monumental peristyle colonnade, covered stone porticos, and panoramic sky visible above",
                ),
                ClarifyingOption(
                    label="Multi-Level Vertical Terraces",
                    enhancement="multi-tiered vertical terraces, elevated walkways, ascending ramps, and sweeping high-altitude observation overlooks",
                ),
            ],
        ),
        ClarifyingQuestion(
            id="architectural_density",
            question="Presence of architecture and structures?",
            options=[
                ClarifyingOption(
                    label="Pure Untouched Wilderness",
                    enhancement="untouched raw natural wilderness, organic geological formations, pure nature, zero man-made pavement, zero artificial buildings",
                ),
                ClarifyingOption(
                    label="Monumental Classical Masonry",
                    enhancement="monumental hand-hewn stone masonry, colossal fluted pillars, weathered relief friezes, and ancient architectural craftsmanship",
                ),
                ClarifyingOption(
                    label="High-Tech / Observation Decks",
                    enhancement="precision-engineered structural architecture, reinforced panoramic viewing platforms, telemetry consoles, and industrial alloy frames",
                ),
                ClarifyingOption(
                    label="Sacred Mythical Sanctuary",
                    enhancement="sacred ethereal sanctuary, ornamental gilded filigree, ancient ceremonial braziers, and consecrated relics",
                ),
            ],
        ),
        ClarifyingQuestion(
            id="atmospheric_lighting",
            question="Atmospheric lighting and environmental mood?",
            options=[
                ClarifyingOption(
                    label="Golden Hour Warmth & Clear Sunlight",
                    enhancement="warm low-angle golden hour sunlight casting long dramatic shadows, crystal-clear atmospheric clarity",
                ),
                ClarifyingOption(
                    label="Turbulent Tempest & Swirling Mists",
                    enhancement="atmospheric storm currents, swirling kinetic vapor bands, volumetric fog, and dramatic high-contrast tempest illumination",
                ),
                ClarifyingOption(
                    label="Luminous Twilight & Celestial Glow",
                    enhancement="deep twilight hour, ethereal ambient luminescence, vibrant celestial horizon gradient, and velvet shadows",
                ),
                ClarifyingOption(
                    label="Warm Torches & Hearth Embers",
                    enhancement="warm flickering torchlight and glowing braziers illuminating textured surfaces against deep ambient shadows",
                ),
            ],
        ),
        ClarifyingQuestion(
            id="pathway_ground",
            question="Floor pathway and terrain underfoot?",
            options=[
                ClarifyingOption(
                    label="Flagstone / Polished Marble Pavement",
                    enhancement="smooth hand-cut stone paving slabs with detailed architectural masonry seams and crisp level floor",
                ),
                ClarifyingOption(
                    label="Natural Earth / Sand / Bedrock",
                    enhancement="untouched natural terrain, weathered bedrock, fine sedimentary ripples, and organic ground contours",
                ),
                ClarifyingOption(
                    label="Reflective Mirror Basin / Water Floor",
                    enhancement="shallow mirror-smooth reflective water basin reflecting the overhead expanse with crystalline specular highlights",
                ),
                ClarifyingOption(
                    label="Engineered Grating / Modular Decking",
                    enhancement="durable modular structural panels with non-slip industrial texture and flush illuminated perimeter seams",
                ),
            ],
        ),
    ]

    # Assemble comprehensive refined prompt
    enhancements = list(selected)
    if not enhancements:
        # Default balanced enhancement
        enhancements.append("photorealistic 8k, eye-level perspective, straight level horizon, ultra-detailed architectural textures")

    joined = ", ".join(enhancements)
    refined = f"Eye-level National Geographic photography of {raw_prompt}, {joined}"

    return ChatRefineResponse(
        refined_prompt=refined,
        suggested_biome=suggested_biome,
        clarifying_questions=questions,
    )
