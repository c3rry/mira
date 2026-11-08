// audio manager with polyphonic musical score sequencer and dual-track cross-fading
export class AudioManager {
  private static instance: AudioManager | null = null;

  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private spatialSubmix: GainNode | null = null;

  private activeSlot: "A" | "B" = "A";
  private audioA: HTMLAudioElement | null = null;
  private audioB: HTMLAudioElement | null = null;
  private sourceA: MediaElementAudioSourceNode | null = null;
  private sourceB: MediaElementAudioSourceNode | null = null;
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;

  // polyphonic web audio music sequencer state
  private sequencerTimer: ReturnType<typeof setInterval> | null = null;
  private stepIndex: number = 0;
  private activeScoreBiome: string = "desert_oasis";
  private isSequencerRunning: boolean = false;

  private isMuted: boolean = false;
  private currentTrack: string | null = null;
  private isUnlocked: boolean = false;

  private constructor() {
    if (typeof window !== "undefined") {
      this.initDomElements();
    }
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initDomElements(): void {
    if (typeof window === "undefined") return;

    this.audioA = new Audio();
    this.audioA.loop = true;
    this.audioA.crossOrigin = "anonymous";
    this.audioA.preload = "auto";

    this.audioB = new Audio();
    this.audioB.loop = true;
    this.audioB.crossOrigin = "anonymous";
    this.audioB.preload = "auto";
  }

  // initialize or resume shared web audio context on user gesture
  public async unlockAudio(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();

        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);

        this.ambientGain = this.audioCtx.createGain();
        this.ambientGain.gain.setValueAtTime(0.75, this.audioCtx.currentTime);
        this.ambientGain.connect(this.masterGain);

        this.spatialSubmix = this.audioCtx.createGain();
        this.spatialSubmix.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        this.spatialSubmix.connect(this.masterGain);

        if (this.audioA && !this.sourceA) {
          try {
            this.sourceA = this.audioCtx.createMediaElementSource(this.audioA);
            this.gainA = this.audioCtx.createGain();
            this.gainA.gain.setValueAtTime(0.65, this.audioCtx.currentTime);
            this.sourceA.connect(this.gainA);
            this.gainA.connect(this.ambientGain);
          } catch {}
        }

        if (this.audioB && !this.sourceB) {
          try {
            this.sourceB = this.audioCtx.createMediaElementSource(this.audioB);
            this.gainB = this.audioCtx.createGain();
            this.gainB.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
            this.sourceB.connect(this.gainB);
            this.gainB.connect(this.ambientGain);
          } catch {}
        }
      }

      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.isUnlocked = true;

      if (this.currentTrack) {
        await this.fadeToTrack(this.currentTrack, 0.65, 1.0, true);
      } else {
        this.startMusicalSequencer(this.activeScoreBiome);
      }

