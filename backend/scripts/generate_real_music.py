# generator for rich multi-instrument cinematic soundtrack files across all biomes
import math
from pathlib import Path
import shutil
import wave
import numpy as np


def synthesize_music_track(
    scale_freqs,
    chord_prog,
    melody_pattern,
    counter_melody,
    bpm=96,
    duration_sec=24.0,
    sample_rate=44100,
    style="classical",
):
    # synthesize expressive multi-instrument musical score with lush strings/choir pad,
    # plucked harp/oud/lute arpeggios, expressive vibrato solo lead, counter-melody, warm bass, and stereo-like reverb
    n_samples = int(duration_sec * sample_rate)
    audio = np.zeros(n_samples, dtype=np.float64)

    beat_dur = 60.0 / bpm
    step_dur = beat_dur / 2.0  # eighth notes
    total_steps = int(duration_sec / step_dur)

    for step in range(total_steps):
        start_idx = int(step * step_dur * sample_rate)
        end_idx = min(n_samples, int((step + 3.2) * step_dur * sample_rate))
        if start_idx >= n_samples:
            break
        seg_len = end_idx - start_idx
        seg_t = np.linspace(0, seg_len / sample_rate, seg_len, endpoint=False)

        chord_idx = (step // 8) % len(chord_prog)
        chord = chord_prog[chord_idx]

        # 1. lush sustained orchestral string / choir pad on bar boundaries (every 8 steps)
        if step % 8 == 0:
            pad_end = min(n_samples, start_idx + int(8.5 * step_dur * sample_rate))
            pad_len = pad_end - start_idx
            pad_t = np.linspace(0, pad_len / sample_rate, pad_len, endpoint=False)
            # slow swell attack and gentle release
            pad_env = np.sin(np.pi * np.clip(pad_t / (8.5 * step_dur), 0.0, 1.0)) ** 1.2
            pad_wave = np.zeros(pad_len, dtype=np.float64)
            for c_freq in chord:
                # detuned chorus ensemble for warm symphonic pad
                pad_wave += (
                    0.35 * np.sin(2 * np.pi * c_freq * pad_t)
                    + 0.25 * np.sin(2 * np.pi * (c_freq * 1.003) * pad_t + 0.4)
                    + 0.20 * np.sin(2 * np.pi * (c_freq * 0.997) * pad_t + 1.1)
                    + 0.12 * np.sin(2 * np.pi * (c_freq * 2.0) * pad_t)
                )
            audio[start_idx:pad_end] += 0.085 * pad_wave * pad_env

        # 2. plucked acoustic harp / oud / lute arpeggio with natural string harmonics
        arp_pattern = [0, 1, 2, 3, 2, 1, 3, 2]
        arp_note = chord[arp_pattern[step % len(arp_pattern)] % len(chord)]
        if step % 16 >= 8:
            arp_note *= 1.5 if style == "space" else 1.0
        env_arp = np.exp(-seg_t * (4.8 if style != "space" else 2.4)) * (1.0 - np.exp(-seg_t * 140.0))
        arp_wave = (
            0.58 * np.sin(2 * np.pi * arp_note * seg_t)
            + 0.26 * np.sin(2 * np.pi * (arp_note * 2.0) * seg_t + 0.2)
            + 0.11 * np.sin(2 * np.pi * (arp_note * 3.0) * seg_t + 0.5)
            + 0.05 * np.sin(2 * np.pi * (arp_note * 4.0) * seg_t)
        )
        audio[start_idx:end_idx] += 0.19 * arp_wave * env_arp

        # 3. deep resonant cello / acoustic bass foundation on beats 0, 3, 4, 6
        if step % 8 in (0, 3, 4, 6):
            bass_freq = chord[0] * (0.5 if step % 8 in (0, 4) else 0.75)
            env_bass = np.exp(-seg_t * 2.1) * (1.0 - np.exp(-seg_t * 65.0))
            bass_wave = (
                0.70 * np.sin(2 * np.pi * bass_freq * seg_t)
                + 0.22 * np.sin(2 * np.pi * (bass_freq * 2.0) * seg_t)
                + 0.08 * np.sin(2 * np.pi * (bass_freq * 3.0) * seg_t)
            )
            audio[start_idx:end_idx] += 0.24 * bass_wave * env_bass

        # 4. expressive lyrical lead melody (ney flute / oboe / celtic whistle / solo cello)
        mel_deg = melody_pattern[step % len(melody_pattern)]
        if mel_deg >= 0:
            mel_freq = scale_freqs[mel_deg % len(scale_freqs)]
            # delayed expressive vibrato that blooms after note onset
            vib_depth = 0.0055 * np.clip(seg_t * 2.5, 0.0, 1.0)
            vibrato = 1.0 + vib_depth * np.sin(2 * np.pi * 5.6 * seg_t)
            env_mel = np.exp(-seg_t * 2.2) * (1.0 - np.exp(-seg_t * 32.0))
            mel_wave = (
                0.60 * np.sin(2 * np.pi * mel_freq * vibrato * seg_t)
                + 0.26 * np.sin(2 * np.pi * (mel_freq * 2.0) * vibrato * seg_t + 0.3)
                + 0.10 * np.sin(2 * np.pi * (mel_freq * 3.0) * vibrato * seg_t)
                + 0.04 * np.sin(2 * np.pi * (mel_freq * 4.0) * vibrato * seg_t)
            )
            audio[start_idx:end_idx] += 0.23 * mel_wave * env_mel

        # 5. high crystalline counter-melody / celesta chime on complementary steps
        c_deg = counter_melody[step % len(counter_melody)]
        if c_deg >= 0:
            c_freq = scale_freqs[c_deg % len(scale_freqs)] * 2.0
            env_c = np.exp(-seg_t * 3.8) * (1.0 - np.exp(-seg_t * 95.0))
            c_wave = (
                0.75 * np.sin(2 * np.pi * c_freq * seg_t)
                + 0.25 * np.sin(2 * np.pi * (c_freq * 2.0) * seg_t)
            )
            audio[start_idx:end_idx] += 0.11 * c_wave * env_c

        # 6. nuanced world percussion (doumbek, frame drum, finger cymbals, soft shaker)
        p_len = min(seg_len, int(0.20 * sample_rate))
        pt = seg_t[:p_len]
        mod8 = step % 8
        if mod8 in (0, 3, 4):
            # warm resonant frame drum / doumbek "doum"
            p_freq = (105.0 if mod8 == 0 else 135.0) * np.exp(-pt * 19.0) + 46.0
            drum = np.sin(2 * np.pi * p_freq * pt) * np.exp(-pt * 15.0)
            audio[start_idx : start_idx + p_len] += (0.20 if mod8 == 0 else 0.14) * drum
        elif mod8 in (2, 6, 7):
            # crisp rim "tek" and subtle metallic shimmer
            noise = np.random.RandomState(step + 17).normal(0, 1, p_len)
            shaker = noise * np.exp(-pt * 42.0)
            bell = np.sin(2 * np.pi * 3420.0 * pt) * np.exp(-pt * 28.0)
            audio[start_idx : start_idx + p_len] += 0.04 * shaker + (0.025 if mod8 == 6 else 0.0) * bell

    # multi-tap concert hall reverb (delays at 190ms, 310ms, 470ms)
    for delay_sec, decay in [(0.19, 0.30), (0.31, 0.21), (0.47, 0.14)]:
        d_samples = int(delay_sec * sample_rate)
        if d_samples < n_samples:
            audio[d_samples:] += decay * audio[:-d_samples]

    # normalize cleanly without clipping
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = (audio / peak) * 0.88

    pcm = (audio * 32767).astype(np.int16)
    return pcm


def save_wav(path: Path, pcm: np.ndarray, sample_rate=44100):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())


