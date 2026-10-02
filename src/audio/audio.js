// All sound is synthesised live with the Web Audio API: no audio files,
// no copyright issues and nothing extra to download.
//
// The music is a procession groove: dhol (bass + treble), tasha rolls,
// a tanpura-style drone and a shehnai-like melody in Raga Bhupali
// (Sa Re Ga Pa Dha). The clock that drives the music also drives the
// in-game "Dhol Beat" mechanic.

const BHUPALI = [0, 2, 4, 7, 9]; // semitone offsets of Sa Re Ga Pa Dha

export class Audio {
  constructor() {
    this.ctx = null;
    // Volume: 1 = full, 0.45 = low, 0 = off
    const saved = parseFloat(localStorage.getItem('my-volume'));
    this.volume = Number.isFinite(saved) ? saved : (localStorage.getItem('my-muted') === '1' ? 0 : 1);
    this.muted = this.volume === 0;
    this.bpm = 104;
    this.step = 0;
    this.nextTime = 0;
    this.playing = false;
    this.intensity = 0; // 0..1, grows with combo
    this.startTime = 0;
    this.fallbackStart = performance.now() / 1000;
    this.baseNote = 50; // D3 as Sa
  }

  // Must be called from a user gesture (browser autoplay rules).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6 * this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);

      // Short noise buffer reused by drums and whooshes.
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      // Simple echo gives the procession an open-street feel.
      this.delay = this.ctx.createDelay(1); this.delay.delayTime.value = 0.23;
      const fb = this.ctx.createGain(); fb.gain.value = 0.28;
      const wet = this.ctx.createGain(); wet.gain.value = 0.25;
      this.delay.connect(fb).connect(this.delay);
      this.delay.connect(wet).connect(this.musicBus);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    this.muted = v === 0;
    try { localStorage.setItem('my-volume', String(v)); } catch { /* private mode */ }
    if (this.master) this.master.gain.setTargetAtTime(0.6 * v, this.ctx.currentTime, 0.05);
  }

  setMuted(m) { this.setVolume(m ? 0 : 1); }

  get now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000 - this.fallbackStart; }
  get beatLen() { return 60 / this.bpm; }

  // Sound scheduled at time t reaches the speakers a little later (output
  // latency, bigger on Bluetooth and some phones). Players tap to what they
  // HEAR, so beat checks subtract that delay.
  latency() {
    if (!this.ctx) return 0;
    return Math.min(0.3, (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0));
  }

  // 0 = exactly on a beat, 0.5 = halfway between beats.
  beatOffset() {
    const t = (this.now - this.latency() - this.startTime) / this.beatLen;
    const frac = t - Math.floor(t);
    return Math.min(frac, 1 - frac);
  }
  beatPhase() {
    const t = (this.now - this.latency() - this.startTime) / this.beatLen;
    return ((t % 1) + 1) % 1;
  }

  // ---------- Music scheduler ----------
  startMusic(bpm, baseNote = 50) {
    this.bpm = bpm;
    this.baseNote = baseNote;
    this.startTime = this.now + 0.05;
    this.nextTime = this.startTime;
    this.step = 0;
    this.playing = true;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
    if (this.ctx) this.startDrone();
  }

  // Changes tempo without breaking the beat grid.
  setTempo(bpm, baseNote) {
    const beatsDone = Math.ceil((this.now - this.startTime) / this.beatLen);
    const nextBeat = this.startTime + beatsDone * this.beatLen;
    this.bpm = bpm;
    this.startTime = nextBeat;
    this.nextTime = nextBeat;
    this.step = 0;
    if (baseNote && baseNote !== this.baseNote) { this.baseNote = baseNote; if (this.ctx) this.startDrone(); }
  }

  stopMusic() {
    this.playing = false;
    clearInterval(this.timer);
    this.stopDrone();
  }

  schedule() {
    if (!this.ctx || !this.playing) return;
    const sixteenth = this.beatLen / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t) {
    const s = step % 16;
    const I = this.intensity;
    // Classic dhol-tasha style groove
    if (s === 0 || s === 8) this.dhol(t, 'bass', 1);
    if (s === 6 || s === 11) this.dhol(t, 'bass', 0.6);
    if (s === 4 || s === 12) this.dhol(t, 'treble', 0.9);
    if (s === 2 || s === 14 || (I > 0.3 && (s === 7 || s === 15))) this.dhol(t, 'treble', 0.45);
    if (s % 2 === 0) this.tasha(t, 0.18 + I * 0.25);
    if (I > 0.55 && s % 2 === 1) this.tasha(t, 0.12);
    if (step % 32 === 0) this.bell(t, 0.25);

    // Melody every other bar, only once some energy has built up.
    const bar = Math.floor(step / 16);
    if (I > 0.15 || bar % 2 === 1) {
      const pattern = [0, -1, 2, -1, 3, -1, 2, 1, 0, -1, 4, -1, 3, 2, 1, -1];
      const high = [5, -1, 4, 3, 4, -1, 2, -1, 3, 4, 5, -1, 6, 5, 4, -1];
      const p = bar % 4 === 3 ? high : pattern;
      const idx = p[s];
      if (idx >= 0) this.shehnai(t, idx, this.beatLen / 4 * 1.8, 0.09 + I * 0.05);
    }
  }

  noteFreq(degree, octave = 0) {
    const n = BHUPALI.length;
    const o = Math.floor(degree / n);
    const semis = BHUPALI[((degree % n) + n) % n] + 12 * (o + octave);
    return 440 * Math.pow(2, (this.baseNote + 12 + semis - 69) / 12);
  }

  // ---------- Instruments ----------
  dhol(t, kind, vel) {
    const c = this.ctx;
    const o = c.createOscillator(); const g = c.createGain();
    if (kind === 'bass') {
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    } else {
      o.type = 'triangle';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(230, t + 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45 * vel, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    }
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 0.5);
    // Skin slap
    this.noiseHit(t, kind === 'bass' ? 900 : 2600, kind === 'bass' ? 0.04 : 0.05, 0.35 * vel, this.musicBus);
  }

  tasha(t, vel) { this.noiseHit(t, 5200, 0.045, vel, this.musicBus, 'highpass'); }

  noiseHit(t, freq, dur, vel, bus, type = 'bandpass') {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  bell(t, vel, base = 880) {
    const c = this.ctx;
    const partials = [1, 2.76, 5.4, 8.93];
    partials.forEach((p, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = 'sine'; o.frequency.value = base * p;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel / (i + 1), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / (i * 0.6 + 1));
      o.connect(g); g.connect(this.musicBus); g.connect(this.delay);
      o.start(t); o.stop(t + 1.8);
    });
  }

  shehnai(t, degree, dur, vel) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = this.noteFreq(degree, 1);
    const vib = c.createOscillator(); vib.frequency.value = 5.5;
    const vibG = c.createGain(); vibG.gain.value = 6;
    vib.connect(vibG).connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.03);
    g.gain.setValueAtTime(vel, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g); g.connect(this.musicBus); g.connect(this.delay);
    o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }

  startDrone() {
    this.stopDrone();
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.05, c.currentTime, 1.0);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    f.connect(g).connect(this.musicBus);
    const freqs = [this.noteFreq(0, -1), this.noteFreq(3, -1), this.noteFreq(0, 0)];
    this.drone = { g, oscs: freqs.map((fr, i) => {
      const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = fr; o.detune.value = (i - 1) * 4;
      o.connect(f); o.start(); return o;
    }) };
  }

  stopDrone() {
    if (!this.drone) return;
    const { g, oscs } = this.drone;
    g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    oscs.forEach((o) => o.stop(this.ctx.currentTime + 1.5));
    this.drone = null;
  }

  // ---------- Sound effects ----------
  sfx(name, arg = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const tone = (freq, dur, type = 'sine', vel = 0.3, slideTo) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
    };
    switch (name) {
      case 'modak': { // rising pentatonic sparkle
        const f = this.noteFreq((arg % 10) + 5, 1);
        tone(f, 0.18, 'triangle', 0.22); tone(f * 2, 0.12, 'sine', 0.08);
        break;
      }
      case 'offering': tone(this.noteFreq(7, 1), 0.25, 'sine', 0.2); tone(this.noteFreq(9, 1), 0.3, 'sine', 0.12); break;
      case 'jump': this.noiseHit(t, 1200, 0.18, 0.25, this.sfxBus, 'bandpass'); tone(300, 0.16, 'sine', 0.12, 700); break;
      case 'slide': this.noiseHit(t, 600, 0.25, 0.3, this.sfxBus, 'lowpass'); break;
      case 'lane': this.noiseHit(t, 2200, 0.08, 0.12, this.sfxBus); break;
      case 'beat': tone(1320, 0.08, 'square', 0.05); break;
      case 'hit':
        tone(180, 0.35, 'sawtooth', 0.25, 60);
        this.noiseHit(t, 400, 0.3, 0.5, this.sfxBus, 'lowpass');
        break;
      case 'petal': this.bell(t, 0.08, 1760); break;
      case 'vighna': { // conch (shankh) swell + bells
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(this.noteFreq(0, 0), t);
        o.frequency.linearRampToValueAtTime(this.noteFreq(0, 0) * 1.02, t + 1.2);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1800, t + 0.8);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(f).connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 1.7);
        this.bell(t + 0.1, 0.3, 1046); this.bell(t + 0.35, 0.25, 1318);
        break;
      }
      case 'eco': [0, 2, 4].forEach((d, i) => { const o = this.noteFreq(d + 5, 1); setTimeout(() => this.sfx('_tone', o), i * 70); }); break;
      case '_tone': tone(arg, 0.2, 'triangle', 0.18); break;
      case 'bad': tone(300, 0.3, 'square', 0.1, 150); break;
      case 'ui': tone(880, 0.07, 'triangle', 0.12); break;
      case 'correct': [0, 2, 4, 7].forEach((d, i) => setTimeout(() => this.sfx('_tone', this.noteFreq(d + 5, 1)), i * 80)); break;
      case 'wrong': tone(220, 0.35, 'sawtooth', 0.12, 140); break;
      case 'firework': this.noiseHit(t, 300, 0.8, 0.4, this.sfxBus, 'lowpass'); this.noiseHit(t + 0.05, 4000, 0.6, 0.15, this.sfxBus, 'highpass'); break;
      case 'aarti': this.bell(t, 0.35, 660); this.bell(t + 0.6, 0.3, 880); this.bell(t + 1.2, 0.3, 660); break;
      default: break;
    }
  }
}
