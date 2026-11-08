# infinite continuous 2d procedural world field and radial 360 panorama synthesizer
# provides deterministic coordinate-based biome gradients, non-repeating sector synthesis,
# reciprocal portal blending, and continuous 2d map generation across R^2

import math
import hashlib
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from backend.app.schemas import LightingConfig, NodeState, RoomVisualPalette

HORIZON_Y = 512
GLOBAL_SUN_AZIMUTH = -0.35  # radians


def pseudo_perlin(x: float, z: float, seed: int = 42) -> float:
    # fast deterministic multi-octave continuous scalar field in [-1, 1]
    val = 0.0
    amp = 1.0
    freq = 0.0018
    for i in range(3):
        h = int(hashlib.md5(f"{seed}_{i}".encode()).hexdigest()[:8], 16)
        ang = (h % 360) * math.pi / 180.0
        # rotated coordinates
        rx = x * math.cos(ang) - z * math.sin(ang)
        rz = x * math.sin(ang) + z * math.cos(ang)
        val += amp * math.sin(rx * freq) * math.cos(rz * freq * 1.3)
        freq *= 2.1
        amp *= 0.5
    return max(-1.0, min(1.0, val / 1.75))


class InfiniteWorldField:
    """
    Deterministic, infinite continuous 2D procedural world field.
    Any coordinate (x, z) maps to a continuous biome sector, terrain features,
    and distinct ground-level 360 landmarks.
    """

    def __init__(self, world_prompt: str = "The Necropolis of Giza", seed: int = 42):
        self.world_prompt = world_prompt.lower()
        self.seed = seed
        self.archetype = self._classify_archetype(self.world_prompt)

    def _classify_archetype(self, prompt: str) -> str:
        if any(w in prompt for w in ["noise", "continuous", "latent", "quantum", "matrix", "procedural", "manifold"]):
            return "noise"
        if any(w in prompt for w in ["space", "station", "orbital", "cosmos", "spire"]):
            return "space"
        if any(w in prompt for w in ["cyber", "metropolis", "tokyo", "arcade", "city", "neon", "street", "avenue", "broadway", "square", "urban", "district", "quarter", "manhattan", "york"]):
            return "metropolis"
        if any(w in prompt for w in ["forest", "garden", "babylon", "jungle", "sylvan", "woods"]):
            return "gardens"
        if any(w in prompt for w in ["tavern", "medieval", "castle", "guild", "keep", "library"]):
            return "medieval"
        if any(w in prompt for w in ["rome", "roman", "colosseum", "pantheon", "forum"]):
            return "rome"
        if any(w in prompt for w in ["everest", "mountain", "himalaya", "glacier", "snow", "alps"]):
            return "mountain"
        if any(w in prompt for w in ["giza", "pyramid", "egypt", "sphinx", "pharaoh", "desert", "oasis", "sand", "dune"]):
            return "desert"
        return "general"

    def sample_field(self, x: float, z: float) -> Dict[str, Any]:
        """
        Samples the infinite continuous world at continuous coordinates (x, z).
        """
        dist = math.hypot(x, z)
        # Azimuth angle from origin where 0 is North (-Z), pi/2 is East (+X), -pi/2 is West (-X), +/-pi is South (+Z)
        azimuth = math.atan2(x, -z)
        deg = (math.degrees(azimuth) + 360) % 360

        noise_moisture = pseudo_perlin(x, z, self.seed + 101)
        noise_elevation = pseudo_perlin(x, z, self.seed + 202)
        noise_density = pseudo_perlin(x, z, self.seed + 303)

        ring = int(dist // 200)

        if self.archetype == "noise":
            return self._sample_noise_field(x, z, dist, deg, ring, noise_moisture, noise_elevation)
        elif self.archetype == "metropolis":
            return self._sample_metropolis_field(x, z, dist, deg, ring, noise_moisture, noise_elevation)
        elif self.archetype == "desert":
            return self._sample_desert_field(x, z, dist, deg, ring, noise_moisture, noise_elevation)
        elif self.archetype == "gardens":
            return self._sample_gardens_field(x, z, dist, deg, ring, noise_moisture, noise_elevation)
        elif self.archetype == "space":
            return self._sample_space_field(x, z, dist, deg, ring, noise_moisture, noise_elevation)
        else:
            return self._sample_general_field(x, z, dist, deg, ring, noise_moisture, noise_elevation)

    def _sample_noise_field(
        self, x: float, z: float, dist: float, deg: float, ring: int, moisture: float, elevation: float
    ) -> Dict[str, Any]:
        if dist < 90:
            sector_type = "noise_origin"
            name = "Continuous Noise Chamber"
            desc = "Origin of the infinite multi-dimensional latent procedural manifold with shimmering quantum interference fields."
            dominant_feature = "quantum_core"
            sky_hex = "#090514"
            floor_hex = "#1e1b4b"
            accent_hex = "#a855f7"
            npc_title = "Aethel, Quantum Chronicler"
            npc_role = "Observer of the infinite procedural manifold and keeper of multi-dimensional latent harmonics."
        elif 45 <= deg < 135:
            # East
            sector_type = "resonance"
            name = f"Harmonic Resonance Promenade — Sector {ring}"
            desc = "Interference corridor resonating with synchronized chromatic standing waves."
            dominant_feature = "standing_waves"
            sky_hex = "#0284c7"
            floor_hex = "#0c4a6e"
            accent_hex = "#38bdf8"
            npc_title = f"Harmonicist Lyra of Sector {ring}"
            npc_role = "Tuning spatial frequencies across the eastern manifold."
        elif 135 <= deg < 225:
            # South
            sector_type = "flux"
            name = f"Sub-Dimensional Flux Basin — Sector {ring}"
            desc = "Undulating quantum energy basin with iridescent emerald and cyan particle streams."
            dominant_feature = "energy_well"
            sky_hex = "#064e3b"
            floor_hex = "#022c22"
            accent_hex = "#34d399"
            npc_title = f"Flux Custodian Vane of Sector {ring}"
            npc_role = "Monitoring wavefunction gradients in the southern basin."
        elif 225 <= deg < 315:
            # West
            sector_type = "warp"
            name = f"Perlin Domain Warp Ridge — Sector {ring}"
            desc = "Stratified topological ridges sculpted by continuous multi-octave domain warping."
            dominant_feature = "warp_ridges"
            sky_hex = "#78350f"
            floor_hex = "#451a03"
            accent_hex = "#fbbf24"
            npc_title = f"Topologist Kaelen of Sector {ring}"
            npc_role = "Surveying non-Euclidean contours on the western ridge."
        else:
            # North
            sector_type = "interference"
            name = f"Quantum Interference Spire — Sector {ring}"
            desc = "Monumental crystalline spire concentrating high-frequency latent interference patterns."
            dominant_feature = "crystalline_spire"
            sky_hex = "#1e1b4b"
            floor_hex = "#0f0728"
            accent_hex = "#c084fc"
            npc_title = f"Spectroscopist Thorne of Sector {ring}"
            npc_role = "Channeling coherent phase alignment across the northern spire."

        palette = RoomVisualPalette(
            sky_tone=sky_hex,
            floor_tone=floor_hex,
            dominant_color=accent_hex,
            accent_color=accent_hex,
        )

        lighting = LightingConfig(
            ambient_color=accent_hex,
            ambient_intensity=1.2,
            fog_color=sky_hex,
            fog_density=0.003,
        )

        return {
            "x": x,
            "z": z,
            "sector_type": sector_type,
            "name": name,
            "description": desc,
            "dominant_feature": dominant_feature,
            "palette": palette,
            "lighting": lighting,
            "npc_title": npc_title,
            "npc_role": npc_role,
        }

    def _sample_desert_field(
        self, x: float, z: float, dist: float, deg: float, ring: int, moisture: float, elevation: float
    ) -> Dict[str, Any]:
        # Egyptian Giza Necropolis Infinite Macro-Biome Field
        # Center (dist < 100): Grand Pyramids Complex & Forecourt
        # East (deg 45..135): Sphinx Sanctuary, Papyrus Nile Canal, Water Reflection Basins, River Quays
        # South (deg 135..225): Lush Date Palm Oasis, Cedarwood Solar Barques, Sacred Wells, Terraced Gardens
        # West (deg 225..315): High Desert Sandcrest, Wind-Carved Basalt Mesas, Alabaster Mastaba Terraces
        # North (deg 315..360 or 0..45): Royal Necropolis Hypostyle Halls, Ascending Corbelled Granite Vaults

        if dist < 90:
            sector_type = "court"
            name = "Great Pyramid Forecourt"
            desc = "Monumental limestone courtyard facing the three great pyramid massifs at golden hour."
            dominant_feature = "pyramids"
            sky_hex = "#1d4ed8"
            floor_hex = "#eab664"
            accent_hex = "#facc15"
            npc_title = "Khaemwaset, Royal Architect"
            npc_role = "Chief Overseer of Royal Works and keeper of sacred cubits."
        elif 45 <= deg < 135:
            # Eastern Nile Sector
            if dist < 320:
                sector_type = "sphinx"
                name = "Sanctuary of the Great Sphinx"
                desc = "Carved limestone monolith with the recumbent lion body, royal nemes, and Dream Stela altar."
                dominant_feature = "sphinx"
                floor_hex = "#e5b162"
            elif dist < 580:
                sector_type = "canal"
                name = f"Nile Canal Reflection Promenade - Sector {ring}"
                desc = "Turquoise reflecting basin flanked by papyrus reed colonnades and white limestone quays."
                dominant_feature = "canal"
                floor_hex = "#38bdf8"
            else:
                sector_type = "riverfront"
                name = f"Eastern River Port & Royal Harbor - Tier {ring}"
                desc = "Expansive sandstone wharf with trading barques, ceremonial pylons, and fertile river reeds."
                dominant_feature = "harbor"
                floor_hex = "#0284c7"
            sky_hex = "#2563eb"
            accent_hex = "#38bdf8"
            npc_title = f"High Priestess Neferu of Tier {ring}"
            npc_role = "Keeper of the eastern dawn rites and sacred waters."
        elif 135 <= deg < 225:
            # Southern Oasis Sector
            if dist < 320:
                sector_type = "solar_barque"
                name = "Court of the Solar Barque"
                desc = "Sacred Lebanon cedarwood solar vessel with golden oars resting under a star-vaulted ceiling."
                dominant_feature = "solar_barque"
                floor_hex = "#92400e"
            elif dist < 580:
                sector_type = "oasis"
                name = f"Verdant Date Palm Oasis - Sector {ring}"
                desc = "Emerald oasis grove with towering date palms, natural freshwater spring pools, and shade canopies."
                dominant_feature = "oasis_grove"
                floor_hex = "#16a34a"
            else:
                sector_type = "valley"
                name = f"Sacred Alabaster Water Terraces - Tier {ring}"
                desc = "Tiered freshwater reservoirs carved into desert limestone surrounded by blooming papyrus and palms."
                dominant_feature = "terraced_pools"
                floor_hex = "#059669"
            sky_hex = "#0f172a" if sector_type == "solar_barque" else "#1e3a8a"
            accent_hex = "#facc15"
            npc_title = f"Master Navigator Seneb of Sector {ring}"
            npc_role = "Navigator of celestial pathways and keeper of the southern springs."
        elif 225 <= deg < 315:
            # Western Desert Plateau Sector
            if dist < 320:
                sector_type = "sandcrest"
                name = "Giza Plateau Sandcrest"
                desc = "Elevated sandstone ridge overlooking the undulating desert dunes and distant necropolis silhouette."
                dominant_feature = "dunes"
                floor_hex = "#d97706"
            elif dist < 580:
                sector_type = "mastaba"
                name = f"Western Mastaba Terrace - Sector {ring}"
                desc = "Ancient flat-roofed rectangular royal tomb structures made of fine Tura limestone blocks."
                dominant_feature = "mastabas"
                floor_hex = "#b45309"
            else:
                sector_type = "canyon"
                name = f"Wind-Carved Basalt Gorge - Tier {ring}"
                desc = "Dramatic stratified sandstone canyon walls with carved hieroglyphic friezes and light shafts."
                dominant_feature = "canyon"
                floor_hex = "#78350f"
            sky_hex = "#1e40af"
            accent_hex = "#fbbf24"
            npc_title = f"Pathfinder Tariq of Sector {ring}"
            npc_role = "Desert scout guarding the western caravan ridges."
        else:
            # Northern Royal Necropolis Sector
            if dist < 320:
                sector_type = "khufu_gallery"
                name = "Grand Gallery of Khufu"
                desc = "Interior ascending red-granite corbelled vault illuminated by glowing bronze oil torches."
                dominant_feature = "corbelled_vault"
                floor_hex = "#7c2d12"
            elif dist < 580:
                sector_type = "hypostyle"
                name = f"Northern Royal Hypostyle Hall - Sector {ring}"
                desc = "Monumental hall of gigantic carved sandstone lotus columns supporting massive stone lintels."
                dominant_feature = "colonnade"
                floor_hex = "#c29156"
            else:
                sector_type = "citadel"
                name = f"Upper Necropolis Fortress Citadel - Tier {ring}"
                desc = "High plateau citadel overlooking the Great Pyramids with monumental watchtowers and golden flags."
                dominant_feature = "citadel"
                floor_hex = "#a16207"
            sky_hex = "#291811" if sector_type == "khufu_gallery" else "#1d4ed8"
            accent_hex = "#f59e0b"
            npc_title = f"Scribe Merer of Sector {ring}"
            npc_role = "Chronicler of royal stone transport and archive ledger inspector."

        palette = RoomVisualPalette(
            sky_tone=sky_hex,
            floor_tone=floor_hex,
            dominant_color=floor_hex,
            accent_color=accent_hex,
        )

        lighting = LightingConfig(
            ambient_color="#fef3c7",
            ambient_intensity=0.85,
            fog_color=palette.sky_tone,
            fog_density=0.001,
        )

        return {
            "x": x,
            "z": z,
            "sector_type": sector_type,
            "name": name,
            "description": desc,
            "dominant_feature": dominant_feature,
            "palette": palette,
            "lighting": lighting,
            "npc_title": npc_title,
            "npc_role": npc_role,
        }

    def _sample_gardens_field(self, x, z, dist, deg, ring, moisture, elevation) -> Dict[str, Any]:
        # Gardens / Babylon / Sylvan Biome
        names = ["Hanging Terrace", "Cedar Canopy", "Ishtar Water Arbor", "Lapis Grotto", "Lotus Basin"]
        feat = ["waterfall", "hanging_arbor", "cedar_grove", "reflecting_pool", "ziggurat"]
        idx = (int(deg // 72) + ring) % len(names)
        name = f"{names[idx]} - Sector {ring}"
        palette = RoomVisualPalette(
            sky_tone="#059669",
            floor_tone="#14532d",
            dominant_color="#15803d",
            accent_color="#facc15",
        )
        return {
            "x": x,
            "z": z,
            "sector_type": "garden",
            "name": name,
            "description": f"Lush botanical sanctuary with terraced waterways and ancient cedar canopies.",
            "dominant_feature": feat[idx],
            "palette": palette,
            "lighting": LightingConfig(ambient_color="#ecfccb"),
            "npc_title": f"Botanist Lyra of Sector {ring}",
            "npc_role": "Keeper of the imperial flora and ancient aqueducts.",
        }

    def _sample_space_field(self, x, z, dist, deg, ring, moisture, elevation) -> Dict[str, Any]:
        # Orbital Space Station / Cosmic Biome
        modules = ["Command Nexus", "Hydroponics Bio-Dome", "Solar Array Wing", "Observatory Dome", "Reactor Vault"]
        feat = ["nebula_viewport", "bio_ring", "solar_panels", "telescope_array", "antimatter_core"]
        idx = (int(deg // 72) + ring) % len(modules)
        name = f"{modules[idx]} - Sector {ring}"
        palette = RoomVisualPalette(
            sky_tone="#030712",
            floor_tone="#1e293b",
            dominant_color="#334155",
            accent_color="#38bdf8",
        )
        return {
            "x": x,
            "z": z,
            "sector_type": "space",
            "name": name,
            "description": f"Orbital research station corridor surveying the celestial starfield and planetary horizon.",
            "dominant_feature": feat[idx],
            "palette": palette,
            "lighting": LightingConfig(ambient_color="#e0f2fe"),
            "npc_title": f"Commander Vance of Sector {ring}",
            "npc_role": "Station operations officer monitoring orbital station telemetry.",
        }

    def _sample_metropolis_field(
        self, x: float, z: float, dist: float, deg: float, ring: int, moisture: float, elevation: float
    ) -> Dict[str, Any]:
        ring_s = f" — Sector {ring}" if ring > 1 else ""
        if dist < 90:
            sector_type = "metropolis_core"
            name = "Meridian Junction Plaza"
            desc = "Central illuminated metropolitan plaza flanked by towering digital billboards and street avenues."
            dominant_feature = "neon_tower"
            sky_hex = "#0f172a"
            floor_hex = "#1e293b"
            accent_hex = "#38bdf8"
            npc_title = "Chief City Architect Morgan"
            npc_role = "Master urban planner coordinating downtown avenues and transit arteries."
        elif 45 <= deg < 135:
            # East
            sector_type = "avenue"
            name = f"Avenue of the Americas Crossing{ring_s}"
            desc = "Multi-lane metropolitan avenue lined with glass high-rises and pedestrian promenades."
            dominant_feature = "avenue_corridor"
            sky_hex = "#0f172a"
            floor_hex = "#18181b"
            accent_hex = "#06b6d4"
            npc_title = f"Transit Dispatcher Devon of Sector {ring}"
            npc_role = "Overseeing traffic flow along the eastern arterial boulevard."
        elif 135 <= deg < 225:
            # South
            sector_type = "theater"
            name = f"Broadway Stage Promenade{ring_s}"
            desc = "Historic theater district avenue gleaming with marquee lights and illuminated street canopies."
            dominant_feature = "theater_marquee"
            sky_hex = "#180d2b"
            floor_hex = "#1f2937"
            accent_hex = "#f59e0b"
            npc_title = f"District Curator Silas of Sector {ring}"
            npc_role = "Steward of the theater district archives and municipal landmarks."
        elif 225 <= deg < 315:
            # West
            sector_type = "arcade"
            name = f"Shubert Commercial Arcade{ring_s}"
            desc = "Pedestrian shopping arcade with glowing storefronts, street cafes, and transit waypoints."
            dominant_feature = "arcade_canopy"
            sky_hex = "#0c1829"
            floor_hex = "#111827"
            accent_hex = "#10b981"
            npc_title = f"Arcade Warden Elena of Sector {ring}"
            npc_role = "Managing commerce and visitor guidance along the western arcade."
        else:
            # North
            sector_type = "skyway"
            name = f"Upper Skyline Terrace Overlook{ring_s}"
            desc = "Elevated pedestrian skybridge and terrace surveying the endless metropolis under twilight."
            dominant_feature = "skybridge"
            sky_hex = "#0b1329"
            floor_hex = "#1e293b"
            accent_hex = "#a855f7"
            npc_title = f"Skyline Observer Jesse of Sector {ring}"
            npc_role = "Monitoring meteorological and transit conditions across the northern skyway."

        palette = RoomVisualPalette(
            sky_tone=sky_hex,
            floor_tone=floor_hex,
            dominant_color=accent_hex,
            accent_color=accent_hex,
        )
        lighting = LightingConfig(
            ambient_color=accent_hex,
            ambient_intensity=1.15,
            fog_color=sky_hex,
            fog_density=0.003,
        )
        return {
            "x": x,
            "z": z,
            "sector_type": sector_type,
            "name": name,
            "description": desc,
            "dominant_feature": dominant_feature,
            "palette": palette,
            "lighting": lighting,
            "npc_title": npc_title,
            "npc_role": npc_role,
        }

    def _sample_general_field(self, x, z, dist, deg, ring, moisture, elevation) -> Dict[str, Any]:
        cardinal = ["North", "East", "South", "West"][int(deg // 90) % 4]
        words = [w.capitalize() for w in re.findall(r"[a-zA-Z0-9]+", self.world_prompt) if len(w) > 2]
        title_stem = " ".join(words[:3]) if words else "Uncharted Frontier"
        ring_s = f" — Sector {ring}" if ring > 1 else ""
        name = f"{title_stem} - {cardinal} Vista{ring_s}"

        h_val = int(hashlib.md5(f"{title_stem}:{ring}".encode("utf-8")).hexdigest()[:6], 16)
        palette = RoomVisualPalette(
            sky_tone="#1e293b",
            floor_tone="#0f172a",
            dominant_color=f"#{h_val:06x}",
            accent_color="#f59e0b",
        )
        return {
            "x": x,
            "z": z,
            "sector_type": "general",
            "name": name,
            "description": f"Expansive architectural quadrant extending across {title_stem}.",
            "dominant_feature": "citadel",
            "palette": palette,
            "lighting": LightingConfig(ambient_color="#f8fafc"),
            "npc_title": f"Pathfinder of {title_stem} - Sector {ring}",
            "npc_role": f"Expedition scout charting the {cardinal.lower()} frontiers.",
        }

    def synthesize_infinite_room_assets(
        self,
        target_x: float,
        target_z: float,
        from_x: float,
        from_z: float,
        from_room_name: str,
        world_id: str,
        room_idx: int,
    ) -> Tuple[str, str, Dict[str, Any]]:
        """
        Synthesizes a 2048x1024 connected panorama and metric depth map.
        The portal facing (from_x, from_z) blends with the parent room, while
        all other 360-degree radial headings morph into the distinct landscape of (target_x, target_z).
        """
        from pathlib import Path
        info = self.sample_field(target_x, target_z)
        w, h = 2048, 1024
        horizon_y = h // 2

        out_dir = Path("frontend/public/generated_worlds") / world_id
        out_dir.mkdir(parents=True, exist_ok=True)
        safe_world = world_id.replace("/", "_")
        pano_filename = f"room_{safe_world}_{room_idx}_panorama.webp"
        depth_filename = f"room_{safe_world}_{room_idx}_depth.png"
        pano_file = out_dir / pano_filename
        depth_file = out_dir / depth_filename
        pano_url = f"/generated_worlds/{world_id}/{pano_filename}"
        depth_url = f"/generated_worlds/{world_id}/{depth_filename}"

        img = Image.new("RGB", (w, h))
        draw = ImageDraw.Draw(img)

        palette = info["palette"]
        sky_rgb = hex_to_rgb(palette.sky_tone, (29, 78, 216))
        floor_rgb = hex_to_rgb(palette.floor_tone, (234, 182, 100))
        dominant_rgb = hex_to_rgb(palette.dominant_color, (217, 119, 6))
        accent_rgb = hex_to_rgb(palette.accent_color, (250, 204, 21))

        # 1. Sky Dome with Celestial Alignment
        for y in range(horizon_y):
            t = y / float(horizon_y)
            r = int(sky_rgb[0] * (0.6 + 0.4 * t))
            g = int(sky_rgb[1] * (0.6 + 0.4 * t))
            b = int(sky_rgb[2] * (0.7 + 0.3 * t))
            draw.line([(0, y), (w, y)], fill=(min(255, r), min(255, g), min(255, b)))

        # Shared Global Sun at Azimuth -0.35 rad
        sun_x = int(((-0.35 / (2.0 * math.pi) + 0.5) % 1.0) * w)
        sun_y = horizon_y - 180
        if info["sector_type"] == "space":
            # Starfield & cosmic nebula
            for sx_i in range(0, w, 44):
                sy_i = (sx_i * 11 + 23) % (horizon_y - 25)
                draw.ellipse([sx_i - 1, sy_i - 1, sx_i + 1, sy_i + 1], fill=(240, 248, 255))
        else:
            for rad, col in [(140, (255, 240, 190)), (80, (255, 248, 215)), (40, (255, 255, 245))]:
                draw.ellipse([sun_x - rad, sun_y - rad, sun_x + rad, sun_y + rad], fill=col)

        # 2. Floor Surface derived from continuous field palette
        for y in range(horizon_y, h):
            t = (y - horizon_y) / float(h - horizon_y)
            r = int(floor_rgb[0] * (1.1 - 0.2 * t))
            g = int(floor_rgb[1] * (1.1 - 0.2 * t))
            b = int(floor_rgb[2] * (1.1 - 0.2 * t))
            draw.line([(0, y), (w, y)], fill=(min(255, r), min(255, g), min(255, b)))

        # Perspective ground radial pavement
        pave_col = (
            min(255, int(dominant_rgb[0] * 0.72)),
            min(255, int(dominant_rgb[1] * 0.72)),
            min(255, int(dominant_rgb[2] * 0.72)),
        )
        for ang_deg in range(0, 360, 12):
            rad_ang = math.radians(ang_deg)
            fx = int(((rad_ang / (2.0 * math.pi) + 0.5) % 1.0) * w)
            spread = math.sin(rad_ang) * 450
            draw.line([(fx, horizon_y), (int(fx + spread), h)], fill=pave_col, width=2)
        for y in range(horizon_y + 18, h, 36):
            draw.line([(0, y), (w, y)], fill=pave_col, width=2)

        # 3. Reciprocal Portal facing (from_x, from_z)
        dx_back = from_x - target_x
        dz_back = from_z - target_z
        if abs(dx_back) < 1e-4 and abs(dz_back) < 1e-4:
            dz_back = 220.0
        theta_back = math.atan2(dx_back, -dz_back)
        u_back = (theta_back / (2.0 * math.pi) + 0.5) % 1.0
        portal_cx = int(round(u_back * w)) % w

        p_half_w = 95
        p_top_y = horizon_y - 250
        p_bot_y = horizon_y + 120

        # Ground light spill pouring forward
        spill_h = 160
        for dy in range(spill_h):
            prog = dy / float(spill_h)
            sw = int(p_half_w * (1.0 + 1.8 * prog))
            sy = p_bot_y + dy
            if sy < h:
                for dx_p in range(-sw, sw + 1):
                    px = (portal_cx + dx_p) % w
                    alpha = (1.0 - prog) * 0.45 * (1.0 - abs(dx_p) / float(sw))
                    cur = img.getpixel((px, sy))
                    blended = (
                        min(255, int(cur[0] * (1.0 - alpha) + 250 * alpha)),
                        min(255, int(cur[1] * (1.0 - alpha) + 204 * alpha)),
                        min(255, int(cur[2] * (1.0 - alpha) + 21 * alpha)),
                    )
                    img.putpixel((px, sy), blended)

        # Portal interior glow
        for dx_p in range(-p_half_w + 22, p_half_w - 21):
            px = (portal_cx + dx_p) % w
            for py in range(p_top_y + 22, p_bot_y):
                img.putpixel((px, py), (245, 215, 150))

        # Portal pylons & golden lintel
        for dx_p in range(-p_half_w, -p_half_w + 24):
            px = (portal_cx + dx_p) % w
            for py in range(p_top_y, p_bot_y + 14):
                img.putpixel((px, py), (243, 208, 136) if py % 26 > 3 else (180, 130, 60))
        for dx_p in range(p_half_w - 23, p_half_w + 1):
            px = (portal_cx + dx_p) % w
            for py in range(p_top_y, p_bot_y + 14):
                img.putpixel((px, py), (243, 208, 136) if py % 26 > 3 else (180, 130, 60))
        for dx_p in range(-p_half_w - 14, p_half_w + 15):
            px = (portal_cx + dx_p) % w
            for py in range(p_top_y - 28, p_top_y + 22):
                border = (py <= p_top_y - 24 or py >= p_top_y + 18)
                img.putpixel((px, py), (250, 204, 21) if border else (243, 208, 136))

        # 4. Outward-Facing Landmarks (Morphed from 2D continuous field)
        # We place distinct features in directions opposite to portal_cx
        fwd_cx = (portal_cx + w // 2) % w
        feat = info["dominant_feature"]

        if feat in ["quantum_core", "standing_waves", "energy_well", "warp_ridges", "crystalline_spire"]:
            # Iridescent quantum interference rings & floating energy core
            cx = fwd_cx
            for r_ring in [260, 190, 130, 75]:
                draw.ellipse(
                    [(cx - r_ring) % w, int(horizon_y - 140 - r_ring * 0.55), (cx + r_ring) % w, int(horizon_y - 140 + r_ring * 0.55)],
                    outline=(56, 189, 248),
                    width=3,
                )
            draw.ellipse([(cx - 45) % w, horizon_y - 185, (cx + 45) % w, horizon_y - 95], fill=(255, 255, 255), outline=(168, 85, 247), width=4)
        elif feat in ["oasis_grove", "terraced_pools"]:
            # Lush Date Palms & Emerald Water Reflection Basin
            for px_i in [fwd_cx - 260, fwd_cx - 90, fwd_cx + 120, fwd_cx + 290]:
                draw_palm_tree(draw, px_i % w, horizon_y, height=270)
            draw_reflection_pool(draw, fwd_cx, horizon_y + 180, rw=240, rh=85)
        elif feat in ["sphinx", "canal", "harbor"]:
            # Great Sphinx Monolith / Canal Basins
            draw_reflection_pool(draw, fwd_cx, horizon_y + 170, rw=260, rh=95)
            # Limestone sphinx recumbent monument
            sx = fwd_cx
            draw.rectangle([sx - 240, horizon_y - 120, sx + 240, horizon_y], fill=(234, 182, 100), outline=(161, 98, 7))
            draw.polygon([(sx, horizon_y - 300), (sx - 100, horizon_y - 120), (sx + 100, horizon_y - 120)], fill=(243, 208, 136), outline=(30, 58, 138), width=3)
        elif feat == "solar_barque":
            # Sacred Cedarwood Solar Vessel
            bx = fwd_cx
            draw.ellipse([bx - 340, horizon_y - 130, bx + 340, horizon_y + 50], fill=(146, 64, 14), outline=(250, 204, 21), width=4)
            draw.rectangle([bx - 100, horizon_y - 170, bx + 100, horizon_y - 45], fill=(217, 119, 6), outline=(250, 204, 21), width=3)
        elif feat in ["dunes", "canyon", "mastabas"]:
            # Stratified canyon walls & undulating desert dunes
            for mx in range(fwd_cx - 380, fwd_cx + 381, 40):
                ch = int(180 + math.sin(mx * 0.02) * 55)
                draw.rectangle([(mx - 20) % w, horizon_y - ch, (mx + 20) % w, horizon_y], fill=(217, 119, 6), outline=(146, 64, 14))
        else:
            # Colossal Pyramids on the Horizon
            draw_pyramid_silhouette(draw, (fwd_cx - 280) % w, horizon_y, ph=240, pw=290)
            draw_pyramid_silhouette(draw, fwd_cx, horizon_y, ph=320, pw=380)
            draw_pyramid_silhouette(draw, (fwd_cx + 280) % w, horizon_y, ph=220, pw=270)

        # 5. Seamless 360 Wrap Blend
        arr = blend_seam(np.array(img, dtype=np.float32), 32)
        final_rgb = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        final_rgb.save(pano_file, "WEBP", quality=92)

        # 6. Depth Map
        depth_arr = np.zeros((h, w), dtype=np.float32)
        depth_arr[:horizon_y, :] = np.linspace(15, 35, horizon_y)[:, None]
        depth_arr[horizon_y:, :] = 45.0 + 95.0 * (np.linspace(0, 1, h - horizon_y)[:, None] ** 1.3)
        # Portal Frame Depth
        for dx_p in range(-p_half_w - 14, p_half_w + 15):
            px = (portal_cx + dx_p) % w
            is_pylon = abs(dx_p) >= p_half_w - 24 or abs(dx_p) <= p_half_w + 14
            if is_pylon:
                depth_arr[p_top_y - 28:p_bot_y + 14, px] = 210.0
        depth_arr = blend_seam(depth_arr, 32)
        depth_img = Image.fromarray(np.clip(depth_arr, 0, 255).astype(np.uint8), mode="L").filter(ImageFilter.GaussianBlur(2.0))
        depth_img.save(depth_file, "PNG")

        return pano_url, depth_url, info


def hex_to_rgb(hex_str: Optional[str], default: Tuple[int, int, int] = (128, 128, 128)) -> Tuple[int, int, int]:
    if not hex_str:
        return default
    cleaned = hex_str.strip().lstrip("#")
    if len(cleaned) == 6:
        try:
            return (int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16))
        except ValueError:
            pass
    return default


def blend_seam(arr: np.ndarray, blend_width: int = 32) -> np.ndarray:
    w = arr.shape[1]
    is_3d = arr.ndim == 3
    left_strip = arr[:, :blend_width, :].copy() if is_3d else arr[:, :blend_width].copy()
    right_strip = arr[:, w - blend_width :, :].copy() if is_3d else arr[:, w - blend_width :].copy()
    for i in range(blend_width):
        alpha = float(i) / float(blend_width)
        w_l = (1.0 - alpha) * 0.5 + 0.5
        w_r = 1.0 - w_l
        if is_3d:
            arr[:, i, :] = left_strip[:, i, :] * w_l + right_strip[:, i, :] * w_r
            arr[:, w - 1 - i, :] = (
                right_strip[:, blend_width - 1 - i, :] * w_l + left_strip[:, blend_width - 1 - i, :] * w_r
            )
        else:
            arr[:, i] = left_strip[:, i] * w_l + right_strip[:, i] * w_r
            arr[:, w - 1 - i] = (
                right_strip[:, blend_width - 1 - i] * w_l + left_strip[:, blend_width - 1 - i] * w_r
            )
    return arr


def draw_palm_tree(draw: ImageDraw.Draw, base_x: int, base_y: int, height: int = 240):
    trunk_col = (115, 68, 32)
    for ty in range(base_y - height, base_y):
        prog = (ty - (base_y - height)) / float(height)
        curv = math.sin(prog * math.pi) * 16
        w_t = int(12 * (1.0 - 0.4 * (1.0 - prog)))
        draw.line([(base_x + curv - w_t // 2, ty), (base_x + curv + w_t // 2, ty)], fill=trunk_col)
    top_x = base_x + int(math.sin(math.pi) * 16)
    top_y = base_y - height
    frond_cols = [(22, 101, 52), (34, 197, 94), (74, 222, 128)]
    for i, ang_deg in enumerate(range(0, 360, 24)):
        rad = math.radians(ang_deg)
        fx = int(top_x + math.cos(rad) * 95)
        fy = int(top_y + math.sin(rad) * 45 + 25)
        col = frond_cols[i % len(frond_cols)]
        draw.line([(top_x, top_y), (fx, fy)], fill=col, width=3)


def draw_reflection_pool(draw: ImageDraw.Draw, cx: int, cy: int, rw: int = 220, rh: int = 90):
    draw.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=(45, 185, 205), outline=(250, 204, 21), width=4)


def draw_pyramid_silhouette(draw: ImageDraw.Draw, px: int, horizon_y: int, ph: int = 280, pw: int = 340):
    draw.polygon([(px, horizon_y - ph), (px - pw, horizon_y), (px + 25, horizon_y)], fill=(242, 206, 138))
    draw.polygon([(px, horizon_y - ph), (px + 25, horizon_y), (px + pw, horizon_y)], fill=(198, 154, 86))
    cap_h = ph // 7
    cap_w = pw // 7
    draw.polygon(
        [(px, horizon_y - ph), (px - cap_w, horizon_y - ph + cap_h), (px + cap_w, horizon_y - ph + cap_h)],
        fill=(255, 225, 95),
    )

