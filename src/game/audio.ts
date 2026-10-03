// Tiny procedural WebAudio sound engine — no files needed.
type Sfx = "coin" | "trick" | "land" | "crash" | "boost" | "ui" | "buy" | "loop" | "pad" | "cone" | "wall" | "deny" | "finish";

export type CrashKind = "wall" | "barrier" | "metal" | "concrete" | "wood" | "glass" | "landing" | "roof" | "scrape";

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  engOsc: OscillatorNode | null = null;
  engOsc2: OscillatorNode | null = null;
  engGain: GainNode | null = null;
  engFilter: BiquadFilterNode | null = null;
  windGain: GainNode | null = null;
  volume = 0.7;
  muted = false;
  lastCoin = 0;
  coinStep = 0;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.applyVolume();

    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = "lowpass";
    this.engFilter.frequency.value = 600;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = "sawtooth";
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = "square";
    this.engOsc.connect(this.engFilter);
    this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.engOsc.start();
    this.engOsc2.start();

    // wind noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800;
    bp.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(bp);
    bp.connect(this.windGain);
    this.windGain.connect(this.master);
    src.start();
  }

  setVolume(v: number, muted: boolean) {
    this.volume = v;
    this.muted = muted;
    this.applyVolume();
  }
  applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.6;
  }

  crash(kind: CrashKind, intensity: number) {
    if (!this.ctx) return;
    const v = 0.2 + intensity * 0.6;
    if (kind === "scrape") { this.noise(0.25, v * 0.4, 4000); return; }
    const low = kind === "wood" ? 500 : kind === "concrete" || kind === "wall" || kind === "barrier" ? 900 : 2200;
    this.noise(0.3 + intensity * 0.5, v, low);
    this.tone(kind === "wood" ? 140 : 90, 0.3, "sine", v * 0.5, 40);
    if (kind === "metal" || kind === "roof" || kind === "landing")
      [1230, 1870, 2650].forEach((f, i) => this.tone(f * (0.9 + Math.random() * 0.2), 0.25, "square", v * 0.05, f * 0.6, i * 0.03));
    if (kind === "glass" || intensity > 0.7)
      for (let i = 0; i < 6; i++) this.tone(3000 + Math.random() * 3000, 0.12, "sine", 0.04, undefined, 0.05 + i * 0.04);
  }

  land(intensity: number) {
    this.noise(0.15 + intensity * 0.15, 0.2 + intensity * 0.4, 300);
    this.tone(90, 0.15, "sine", 0.2 + intensity * 0.2, 50);
  }

  engine(speed01: number, boosting: boolean, active: boolean, electric = false) {
    if (!this.ctx || !this.engOsc || !this.engOsc2 || !this.engGain || !this.engFilter || !this.windGain) return;
    const t = this.ctx.currentTime;
    const f = 48 + speed01 * 140 + (boosting ? 40 : 0);
    this.engOsc.type = electric ? "sine" : "sawtooth";
    this.engOsc.frequency.setTargetAtTime(electric ? f * 4 : f, t, 0.08);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.engFilter.frequency.setTargetAtTime(400 + speed01 * 1400 + (boosting ? 900 : 0), t, 0.1);
    this.engGain.gain.setTargetAtTime(active ? 0.05 + speed01 * 0.05 : 0, t, 0.15);
    this.windGain.gain.setTargetAtTime(active ? speed01 * speed01 * 0.18 : 0, t, 0.2);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  play(s: Sfx) {
    if (!this.ctx) return;
    switch (s) {
      case "coin": {
        const now = performance.now();
        this.coinStep = now - this.lastCoin < 400 ? Math.min(this.coinStep + 1, 10) : 0;
        this.lastCoin = now;
        const f = 880 * Math.pow(2, this.coinStep / 12);
        this.tone(f, 0.12, "square", 0.08);
        this.tone(f * 1.5, 0.14, "sine", 0.06, undefined, 0.05);
        break;
      }
      case "trick":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.15, "triangle", 0.12, undefined, i * 0.06));
        break;
      case "loop":
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, "square", 0.07, undefined, i * 0.05));
        break;
      case "land":
        this.noise(0.18, 0.4, 300);
        this.tone(90, 0.15, "sine", 0.3, 50);
        break;
      case "crash":
        this.noise(0.6, 0.7, 1200);
        this.tone(160, 0.5, "sawtooth", 0.15, 40);
        break;
      case "boost":
        this.noise(0.8, 0.35, 2500);
        this.tone(200, 0.6, "sawtooth", 0.08, 700);
        break;
      case "pad":
        this.tone(300, 0.4, "square", 0.08, 1200);
        break;
      case "cone":
        this.tone(240, 0.12, "triangle", 0.15, 120);
        break;
      case "wall":
        this.noise(0.12, 0.2, 3000);
        break;
      case "ui":
        this.tone(660, 0.06, "square", 0.05);
        break;
      case "buy":
        [523, 784, 1047, 1568].forEach((f, i) => this.tone(f, 0.2, "square", 0.07, undefined, i * 0.07));
        break;
      case "deny":
        this.tone(200, 0.2, "square", 0.08, 120);
        break;
      case "finish":
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.12, undefined, i * 0.09));
        break;
    }
  }
}

export const audio = new AudioEngine();
