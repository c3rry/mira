# procedural ambient audio soundscape generator for all biomes
import math
import os
from pathlib import Path
import random
import struct
import wave


def generate_wave_drone(
    filename: Path,
    duration: float = 6.0,
    sample_rate: int = 44100,
    soundscape_type: str = "cyberpunk",
):
    num_samples = int(sample_rate * duration)
    frames = bytearray()

    random.seed(42)

    for i in range(num_samples):
        t = i / sample_rate
        # seamless cross-fade envelope near boundaries for zero click loop
        fade_dur = 0.2
        env = 1.0
        if t < fade_dur:
            env = t / fade_dur
        elif t > (duration - fade_dur):
            env = (duration - t) / fade_dur

        if soundscape_type == "cyberpunk":
            # 55hz sub-bass + 110hz harmonic + slow 0.25hz neon electrical pulse
            lfo = 0.75 + 0.25 * math.sin(2 * math.pi * 0.2 * t)
            sub = 0.5 * math.sin(2 * math.pi * 55.0 * t)
            harm1 = 0.3 * math.sin(2 * math.pi * 110.0 * t + 0.4)
            harm2 = 0.15 * math.sin(2 * math.pi * 220.0 * t + 0.8)
            val_l = (sub + harm1 + harm2) * lfo * 0.7 * env
            val_r = (sub * 0.95 + harm1 * 1.05 + harm2) * lfo * 0.7 * env

        elif soundscape_type == "tavern":
            # warm 146.8hz d-chord with fireplace crackle simulation
            base = 0.35 * math.sin(2 * math.pi * 146.8 * t)
            fifth = 0.25 * math.sin(2 * math.pi * 220.0 * t)
            octave = 0.15 * math.sin(2 * math.pi * 293.6 * t)
            # subtle fireplace crackle bursts
            crackle = (random.random() - 0.5) * 0.08 if random.random() < 0.05 else 0.0
            val_l = (base + fifth + octave + crackle) * 0.65 * env
            val_r = (base + fifth * 0.9 + octave * 1.1 + crackle * 0.8) * 0.65 * env

        elif soundscape_type == "space":
            # 40hz deep airlock circulation with binaural pressure beats
            beat = math.sin(2 * math.pi * 0.1 * t)
            sub = 0.6 * math.sin(2 * math.pi * 40.0 * t)
            air = 0.2 * math.sin(2 * math.pi * 80.5 * t)
            hum = 0.1 * math.sin(2 * math.pi * 120.0 * t)
            val_l = (sub + air + hum + 0.05 * beat) * 0.7 * env
            val_r = (sub + air * 0.9 + hum * 1.1 - 0.05 * beat) * 0.7 * env

        elif soundscape_type == "desert":
            # filtered pink noise wind sweep simulation
            wind_lfo = 0.5 + 0.5 * math.sin(2 * math.pi * 0.15 * t)
            breeze = (random.random() - 0.5) * 0.25 * wind_lfo
            tone = 0.3 * math.sin(2 * math.pi * 92.5 * t)
            val_l = (tone + breeze) * 0.6 * env
            val_r = (tone * 0.9 + breeze * 1.1) * 0.6 * env

        elif soundscape_type == "forest":
            # ethereal 432hz harmonic canopy with crystal resonance
            root = 0.35 * math.sin(2 * math.pi * 216.0 * t)
            chime1 = 0.2 * math.sin(2 * math.pi * 432.0 * t)
            chime2 = 0.15 * math.sin(2 * math.pi * 648.0 * t + math.sin(t * 1.5))
            val_l = (root + chime1 + chime2) * 0.6 * env
            val_r = (root * 0.95 + chime1 * 1.05 + chime2) * 0.6 * env

        else:
            # universal ambient soundscape
            base = 0.4 * math.sin(2 * math.pi * 65.4 * t)
            h = 0.2 * math.sin(2 * math.pi * 130.8 * t)
            val_l = (base + h) * 0.6 * env
            val_r = (base + h) * 0.6 * env

        s_l = int(max(-1.0, min(1.0, val_l)) * 32767)
        s_r = int(max(-1.0, min(1.0, val_r)) * 32767)
        frames.extend(struct.pack("<hh", s_l, s_r))

    with wave.open(str(filename), "w") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(frames)


def main():
    base_dir = Path("frontend/public/audio")
    tracks_dir = base_dir / "tracks"
    base_dir.mkdir(parents=True, exist_ok=True)
    tracks_dir.mkdir(parents=True, exist_ok=True)

    soundscape_mappings = {
        # tracks directory (matched by page.tsx activeRoom.biome_type)
        tracks_dir / "cyberpunk_alley.wav": "cyberpunk",
        tracks_dir / "cyberpunk_facility.wav": "cyberpunk",
        tracks_dir / "medieval_tavern.wav": "tavern",
        tracks_dir / "space_station.wav": "space",
        tracks_dir / "desert_oasis.wav": "desert",
        tracks_dir / "enchanted_forest.wav": "forest",
        tracks_dir / "ambient.wav": "cyberpunk",
        # direct audio directory (matched by manifest.json)
        base_dir / "cyberpunk_ambient.wav": "cyberpunk",
        base_dir / "tavern_ambient.wav": "tavern",
        base_dir / "scifi_hum.wav": "space",
        base_dir / "desert_wind.wav": "desert",
        base_dir / "forest_mystic.wav": "forest",
    }

    print("Generating rich procedural ambient soundscapes...")

    for path, stype in soundscape_mappings.items():
        generate_wave_drone(path, duration=8.0, soundscape_type=stype)
        print(f"Saved soundscape: {path} ({path.stat().st_size} bytes)")

        # also create a duplicate with .mp3 extension so requests for .mp3 or .wav both succeed
        mp3_equivalent = path.with_suffix(".mp3")
        with open(path, "rb") as src, open(mp3_equivalent, "wb") as dst:
            dst.write(src.read())
        print(f"Saved alias: {mp3_equivalent} ({mp3_equivalent.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