def main():
    tracks_dir = Path("frontend/public/audio/tracks")
    root_audio_dir = Path("frontend/public/audio")
    tracks_dir.mkdir(parents=True, exist_ok=True)

    # 1. desert / giza: d phrygian dominant (hijaz maqam: d, eb, f#, g, a, bb, c)
    desert_scale = [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 523.25, 587.33]
    desert_chords = [
        [146.83, 220.00, 293.66, 369.99],  # D major
        [155.56, 233.08, 311.13, 392.00],  # Eb major7
        [130.81, 196.00, 261.63, 311.13],  # C minor
        [146.83, 220.00, 293.66, 369.99],  # D major
    ]
    desert_melody = [
        0, 2, 3, 4, 5, 4, 3, 2, 1, 0, -1, 2, 4, 6, 4, 3,
        2, 3, 4, 7, 6, 5, 4, 3, 2, 1, 2, 3, 2, 1, 0, -1,
    ]
    desert_counter = [
        -1, 4, -1, 6, -1, 5, -1, 4, -1, 2, 4, -1, 7, -1, 5, -1,
        4, -1, 6, -1, 7, -1, 5, -1, 4, -1, 3, -1, 4, -1, 2, 0,
    ]

    # 2. medieval tavern / classical rome & athens: d dorian lute, harp & flute ballad
    tavern_scale = [293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33]
    tavern_chords = [
        [146.83, 220.00, 293.66, 349.23],  # Dm
        [130.81, 196.00, 261.63, 329.63],  # C
        [174.61, 220.00, 261.63, 349.23],  # F
        [196.00, 246.94, 293.66, 392.00],  # G
    ]
    tavern_melody = [
        0, 2, 4, 7, 6, 4, 2, 3, 4, 2, 0, -1, 1, 2, 4, 5,
        4, 6, 7, 5, 4, 2, 3, 4, 2, 1, 0, 2, 1, 0, -1, 0,
    ]
    tavern_counter = [
        4, -1, 2, -1, 0, -1, 4, -1, 2, -1, 4, 6, -1, 4, -1, 2,
        7, -1, 4, -1, 2, -1, 5, -1, 4, -1, 2, -1, 3, -1, 2, -1,
    ]

    # 3. enchanted forest / hanging gardens of babylon: g lydian celtic harp & pan flute
    forest_scale = [392.00, 440.00, 493.88, 554.37, 587.33, 659.25, 739.99, 783.99]
    forest_chords = [
        [196.00, 293.66, 392.00, 493.88],  # G
        [220.00, 277.18, 329.63, 440.00],  # A
        [164.81, 246.94, 329.63, 392.00],  # Em
        [146.83, 220.00, 293.66, 369.99],  # D
    ]
    forest_melody = [
        0, 2, 4, 5, 7, 5, 4, 2, 3, 4, 2, 0, -1, 4, 6, 7,
        6, 4, 5, 3, 4, 2, 0, 1, 2, 4, 3, 2, 1, 0, -1, 0,
    ]
    forest_counter = [
        -1, 7, -1, 4, -1, 2, -1, 5, -1, 6, -1, 4, 2, -1, 4, -1,
        2, -1, 5, -1, 6, -1, 4, -1, 7, -1, 5, -1, 4, -1, 2, -1,
    ]

    # 4. space station / celestial observatory: c lydian celestial glass harmonica & strings
    space_scale = [261.63, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 523.25]
    space_chords = [
        [130.81, 196.00, 261.63, 329.63],  # C
        [146.83, 220.00, 293.66, 369.99],  # D
        [164.81, 246.94, 329.63, 392.00],  # Em
        [130.81, 196.00, 246.94, 329.63],  # Cmaj7
    ]
    space_melody = [
        4, -1, 7, 6, 4, -1, 2, 3, 4, -1, 6, 4, 2, -1, 0, -1,
        7, -1, 6, 4, 3, -1, 4, 6, 7, -1, 4, 2, 0, -1, 2, -1,
    ]
    space_counter = [
        0, 2, -1, 4, 6, -1, 7, -1, 2, 4, -1, 7, 6, -1, 4, 2,
        4, -1, 2, 0, -1, 3, 4, -1, 2, 0, -1, 4, 6, -1, 7, -1,
    ]

    # 5. cyberpunk / metropolis arcade: a minor nocturnal chamber jazz & brass synth
    cyber_scale = [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00]
    cyber_chords = [
        [110.00, 164.81, 220.00, 261.63],  # Am
        [174.61, 220.00, 261.63, 349.23],  # Fmaj7
        [130.81, 196.00, 261.63, 329.63],  # C
        [164.81, 246.94, 329.63, 392.00],  # Em7
    ]
    cyber_melody = [
        0, 2, 4, 7, 5, 4, 2, 0, 3, 2, 0, -1, 4, 6, 5, 4,
        7, 6, 4, 2, 3, 4, 5, 2, 4, 3, 2, 0, 1, 2, 0, -1,
    ]
    cyber_counter = [
        4, -1, 7, -1, 2, -1, 4, -1, 5, -1, 4, 2, -1, 3, -1, 2,
        4, -1, 2, -1, 5, -1, 7, -1, 6, -1, 4, -1, 3, -1, 4, -1,
    ]

    compositions = {
        "desert_oasis": (desert_scale, desert_chords, desert_melody, desert_counter, 96, "desert"),
        "medieval_tavern": (tavern_scale, tavern_chords, tavern_melody, tavern_counter, 102, "tavern"),
        "enchanted_forest": (forest_scale, forest_chords, forest_melody, forest_counter, 92, "forest"),
        "space_station": (space_scale, space_chords, space_melody, space_counter, 86, "space"),
        "cyberpunk_alley": (cyber_scale, cyber_chords, cyber_melody, cyber_counter, 106, "cyber"),
        "cyberpunk_facility": (cyber_scale, cyber_chords, cyber_melody, cyber_counter, 106, "cyber"),
        "ambient": (tavern_scale, tavern_chords, tavern_melody, tavern_counter, 96, "tavern"),
    }

    root_aliases = {
        "desert_oasis": "desert_wind",
        "medieval_tavern": "tavern_ambient",
        "enchanted_forest": "forest_mystic",
        "space_station": "scifi_hum",
        "cyberpunk_alley": "cyberpunk_ambient",
    }

    for name, (sc, ch, mel, cnt, bpm, st) in compositions.items():
        pcm = synthesize_music_track(sc, ch, mel, cnt, bpm=bpm, duration_sec=24.0, style=st)
        wav_path = tracks_dir / f"{name}.wav"
        mp3_path = tracks_dir / f"{name}.mp3"
        save_wav(wav_path, pcm)
        shutil.copyfile(wav_path, mp3_path)
        print(f"Composed musical score: {wav_path} ({wav_path.stat().st_size} bytes)")

        if name in root_aliases:
            alias = root_aliases[name]
            save_wav(root_audio_dir / f"{alias}.wav", pcm)
            shutil.copyfile(wav_path, root_audio_dir / f"{alias}.mp3")


if __name__ == "__main__":
    main()
