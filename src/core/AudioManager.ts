export type SoundName =
  | 'jump'
  | 'land'
  | 'cup'
  | 'buy'
  | 'click'
  | 'select'
  | 'gameover'
  | 'step'
  | 'newbest';

type AC = typeof AudioContext;

/**
 * Tiny synthesized paper-and-coffee sound kit. No files, no network, and the
 * context is only created after a gesture, as mobile browsers require.
 */
export class AudioManager {
  private enabled: boolean;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastStep = 0;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(
        enabled ? 0.34 : 0,
        this.context.currentTime,
        0.03,
      );
    }
    if (enabled) void this.unlock();
  }

  async unlock(): Promise<void> {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const Ctor: AC | undefined =
          window.AudioContext ??
          (
            window as unknown as {
              webkitAudioContext?: AC;
            }
          ).webkitAudioContext;
        if (!Ctor) return;
        this.context = new Ctor();
        this.master = this.context.createGain();
        this.master.gain.value = 0.34;
        this.master.connect(this.context.destination);
        this.noise = this.makeNoiseBuffer(this.context);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      // Audio is a garnish, never a requirement to play.
    }
  }

  private makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.86 * last + 0.14 * white;
      channel[i] = last;
    }
    return buffer;
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    void this.unlock();
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return;

    try {
      if (name === 'jump') {
        this.tone(220, 440, 0.13, 'triangle', 0.12, 0.008);
        this.noiseBurst(0.08, 900, 0.055);
      } else if (name === 'land') {
        this.tone(105, 62, 0.12, 'sine', 0.16, 0.004);
        this.noiseBurst(0.08, 380, 0.07);
      } else if (name === 'cup') {
        this.tone(660, 990, 0.11, 'sine', 0.12, 0.006);
        this.tone(990, 1320, 0.16, 'triangle', 0.08, 0.03);
        this.noiseBurst(0.08, 2400, 0.035);
      } else if (name === 'buy') {
        [523, 659, 784, 1047].forEach((freq, index) =>
          this.tone(freq, freq * 1.01, 0.22, 'triangle', 0.1, index * 0.065),
        );
        this.noiseBurst(0.12, 1600, 0.03);
      } else if (name === 'select') {
        this.tone(520, 760, 0.09, 'sine', 0.09, 0);
      } else if (name === 'newbest') {
        [523, 659, 784, 1047, 1319].forEach((freq, index) =>
          this.tone(freq, freq, 0.3, 'triangle', 0.11, index * 0.08),
        );
      } else if (name === 'gameover') {
        this.tone(260, 104, 0.45, 'triangle', 0.14, 0.015);
        this.tone(170, 72, 0.55, 'sine', 0.11, 0.08);
        this.noiseBurst(0.2, 700, 0.05);
      } else if (name === 'step') {
        const now = performance.now();
        if (now - this.lastStep < 150) return;
        this.lastStep = now;
        this.noiseBurst(0.035, 1700, 0.022);
      } else {
        this.noiseBurst(0.025, 3000, 0.02);
      }
    } catch {
      // Ignore transient WebAudio errors on constrained devices.
    }
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay: number,
  ): void {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noiseBurst(duration: number, cutoff: number, volume: number): void {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const start = ctx.currentTime;
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.01);
  }
}
