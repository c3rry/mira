// audio manager providing dual-track ambient cross-fades and procedural web audio synth fallback
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

  // procedural web audio drone synth for guaranteed offline/fallback sound
  private synthGain: GainNode | null = null;
  private synthOsc1: OscillatorNode | null = null;
  private synthOsc2: OscillatorNode | null = null;
  private synthFilter: BiquadFilterNode | null = null;
  private isSynthRunning: boolean = false;

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

  // initialize or resume the shared web audio context on user gesture
  public async unlockAudio(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();

        // master gain node
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);

        // ambient bus gain node
        this.ambientGain = this.audioCtx.createGain();
        this.ambientGain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);
        this.ambientGain.connect(this.masterGain);

        // spatial submix node for 3d positional emitters
        this.spatialSubmix = this.audioCtx.createGain();
        this.spatialSubmix.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        this.spatialSubmix.connect(this.masterGain);

        // connect dual html5 audio elements into ambient bus
        if (this.audioA && !this.sourceA) {
          try {
            this.sourceA = this.audioCtx.createMediaElementSource(this.audioA);
            this.gainA = this.audioCtx.createGain();
            this.gainA.gain.setValueAtTime(0.6, this.audioCtx.currentTime);
            this.sourceA.connect(this.gainA);
            this.gainA.connect(this.ambientGain);
          } catch (e) {
            console.warn("media element source a skipped:", e);
          }
        }

        if (this.audioB && !this.sourceB) {
          try {
            this.sourceB = this.audioCtx.createMediaElementSource(this.audioB);
            this.gainB = this.audioCtx.createGain();
            this.gainB.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
            this.sourceB.connect(this.gainB);
            this.gainB.connect(this.ambientGain);
          } catch (e) {
            console.warn("media element source b skipped:", e);
          }
        }
      }

      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.isUnlocked = true;

      // if track was previously requested, resume playback
      if (this.currentTrack) {
        await this.fadeToTrack(this.currentTrack, 0.6, 1.0, true);
      } else {
        // start immediate ambient drone so sound is instantly audible
        this.startProceduralSynth("cyberpunk");
      }

      return true;
    } catch (err) {
      console.warn("web audio initialization fallback:", err);
      // html5 direct unlock fallback
      if (this.audioA) {
        this.audioA.play().catch(() => {});
      }
      this.isUnlocked = true;
      return true;
    }
  }

  // start procedural ambient soundscape using native oscillators and low-pass filter
  public startProceduralSynth(biome: string = "cyberpunk"): void {
    if (!this.audioCtx || this.isSynthRunning) return;

    try {
      const now = this.audioCtx.currentTime;

      // configure frequencies based on biome atmosphere
      let freq1 = 55.0; // sub-bass a1
      let freq2 = 110.0; // harmonic a2
      if (biome.includes("space") || biome.includes("station")) {
        freq1 = 40.0;
        freq2 = 80.0;
      } else if (biome.includes("tavern") || biome.includes("medieval")) {
        freq1 = 146.8;
        freq2 = 220.0;
      } else if (biome.includes("forest") || biome.includes("cavern")) {
        freq1 = 216.0;
        freq2 = 432.0;
      } else if (biome.includes("desert") || biome.includes("ruins")) {
        freq1 = 92.5;
        freq2 = 185.0;
      }

      this.synthOsc1 = this.audioCtx.createOscillator();
      this.synthOsc2 = this.audioCtx.createOscillator();
      this.synthFilter = this.audioCtx.createBiquadFilter();
      this.synthGain = this.audioCtx.createGain();

      this.synthOsc1.type = "sine";
      this.synthOsc1.frequency.setValueAtTime(freq1, now);

      this.synthOsc2.type = "triangle";
      this.synthOsc2.frequency.setValueAtTime(freq2, now);

      // warm low-pass filter
      this.synthFilter.type = "lowpass";
      this.synthFilter.frequency.setValueAtTime(320, now);
      this.synthFilter.Q.setValueAtTime(2.0, now);

      // soft ambient gain level
      this.synthGain.gain.setValueAtTime(0.0, now);
      this.synthGain.gain.linearRampToValueAtTime(0.18, now + 1.5);

      this.synthOsc1.connect(this.synthFilter);
      this.synthOsc2.connect(this.synthFilter);
      this.synthFilter.connect(this.synthGain);
      if (this.ambientGain) {
        this.synthGain.connect(this.ambientGain);
      } else if (this.masterGain) {
        this.synthGain.connect(this.masterGain);
      } else {
        this.synthGain.connect(this.audioCtx.destination);
      }

      this.synthOsc1.start();
      this.synthOsc2.start();
      this.isSynthRunning = true;
    } catch (err) {
      console.warn("procedural synth startup error:", err);
    }
  }

  // stop or fade out procedural synth when audio track takes over
  public stopProceduralSynth(fadeDuration: number = 1.0): void {
    if (!this.isSynthRunning || !this.synthGain || !this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      this.synthGain.gain.cancelScheduledValues(now);
      this.synthGain.gain.setValueAtTime(this.synthGain.gain.value, now);
      this.synthGain.gain.linearRampToValueAtTime(0.0, now + fadeDuration);

      setTimeout(() => {
        try {
          this.synthOsc1?.stop();
          this.synthOsc2?.stop();
          this.synthOsc1?.disconnect();
          this.synthOsc2?.disconnect();
          this.synthFilter?.disconnect();
          this.synthGain?.disconnect();
        } catch {}
        this.isSynthRunning = false;
        this.synthOsc1 = null;
        this.synthOsc2 = null;
        this.synthFilter = null;
        this.synthGain = null;
      }, fadeDuration * 1000);
    } catch (err) {
      console.warn("procedural synth teardown error:", err);
    }
  }

  // cross-fade between tracks over specified duration
  public async fadeToTrack(
    trackUrl: string,
    targetVolume: number = 0.6,
    durationSeconds: number = 1.5,
    force: boolean = false
  ): Promise<void> {
    const isSameTrack = this.currentTrack === trackUrl;
    if (isSameTrack && !force) return;
    this.currentTrack = trackUrl;

    if (!this.isUnlocked) {
      await this.unlockAudio();
    }

    const nextSlot = this.activeSlot === "A" ? "B" : "A";
    const outgoingAudio = this.activeSlot === "A" ? this.audioA : this.audioB;
    const incomingAudio = nextSlot === "A" ? this.audioA : this.audioB;
    const outgoingGain = this.activeSlot === "A" ? this.gainA : this.gainB;
    const incomingGain = nextSlot === "A" ? this.gainA : this.gainB;

    if (!incomingAudio || !outgoingAudio) return;

    try {
      // update source
      if (incomingAudio.src !== trackUrl && !incomingAudio.src.endsWith(trackUrl)) {
        incomingAudio.src = trackUrl;
        incomingAudio.load();
      }

      // attempt audio playback
      const playPromise = incomingAudio.play();
      let playSucceeded = false;

      if (playPromise !== undefined) {
        try {
          await playPromise;
          playSucceeded = true;
          // track successfully playing, fade out procedural synth
          this.stopProceduralSynth(1.5);
        } catch {
          // autoplay blocked or file decoding error: activate procedural synth fallback
          const biomeHint = trackUrl.includes("tavern")
            ? "tavern"
            : trackUrl.includes("space")
            ? "space"
            : trackUrl.includes("forest")
            ? "forest"
            : trackUrl.includes("desert")
            ? "desert"
            : "cyberpunk";
          this.startProceduralSynth(biomeHint);
        }
      }

      const now = this.audioCtx?.currentTime || 0;

      if (this.audioCtx && incomingGain && outgoingGain && playSucceeded) {
        // ramp down outgoing track
        outgoingGain.gain.cancelScheduledValues(now);
        outgoingGain.gain.setValueAtTime(outgoingGain.gain.value, now);
        outgoingGain.gain.linearRampToValueAtTime(0.0, now + durationSeconds);

        // ramp up incoming track
        incomingGain.gain.cancelScheduledValues(now);
        incomingGain.gain.setValueAtTime(0.0, now);
        incomingGain.gain.linearRampToValueAtTime(targetVolume, now + durationSeconds);

        // pause outgoing track after cross-fade completes
        setTimeout(() => {
          outgoingAudio.pause();
          outgoingAudio.currentTime = 0;
        }, durationSeconds * 1000);
      } else if (playSucceeded) {
        // direct html5 volume fade fallback
        incomingAudio.volume = targetVolume;
        outgoingAudio.pause();
      }

      this.activeSlot = nextSlot;
    } catch (err) {
      console.warn("ambient cross-fade error:", err);
      this.startProceduralSynth("cyberpunk");
    }
  }

  public setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 1.0, this.audioCtx.currentTime);
    }
    if (this.audioA) this.audioA.muted = this.isMuted;
    if (this.audioB) this.audioB.muted = this.isMuted;
    return this.isMuted;
  }

  public getSpatialSubmix(): GainNode | null {
    return this.spatialSubmix;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public isAudioUnlocked(): boolean {
    return this.isUnlocked && this.audioCtx?.state === "running";
  }
}