      return true;
    } catch {
      this.isUnlocked = true;
      return true;
    }
  }

  // play a single plucked or melodic instrument note with adsr envelope
  private triggerNote(
    freq: number,
    duration: number,
    volume: number,
    waveType: OscillatorType = "triangle",
    detuneCents: number = 0
  ): void {
    if (!this.audioCtx || this.isMuted) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const filter = this.audioCtx.createBiquadFilter();
      const gain = this.audioCtx.createGain();

      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, now);
      if (detuneCents !== 0) {
        osc.detune.setValueAtTime(detuneCents, now);
      }

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(freq * 4.5, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(280, freq * 1.4), now + duration);

      // crisp musical pluck attack and smooth exponential decay
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientGain || this.masterGain || this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.04);
    } catch {}
  }

  // play soft acoustic frame-drum percussive beat
  private triggerPercussion(isDownbeat: boolean): void {
    if (!this.audioCtx || this.isMuted) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      const startFreq = isDownbeat ? 115 : 175;
      const endFreq = isDownbeat ? 46 : 75;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.14);

      gain.gain.setValueAtTime(isDownbeat ? 0.16 : 0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ambientGain || this.masterGain || this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  // start polyphonic musical score sequencer adapted to biome
  public startMusicalSequencer(biome: string = "desert_oasis"): void {
    this.activeScoreBiome = biome.toLowerCase();
    if (!this.audioCtx || this.isSequencerRunning) return;

    const getScoreData = (b: string) => {
      if (b.includes("desert") || b.includes("giza") || b.includes("pyramid") || b.includes("ruin")) {
        return {
          scale: [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 523.25, 587.33],
          chords: [
            [146.83, 220.00, 293.66, 369.99],
            [155.56, 233.08, 311.13, 392.00],
            [130.81, 196.00, 261.63, 311.13],
            [146.83, 220.00, 293.66, 369.99],
          ],
          melody: [0, 2, 3, 4, 5, 4, 3, 2, 1, 0, -1, 2, 4, 3, 2, 0],
          wave: "triangle" as OscillatorType,
        };
      }
      if (b.includes("tavern") || b.includes("medieval") || b.includes("roman") || b.includes("castle")) {
        return {
          scale: [293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33],
          chords: [
            [146.83, 220.00, 293.66, 349.23],
            [130.81, 196.00, 261.63, 329.63],
            [196.00, 246.94, 293.66, 392.00],
            [146.83, 220.00, 293.66, 349.23],
          ],
          melody: [0, 2, 4, 7, 6, 4, 2, 3, 4, 2, 0, -1, 1, 2, 4, 0],
          wave: "triangle" as OscillatorType,
        };
      }
      if (b.includes("forest") || b.includes("cavern") || b.includes("garden")) {
        return {
          scale: [392.00, 440.00, 493.88, 554.37, 587.33, 659.25, 739.99, 783.99],
          chords: [
            [196.00, 293.66, 392.00, 493.88],
            [220.00, 277.18, 329.63, 440.00],
            [164.81, 246.94, 329.63, 392.00],
            [196.00, 293.66, 392.00, 493.88],
          ],
          melody: [0, 2, 4, 5, 7, 5, 4, 2, 3, 4, 2, 0, -1, 4, 2, 0],
          wave: "sine" as OscillatorType,
        };
      }
      if (b.includes("space") || b.includes("station") || b.includes("spire")) {
        return {
          scale: [261.63, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 523.25],
          chords: [
            [130.81, 196.00, 261.63, 329.63],
            [146.83, 220.00, 293.66, 369.99],
            [164.81, 246.94, 329.63, 392.00],
            [130.81, 196.00, 246.94, 329.63],
          ],
          melody: [4, -1, 7, 6, 4, -1, 2, 3, 4, -1, 6, 4, 2, -1, 0, -1],
          wave: "sine" as OscillatorType,
        };
      }
      return {
        scale: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00],
        chords: [
          [110.00, 164.81, 220.00, 261.63],
          [174.61, 220.00, 261.63, 349.23],
          [130.81, 196.00, 261.63, 329.63],
          [164.81, 246.94, 329.63, 392.00],
        ],
        melody: [0, 2, 4, 7, 5, 4, 2, 0, 3, 2, 0, -1, 4, 3, 2, 0],
        wave: "sawtooth" as OscillatorType,
      };
    };

    this.isSequencerRunning = true;
    this.sequencerTimer = setInterval(() => {
      if (!this.audioCtx || this.isMuted || this.audioCtx.state !== "running") return;

      const score = getScoreData(this.activeScoreBiome);
      const step = this.stepIndex++;
      const chord = score.chords[(step >> 3) % score.chords.length];

      // 1. lush sustained string / choir pad on bar boundaries
      if (step % 8 === 0) {
        chord.forEach((cFreq, idx) => {
          this.triggerNote(cFreq, 2.2, 0.032, "sine", idx % 2 === 0 ? 5 : -5);
        });
      }

      // 2. plucked harp / lute / oud arpeggio
      const arpPattern = [0, 1, 2, 3, 2, 1, 3, 2];
      const arpFreq = chord[arpPattern[step % arpPattern.length] % chord.length];
      this.triggerNote(arpFreq, 0.48, 0.085, "triangle", 4);

      // 3. warm cello / bass root on beats 0, 3, 4, 6
      if (step % 8 === 0 || step % 8 === 3 || step % 8 === 4 || step % 8 === 6) {
        const bassMult = step % 4 === 0 ? 0.5 : 0.75;
        this.triggerNote(chord[0] * bassMult, 0.85, 0.12, "sine");
      }

      // 4. expressive lead melody line + high harmonic shimmer
      const melIdx = score.melody[step % score.melody.length];
      if (melIdx >= 0) {
        const melFreq = score.scale[melIdx % score.scale.length];
        this.triggerNote(melFreq, 0.56, 0.095, score.wave, -4);
        if (step % 3 === 0) {
          this.triggerNote(melFreq * 2.0, 0.35, 0.03, "sine", 6);
        }
      }

      // 5. rhythmic world percussion pulse
      if (step % 2 === 0 || step % 8 === 3) {
        this.triggerPercussion(step % 4 === 0);
      }
    }, 280);
  }

  public stopMusicalSequencer(): void {
    if (this.sequencerTimer) {
      clearInterval(this.sequencerTimer);
      this.sequencerTimer = null;
    }
    this.isSequencerRunning = false;
  }

  // cross-fade between tracks or update active biome score
  public async fadeToTrack(
    trackUrl: string,
    targetVolume: number = 0.65,
    durationSeconds: number = 1.5,
    force: boolean = false
  ): Promise<void> {
    // prefer wav extension for guaranteed pcm decoding across browsers
    const normalizedUrl = trackUrl.replace(/\.mp3$/i, ".wav");
    const isSameTrack = this.currentTrack === normalizedUrl;
    if (isSameTrack && !force) return;
    this.currentTrack = normalizedUrl;

    const biomeHint = normalizedUrl.includes("desert") || normalizedUrl.includes("ruin")
      ? "desert_oasis"
      : normalizedUrl.includes("tavern") || normalizedUrl.includes("medieval")
      ? "medieval_tavern"
      : normalizedUrl.includes("forest") || normalizedUrl.includes("cavern")
      ? "enchanted_forest"
      : normalizedUrl.includes("space") || normalizedUrl.includes("spire")
      ? "space_station"
      : "cyberpunk_alley";

    this.activeScoreBiome = biomeHint;

    if (!this.isUnlocked) {
      return;
    }

    const nextSlot = this.activeSlot === "A" ? "B" : "A";
    const outgoingAudio = this.activeSlot === "A" ? this.audioA : this.audioB;
    const incomingAudio = nextSlot === "A" ? this.audioA : this.audioB;
    const outgoingGain = this.activeSlot === "A" ? this.gainA : this.gainB;
    const incomingGain = nextSlot === "A" ? this.gainA : this.gainB;

    if (!incomingAudio || !outgoingAudio) {
      this.startMusicalSequencer(biomeHint);
      return;
    }

    try {
      if (!incomingAudio.src.endsWith(normalizedUrl)) {
        incomingAudio.src = normalizedUrl;
        incomingAudio.load();
      }

      const playPromise = incomingAudio.play();
      let playSucceeded = false;

      if (playPromise !== undefined) {
        try {
          await playPromise;
          playSucceeded = true;
          this.stopMusicalSequencer();
        } catch {
          this.startMusicalSequencer(biomeHint);
        }
      }

      const now = this.audioCtx?.currentTime || 0;
      if (this.audioCtx && incomingGain && outgoingGain && playSucceeded) {
        outgoingGain.gain.cancelScheduledValues(now);
        outgoingGain.gain.setValueAtTime(outgoingGain.gain.value, now);
        outgoingGain.gain.linearRampToValueAtTime(0.0, now + durationSeconds);

        incomingGain.gain.cancelScheduledValues(now);
        incomingGain.gain.setValueAtTime(0.0, now);
        incomingGain.gain.linearRampToValueAtTime(targetVolume, now + durationSeconds);

        setTimeout(() => {
          outgoingAudio.pause();
          outgoingAudio.currentTime = 0;
        }, durationSeconds * 1000);
      } else if (playSucceeded) {
        incomingAudio.volume = targetVolume;
        outgoingAudio.pause();
      }

      if (playSucceeded) {
        this.activeSlot = nextSlot;
      }
    } catch {
      this.startMusicalSequencer(biomeHint);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    if (this.audioCtx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0.0 : 1.0,
        this.audioCtx.currentTime
      );
    }

    if (this.audioA) this.audioA.muted = this.isMuted;
    if (this.audioB) this.audioB.muted = this.isMuted;

    return this.isMuted;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getSpatialSubmix(): GainNode | null {
    return this.spatialSubmix;
  }

  public isAudioUnlocked(): boolean {
    return this.isUnlocked;
  }

  public isAudioMuted(): boolean {
    return this.isMuted;
  }
}
