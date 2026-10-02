import * as THREE from 'three';
import { Mushak } from '../player/mushak.js';
import { World, LANE } from '../world/world.js';
import { Items, KIND } from './items.js';
import { Finale } from './finale.js';
import { ParticleSystem, Fireworks } from '../effects/particles.js';
import { sparkTexture, petalTexture } from '../world/textures.js';
import { STORIES, BLESSINGS, ACTS } from '../data/stories.js';

// Game states
const S = { MENU: 'menu', PLAY: 'play', STORY: 'story', PAUSE: 'pause', FINALE: 'finale', RESULTS: 'results' };

const ACT_SPEED = [15, 18, 21];
const ACT_BPM = [100, 112, 124];
const ACT_NOTE = [50, 52, 50];
const GRAVITY = -38;
const JUMP_V = 12.5;
const SLIDE_TIME = 0.7;
const BEAT_WINDOW = 0.12;   // seconds either side of a beat that count as "on beat"
const VIGHNA_TIME = 5;
const MODAKS_FOR_VIGHNA = 21;

export class Game {
  constructor(renderer, ui, audio, input) {
    this.r = renderer;
    this.scene = renderer.scene;
    this.camera = renderer.camera;
    this.ui = ui;
    this.audio = audio;
    this.input = input;

    // Particles
    const sparks = new ParticleSystem(2500, sparkTexture(), true);
    const petals = new ParticleSystem(900, petalTexture(), false);
    this.particles = { sparks, petals, fireworks: new Fireworks(sparks) };
    this.scene.add(sparks.points, petals.points);

    this.world = new World(this.scene, this.particles);
    this.world.onFirework = () => { if (this.state === S.PLAY) this.audio.sfx('firework'); };
    this.items = new Items(this.scene, this.particles, audio);
    this.finale = new Finale(this.scene, this.particles, audio);
    this.mushak = new Mushak();
    this.scene.add(this.mushak.group);

    this.save = this.loadSave();
    this.touch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.activeHint = null;
    this.timeScale = 1;
    this.state = S.MENU;
    this.menuT = 0;
    this.shake = 0;
    this.resetRun('yatra');

    input.on((a) => this.onAction(a));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === S.PLAY) this.pause(); });
  }

  // ---------- Save data (only scores, stored on this device) ----------
  loadSave() {
    try {
      return { best: 0, stars: 0, endless: 0, completed: false, ...JSON.parse(localStorage.getItem('my-save') || '{}') };
    } catch { return { best: 0, stars: 0, endless: 0, completed: false }; }
  }
  writeSave() { try { localStorage.setItem('my-save', JSON.stringify(this.save)); } catch { /* private mode */ } }

  setDensity(k) {
    this.particles.sparks.density = k;
    this.particles.petals.density = k;
    const px = this.r.renderer.getPixelRatio();
    this.particles.sparks.material.uniforms.uPixel.value = px;
    this.particles.petals.material.uniforms.uPixel.value = px;
  }

  // ---------- Run setup ----------
  resetRun(mode) {
    this.mode = mode;
    this.distance = 0;
    this.act = 0;
    this.actStart = 0;
    this.speed = ACT_SPEED[0];
    this.speedFactor = 1;
    this.p = {
      lane: 1, x: 0, y: 0, vy: 0, slide: 0, tumble: 0, invuln: 0, leanX: 0, landSquash: 0,
      vighna: 0, bufferJump: 0,
    };
    this.stats = {
      score: 0, modaks: 0, modaksTotal: 0, puja: 0, lives: 3, combo: 0, bestCombo: 0,
      ecoGood: 0, ecoTotal: 0, rangolis: 0, quiz: 0, quizTotal: 0, vighnas: 0, dissolved: 0,
    };
    this.lastBeatHit = 0;
    // First-time players get a slow-motion tutorial for each obstacle type
    this.tutorial = mode === 'yatra' && !this.save.tutorialDone;
    this.hintsShown = new Set();
    this.clearHint();
    this.timeScale = 1;
    this.items.tutorialQueue = this.tutorial ? [KIND.LOW, KIND.HIGH, KIND.TALL] : [];
    this.items.lastFree = 1;
    this.storyIndex = Math.floor(Math.random() * STORIES.length);
    this.items.clear();
    this.items.nextSpawn = 40;
    this.items.gateCooldown = 4;
    this.particles.sparks.clear();
    this.particles.petals.clear();
    this.finale.hide();
    this.world.setAct(0, true);
    this.mushak.group.position.set(0, 0, 0);
    this.mushak.group.rotation.set(0, 0, 0);
  }

  get mult() { return Math.min(5, 1 + Math.floor(this.stats.combo / 4)); }

  startRun(mode) {
    this.audio.unlock();
    this.resetRun(mode);
    this.state = S.PLAY;
    this.input.enabled = true;
    this.ui.show(null);
    this.ui.hud(true);
    this.ui.vighna(false);
    this.audio.startMusic(ACT_BPM[0], ACT_NOTE[0]);
    this.audio.intensity = 0;
    if (mode === 'endless') this.ui.banner('Endless Mode', 'How far can you go?', 2000);
    else this.ui.banner(ACTS[0].sub, ACTS[0].name, 2200);
    this.audio.sfx('vighna');
  }

  pause() {
    if (this.state !== S.PLAY) return;
    this.state = S.PAUSE;
    this.input.enabled = false;
    this.ui.show('pause');
    this.audio.ctx?.suspend();
  }

  resume() {
    if (this.state !== S.PAUSE) return;
    this.audio.ctx?.resume();
    this.ui.show(null);
    this.state = S.PLAY;
    this.input.enabled = true;
  }

  toMenu() {
    this.audio.ctx?.resume();
    this.audio.stopMusic();
    this.resetRun('yatra');
    this.state = S.MENU;
    this.input.enabled = false;
    this.ui.hud(false);
    this.ui.vighna(false);
    this.ui.setBest(this.save);
    this.ui.show('title');
  }

  // ---------- Input ----------
  onAction(a) {
    if (a === 'pause') { if (this.state === S.PLAY) this.pause(); else if (this.state === S.PAUSE) this.resume(); return; }
    if (this.state !== S.PLAY || this.p.tumble > 0.5) return;
    const p = this.p;
    if (a === 'left' && p.lane > 0) { p.lane--; this.audio.sfx('lane'); }
    else if (a === 'right' && p.lane < 2) { p.lane++; this.audio.sfx('lane'); }
    else if (a === 'up') {
      if (p.y <= 0.01) { p.vy = JUMP_V; p.slide = 0; this.audio.sfx('jump'); }
      else { p.bufferJump = 0.2; return; } // pressed just before landing: jump on touchdown
    }
    else if (a === 'down') {
      if (p.y > 0.01) p.vy = -22; // slam down, then slide
      p.slide = SLIDE_TIME; this.audio.sfx('slide');
    } else return;
    this.onTutorialAction(a);
    this.checkBeat();
  }

  // Dhol Beat: moves made in time with the music build the combo.
  checkBeat() {
    const off = this.audio.beatOffset() * this.audio.beatLen;
    if (off < BEAT_WINDOW) {
      this.stats.combo++;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
      this.lastBeatHit = this.audio.now;
      this.ui.beat(this.audio.beatPhase(), true);
      if (this.stats.combo % 4 === 0) {
        this.audio.sfx('beat');
        this.float(`🥁 x${this.mult}`, 2.2, '');
      }
    }
  }

  // ---------- Helpers ----------
  float(text, up = 1.8, cls = '') {
    const pos = this.mushak.group.position.clone();
    pos.y += up;
    const s = this.ui.project(pos, this.camera);
    this.ui.floater(text, s.x + (Math.random() - 0.5) * 40, s.y, cls);
  }

  addScore(n) { this.stats.score = Math.max(0, this.stats.score + n); }

  actLength() { return ACTS[this.act % 3].length; }

  // ---------- Gameplay event handlers (called by Items) ----------
  handlers = {
    onCollect: (it) => {
      const pos = it.obj.position;
      const st = this.stats;
      if (it.kind === KIND.MODAK) {
        st.modaksTotal++;
        this.audio.sfx('modak', st.modaksTotal);
        this.particles.sparks.burst(pos.x, pos.y, pos.z, 8, { color: new THREE.Color(1, 0.75, 0.25), speed: 3, life: 0.5, size: 0.9, gravity: 0 });
        if (this.p.vighna > 0) {
          // Modaks pulled in by the Vighnaharta magnet give double score but
          // don't refill the meter, otherwise the mode would chain forever.
          this.addScore(20 * this.mult);
        } else {
          st.modaks++;
          this.addScore(10 * this.mult);
          if (st.modaks >= MODAKS_FOR_VIGHNA) this.startVighna();
        }
      } else if (it.kind === KIND.DIYA) {
        if (st.lives < 3) { st.lives++; this.float('+1 🪔', 2, 'green'); }
        else { this.addScore(100); this.float('+100', 2); }
        this.audio.sfx('offering');
        this.particles.sparks.burst(pos.x, pos.y, pos.z, 20, { color: new THREE.Color(1, 0.8, 0.3), speed: 4, life: 0.8 });
      } else {
        st.puja++;
        this.addScore(25 * this.mult);
        this.audio.sfx('offering');
        this.float(it.kind === KIND.DURVA ? '🌿 +25' : '🌺 +25', 2, 'green');
        this.particles.sparks.burst(pos.x, pos.y, pos.z, 14, { colors: [new THREE.Color(0.4, 1, 0.5), new THREE.Color(1, 0.4, 0.4)], speed: 3.5, life: 0.7 });
      }
    },
    onRangoli: (it) => {
      this.stats.rangolis++;
      this.addScore(50 * this.mult);
      this.float('✨ Rangoli +50', 1.5);
      this.audio.sfx('petal');
      const p = it.obj.position;
      const cols = [new THREE.Color(1, 0.2, 0.4), new THREE.Color(1, 0.8, 0), new THREE.Color(0.2, 1, 0.5), new THREE.Color(0.3, 0.6, 1)];
      this.particles.sparks.burst(p.x, 0.2, p.z, 30, { colors: cols, speed: 5, life: 0.9, gravity: -4, lift: 3 });
    },
    onGate: (it) => {
      const st = this.stats;
      st.ecoTotal++;
      const p = it.obj.position;
      if (it.good) {
        st.ecoGood++; st.puja += 2;
        this.addScore(150);
        this.audio.sfx('eco');
        this.float('🌱 Green Blessing +150', 2.4, 'green');
        this.particles.petals.burst(p.x, 2.5, p.z, 25, { color: new THREE.Color(0.35, 0.9, 0.4), speed: 4, life: 1.5, gravity: -3, spin: 6 });
      } else {
        this.addScore(-50);
        this.audio.sfx('bad');
        this.float('Plastic −50', 2.4, 'red');
      }
    },
    onHit: (it) => {
      const st = this.stats;
      st.lives--;
      st.combo = 0;
      st.modaks = Math.floor(st.modaks / 2); // a bump spills half the modak plate
      this.p.tumble = 1;
      this.p.invuln = 1.8;
      this.speedFactor = 0.45;
      this.shake = 0.5;
      this.audio.sfx('hit');
      this.float('Oops! 🪔', 2.2, 'red');
      this.ui.flash();
      const p = this.mushak.group.position;
      this.particles.sparks.burst(p.x, 0.8, 0, 25, { colors: [new THREE.Color(1, 0.6, 0.2), new THREE.Color(1, 1, 1)], speed: 5, life: 0.6 });
      // Bumped obstacle wobbles away sideways (nobody gets hurt)
      it.obj.rotation.z = 0.3;
      if (st.lives <= 0) this.endRun(false);
    },
    onDodge: (it) => {
      // Small reward for a clean jump or slide over an obstacle
      this.addScore(20 * this.mult);
      this.float(it.kind === KIND.HIGH ? 'Nice slide! +20' : 'Nice jump! +20', 2.6);
    },
    onDissolve: (it) => {
      const p = it.obj.position;
      this.stats.dissolved++;
      this.addScore(40);
      const cols = [new THREE.Color(1, 0.55, 0), new THREE.Color(1, 0.8, 0.1), new THREE.Color(1, 0.3, 0.3)];
      this.particles.petals.burst(p.x, 1, p.z, 28, { colors: cols, speed: 5, life: 1.6, gravity: -2.5, drag: 1.5, spin: 8, lift: 3, size: 0.55 });
      this.particles.sparks.burst(p.x, 1, p.z, 15, { color: new THREE.Color(1, 0.9, 0.5), speed: 4, life: 0.6 });
      this.audio.sfx('petal');
    },
  };

  // ---------- Tutorial ----------
  updateTutorial() {
    if (!this.tutorial) return;
    if (this.activeHint) {
      const it = this.activeHint.item;
      if (!it.alive || it.z > 0.5 || !this.items.active.includes(it)) this.clearHint();
      return;
    }
    const lane = this.p.lane;
    for (const it of this.items.active) {
      if (it.z < -20 || it.z > -7) continue;
      let type = null;
      if ((it.kind === KIND.LOW || it.kind === KIND.PLASTIC) && it.lane === lane) type = 'jump';
      else if (it.kind === KIND.HIGH && it.lane === lane) type = 'slide';
      else if (it.kind === KIND.TALL && it.lane === lane) type = 'lane';
      else if (it.kind === KIND.GATE && it.good) type = 'gate';
      if (type && !this.hintsShown.has(type)) {
        this.hintsShown.add(type);
        // Slow motion only when the player must act; the gate hint is just advice
        this.activeHint = { type, item: it, slow: type !== 'gate' };
        this.ui.hint(type, this.touch);
        if (this.hintsShown.size >= 4) { this.save.tutorialDone = true; this.writeSave(); }
        return;
      }
    }
  }

  onTutorialAction(a) {
    const h = this.activeHint;
    if (!h) return;
    if ((h.type === 'jump' && a === 'up') || (h.type === 'slide' && a === 'down') ||
        (h.type === 'lane' && (a === 'left' || a === 'right'))) this.clearHint();
  }

  clearHint() {
    this.activeHint = null;
    this.ui.hint(null);
  }

  startVighna() {
    this.p.vighna = VIGHNA_TIME;
    this.stats.modaks = 0;
    this.stats.vighnas++;
    this.addScore(500);
    this.ui.vighna(true);
    this.audio.sfx('vighna');
    this.shake = 0.25;
    const cols = [new THREE.Color(1, 0.8, 0.2), new THREE.Color(1, 0.5, 0), new THREE.Color(1, 1, 0.7)];
    // Burst slightly ahead of Mushak and small, so it doesn't fly into the camera
    this.particles.sparks.burst(this.p.x, 1.2, -2.5, 60, { colors: cols, speed: 6, life: 0.9, gravity: -2, size: 0.7, drag: 1.5 });
  }

  // ---------- Act flow ----------
  async endAct() {
    const next = this.act + 1;
    this.clearHint();
    if (this.tutorial) { this.tutorial = false; this.save.tutorialDone = true; this.writeSave(); }
    if (this.mode === 'yatra' && next >= 3) { this.startFinale(); return; }

    if (this.mode === 'yatra') {
      // Story card + quiz between acts
      this.state = S.STORY;
      this.input.enabled = false;
      this.ui.hud(false);
      const story = STORIES[this.storyIndex++ % STORIES.length];
      const correct = await this.ui.story(story, 12, this.audio);
      this.stats.quizTotal++;
      if (correct) { this.stats.quiz++; this.addScore(500); }
      this.ui.show(null);
      this.ui.hud(true);
      if (this.state !== S.STORY) return; // player quit meanwhile
      this.state = S.PLAY;
      this.input.enabled = true;
      // Bappa's Blessing: each new act relights one diya
      const blessed = this.stats.lives < 3;
      if (blessed) this.stats.lives++;
      const sub = [correct ? '✔ Correct! +500' : '', blessed ? '🪔 Blessing: +1 diya' : ''].filter(Boolean).join(' · ');
      this.ui.banner(sub || ACTS[next].sub, ACTS[next].name, 2400);
    } else {
      this.ui.banner(`Stage ${next + 1}`, ACTS[next % 3].name, 1800);
    }

    this.act = next;
    this.actStart = this.distance;
    // In the Yatra the story card hides the switch, so change scenery instantly.
    this.world.setAct(next % 3, this.mode === 'yatra');
    this.items.nextSpawn = this.distance + 30;
    this.p.invuln = Math.max(this.p.invuln, 1);
    this.audio.setTempo(ACT_BPM[next % 3] + (this.mode === 'endless' ? Math.floor(next / 3) * 6 : 0), ACT_NOTE[next % 3]);
    this.audio.sfx('vighna');
  }

  startFinale() {
    this.state = S.FINALE;
    this.input.enabled = false;
    this.ui.hud(false);
    this.ui.vighna(false);
    this.p.vighna = 0;
    this.p.slide = 0;
    this.items.clear();
    this.finale.start(this.stats, this.speed);
    this.ui.banner('The Aarti Begins', 'Ganpati Bappa Morya!', 3500);
  }

  endRun(completed) {
    this.state = S.RESULTS;
    this.input.enabled = false;
    this.ui.hud(false);
    this.ui.vighna(false);
    const st = this.stats;
    const score = Math.floor(st.score);
    let newBest = false;
    let stars = 0;

    if (this.mode === 'endless') {
      newBest = score > this.save.endless;
      this.save.endless = Math.max(this.save.endless, score);
    } else {
      newBest = score > this.save.best;
      this.save.best = Math.max(this.save.best, score);
      if (completed) {
        // Thresholds tuned with the dev playtest bot (src/dev/bot.js):
        // good bot finishers score ~27-37k; humans also earn beat-combo multipliers.
        stars = 1 + (score >= 25000 ? 1 : 0) + (score >= 36000 ? 1 : 0);
        this.save.completed = true;
        this.save.stars = Math.max(this.save.stars, stars);
      }
    }
    this.writeSave();
    if (!completed) this.audio.stopMusic();

    const rows = [
      ['🛣️ Distance', `${Math.floor(this.distance)} m`],
      ['🟠 Modaks offered', st.modaksTotal],
      ['🌼 Puja offerings', st.puja],
      ['🌱 Eco gates', `${st.ecoGood}/${st.ecoTotal}`],
      ['✨ Rangolis lit', st.rangolis],
      ['🥁 Best beat combo', st.bestCombo],
      ['🪷 Vighnaharta modes', st.vighnas],
    ];
    if (this.mode === 'yatra') rows.push(['📜 Quiz answers', `${st.quiz}/${st.quizTotal}`]);

    const title = completed ? 'Ganpati Bappa Morya!'
      : this.mode === 'endless' ? `You reached ${ACTS[this.act % 3].name}` : 'Mushak needs a rest!';
    const kicker = completed ? 'Yatra Complete' : this.mode === 'endless' ? `Endless · Stage ${this.act + 1}` : `Stopped in ${ACTS[this.act % 3].name}`;
    const blessing = completed ? BLESSINGS[Math.floor(Math.random() * BLESSINGS.length)]
      : 'Vighnaharta is patient. Take a breath and try again!';

    setTimeout(() => {
      this.ui.results({
        kicker, title, score, newBest, stars, showStars: completed, rows, blessing,
        onStar: () => this.audio.sfx('correct'),
      });
    }, completed ? 0 : 900);
  }

  // ---------- Main update ----------
  update(dt) {
    const pt = this.particles;
    let dz = 0;

    // Tutorial slow motion: the whole simulation (world + Mushak) slows down together
    if (this.state === S.PLAY) {
      const target = this.activeHint?.slow ? 0.35 : 1;
      this.timeScale += (target - this.timeScale) * Math.min(1, dt * 8);
      dt *= this.timeScale;
    }
    // Beat pulse for the world's lights: 1 on the beat, fading between beats
    this.world.beat = this.audio.playing ? Math.exp(-this.audio.beatPhase() * 5) : 0;

    if (this.state === S.MENU || this.state === S.RESULTS && !this.finale.group.visible) {
      dz = (this.state === S.MENU ? 7 : 3) * dt;
      this.menuT += dt;
      this.updatePlayer(dt, 7);
      this.world.update(dt, dz);
      // Slow orbit around Mushak for the title screen
      // Mushak sits in the lower part of the frame, below the menu buttons.
      const portrait = this.camera.aspect < 0.8;
      const a = Math.sin(this.menuT * 0.25) * 0.7 + 0.4;
      const rad = portrait ? 4.2 : 4.6;
      this.camera.position.set(Math.sin(a) * rad, 1.3 + Math.sin(this.menuT * 0.3) * 0.2, Math.cos(a) * rad);
      this.camera.lookAt(0, portrait ? 3.4 : 2.2, -1);
    } else if (this.state === S.PLAY) {
      dz = this.updatePlay(dt);
    } else if (this.state === S.FINALE || (this.state === S.RESULTS && this.finale.group.visible)) {
      const res = this.finale.update(dt, this.camera, this.mushak);
      dz = res.dz;
      this.world.update(dt, dz);
      this.updatePlayer(dt, dz / Math.max(dt, 0.001));
      if (res.arrived) this.mushak.body.rotation.x = 0;
      if (this.finale.done && this.state === S.FINALE) this.endRun(true);
    } else {
      return; // paused / story: freeze the world
    }

    pt.sparks.update(dt, dz);
    pt.petals.update(dt, dz);
    pt.fireworks.update(dt, dz);
    this.r.renderer.toneMappingExposure = this.world.exposure || 1;
  }

  updatePlay(dt) {
    const p = this.p, st = this.stats;
    const actProg = (this.distance - this.actStart) / this.actLength();

    // Speed & difficulty
    if (this.mode === 'endless') this.speed = Math.min(32, 15 + this.distance / 160);
    else this.speed = ACT_SPEED[this.act] + actProg * 2.5;
    this.speedFactor += (1 - this.speedFactor) * Math.min(1, dt * 1.2);
    const boost = p.vighna > 0 ? 1.15 : 1;
    const v = this.speed * this.speedFactor * boost;
    const dz = v * dt;
    this.distance += dz;
    this.addScore(dz * 0.6 * this.mult);

    const diff = this.mode === 'endless' ? Math.min(1.3, this.distance / 4000) : Math.min(1, (this.act + actProg) / 3);
    const actEnd = this.actStart + this.actLength();
    this.items.spawnAhead(this.distance, diff, this.act % 3, {
      stopAt: actEnd - 25,
      allowDiya: st.lives < 3,
      speed: this.speed * (p.vighna > 0 ? 1.15 : 1),
    });

    // Timers
    if (p.vighna > 0) {
      p.vighna -= dt;
      if (Math.random() < dt * 25) {
        pt_emitAura(this.particles.sparks, p.x, p.y);
      }
      if (p.vighna <= 0) {
        this.ui.vighna(false);
        p.invuln = Math.max(p.invuln, 1); // grace period so an obstacle can't hit the instant it ends
      } else {
        this.ui.vighnaTimer(p.vighna / VIGHNA_TIME);
      }
    }
    p.invuln = Math.max(0, p.invuln - dt);

    // Combo fades if you stop moving on the beat
    if (st.combo > 0 && this.audio.now - this.lastBeatHit > this.audio.beatLen * 6) {
      st.combo = Math.max(0, st.combo - 4);
      this.lastBeatHit = this.audio.now;
    }
    this.audio.intensity = Math.min(1, st.combo / 16 + (p.vighna > 0 ? 0.5 : 0));

    this.updateTutorial();
    this.updatePlayer(dt, v);
    this.world.update(dt, dz);
    this.items.update(dt, dz, {
      x: p.x, y: p.y, sliding: p.slide > 0, invulnerable: p.invuln > 0 || p.vighna > 0,
      vighna: p.vighna > 0, magnet: p.vighna > 0,
    }, this.handlers);

    // Camera follows with a little lag and shake
    const portrait = this.camera.aspect < 0.8;
    const camTarget = new THREE.Vector3(p.x * 0.55, (portrait ? 4.2 : 3.4) + p.y * 0.35, portrait ? 7.4 : 6.2);
    this.camera.position.lerp(camTarget, Math.min(1, dt * 8));
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.6;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
    }
    this.camera.lookAt(p.x * 0.3, 1.1, -7);
    // FOV kick during Vighnaharta
    const baseFov = this.camera.aspect < 0.8 ? 78 : this.camera.aspect < 1.2 ? 68 : 58;
    const targetFov = baseFov + (p.vighna > 0 ? 8 : 0) + (this.speedFactor < 0.8 ? -3 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }

    // HUD
    const totalProg = this.mode === 'endless' ? Math.min(1, actProg) : (this.act + Math.min(1, actProg)) / 3;
    this.ui.updateHud({
      score: st.score, mult: this.mult, combo: st.combo, lives: st.lives, modaks: st.modaks, puja: st.puja, pujaMax: 40,
      progress: totalProg,
      actLabel: this.mode === 'endless' ? `Endless · Stage ${this.act + 1}` : `${ACTS[this.act].sub} · ${ACTS[this.act].name}`,
    });
    this.ui.beat(this.audio.beatPhase(), false);

    if (this.distance >= actEnd && this.state === S.PLAY) this.endAct();
    return dz;
  }

  updatePlayer(dt, speed) {
    const p = this.p;
    const targetX = (p.lane - 1) * LANE;
    const prevX = p.x;
    p.x += (targetX - p.x) * Math.min(1, dt * 14);
    p.leanX += ((p.x - prevX) / Math.max(dt, 0.001) * 0.05 - p.leanX) * Math.min(1, dt * 10);

    // Jump physics
    const wasAir = p.y > 0.01;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      if (wasAir && p.vy < -5) p.landSquash = 1;
      p.y = 0; p.vy = 0;
      if (p.bufferJump > 0 && this.state === S.PLAY) {
        p.bufferJump = 0; p.vy = JUMP_V; p.slide = 0; this.audio.sfx('jump');
      }
    }
    p.bufferJump = Math.max(0, p.bufferJump - dt);
    p.landSquash = Math.max(0, p.landSquash - dt * 6);
    p.slide = Math.max(0, p.slide - dt);
    p.tumble = Math.max(0, p.tumble - dt * 1.6);

    // Blink while invulnerable after a bump
    const blink = this.state === S.PLAY && p.invuln > 0 && p.vighna <= 0 && p.tumble <= 0 && Math.floor(p.invuln * 12) % 2 === 0;
    this.mushak.group.visible = !blink;

    this.mushak.group.position.set(p.x, p.y, 0);
    this.mushak.update(dt, {
      speed, jumpH: p.y, vy: p.vy, sliding: p.slide > 0 && p.y <= 0.01, tumble: p.tumble,
      vighna: p.vighna > 0, vighnaEnding: p.vighna > 0 && p.vighna < 1.2, leanX: p.leanX, landSquash: p.landSquash,
    });
  }
}

// Golden sparkles trailing Mushak during Vighnaharta Mode
function pt_emitAura(sparks, x, y) {
  sparks.emit(x + (Math.random() - 0.5) * 1.2, y + 0.3 + Math.random() * 1.2, 0.4, {
    // Short-lived and slow toward the camera, so sparkles never become big blobs over Mushak
    vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 2, vz: 0.6,
    color: new THREE.Color(1, 0.8 + Math.random() * 0.2, 0.3), life: 0.4, size: 0.45, gravity: 0,
  });
}
