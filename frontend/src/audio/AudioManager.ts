// audio manager providing dual-track ambient cross-fades and spatial web audio submixes
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

  private isMuted: boolean = false;
  private currentTrack: string | null = null;
  private isUnlocked: boolean = false;

  private constructor() {
    // defer full audio context initialization until browser user gesture
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

    this.audioB = new Audio();
    this.audioB.loop = true;
    this.audioB.crossOrigin = "anonymous";
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
          this.sourceA = this.audioCtx.createMediaElementSource(this.audioA);
          this.gainA = this.audioCtx.createGain();
          this.gainA.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
          this.sourceA.connect(this.gainA);
          this.gainA.connect(this.ambientGain);
        }

        if (this.audioB && !this.sourceB) {
          this.sourceB = this.audioCtx.createMediaElementSource(this.audioB);
          this.gainB = this.audioCtx.createGain();
          this.gainB.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
          this.sourceB.connect(this.gainB);
          this.gainB.connect(this.ambientGain);
        }
      }

      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.isUnlocked = true;
      return true;
    } catch (err) {
      // 15-minute de-scoping valve: fall back gracefully if media element source fails
      console.warn("web audio initialization fallback:", err);
      return false;
    }
  }

  // cross-fade between tracks over 1.5 seconds with volume anchoring
  public async fadeToTrack(
    trackUrl: string,
    targetVolume: number = 0.6,
    durationSeconds: number = 1.5
  ): Promise<void> {
    if (this.currentTrack === trackUrl) return;
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
      incomingAudio.src = trackUrl;
      const playPromise = incomingAudio.play();
      if (playPromise !== undefined) {
        await playPromise.catch(() => {
          // autoplay policy restriction or missing file fallback
        });
      }

      const now = this.audioCtx?.currentTime || 0;

      if (this.audioCtx && incomingGain && outgoingGain) {
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
      } else {
        // html5 direct volume fallback
        incomingAudio.volume = targetVolume;
        outgoingAudio.pause();
      }

      this.activeSlot = nextSlot;
    } catch (err) {
      console.warn("ambient cross-fade error:", err);
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
