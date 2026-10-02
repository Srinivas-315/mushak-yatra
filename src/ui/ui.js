// All the HTML overlay screens: menus, HUD, banners, story quiz, results.
// The 3D canvas sits underneath; these are plain DOM elements on top.

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.screens = ['loading', 'title', 'howto', 'story', 'pause', 'results', 'leaderboard', 'install'];
    this.el = {
      score: $('hud-score'), combo: $('hud-combo'), act: $('hud-act'), progress: $('hud-progress'),
      lives: $('hud-lives'), modak: $('hud-modak'), modakBar: $('hud-modak-bar'), puja: $('hud-puja'),
      pujaBar: $('hud-puja-bar'), beat: $('hud-beat'), vighna: $('hud-vighna'), floaters: $('floaters'),
      banner: $('banner'), bannerSub: $('banner-sub'), bannerMain: $('banner-main'), hud: $('hud'),
    };
    this.last = {};
  }

  bindActions(handler) {
    document.querySelectorAll('[data-action]').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); handler(b.dataset.action); });
    });
    // Stop menu taps from also counting as game swipes
    document.querySelectorAll('.screen').forEach((s) => {
      ['touchstart', 'mousedown'].forEach((ev) => s.addEventListener(ev, (e) => { if (s.classList.contains('active')) e.stopPropagation(); }));
    });
  }

  show(name) {
    for (const s of this.screens) $(s).classList.toggle('active', s === name);
  }

  hud(on) { this.el.hud.classList.toggle('active', on); }

  setLoading(p, text) {
    $('load-bar').style.width = `${Math.round(p * 100)}%`;
    if (text) $('load-text').textContent = text;
  }

  setBest(save) {
    $('best-score').textContent = save.best.toLocaleString();
    $('best-stars').textContent = save.stars;
    $('best-endless').textContent = save.endless.toLocaleString();
    const btn = $('btn-endless');
    btn.classList.toggle('locked', !save.completed);
    $('endless-lock').textContent = save.completed ? 'unlocked · how far can you go?' : '🔒 finish the Yatra';
  }

  // Only touches the DOM when a value actually changes (keeps mobile smooth).
  set(key, value, fn) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    fn(value);
  }

  updateHud(s) {
    this.set('score', Math.floor(s.score), (v) => { this.el.score.textContent = v.toLocaleString(); });
    this.set('combo', `${s.mult}|${s.combo}`, () => {
      this.el.combo.textContent = s.combo >= 2 ? `x${s.mult} · 🥁${s.combo}` : `x${s.mult}`;
    });
    this.set('mult', s.mult, () => {
      this.el.combo.classList.remove('bump'); void this.el.combo.offsetWidth; this.el.combo.classList.add('bump');
      setTimeout(() => this.el.combo.classList.remove('bump'), 150);
    });
    this.set('act', s.actLabel, (v) => { this.el.act.textContent = v; });
    this.set('progress', Math.round(s.progress * 200), (v) => { this.el.progress.style.width = `${v / 2}%`; });
    this.set('lives', s.lives, (v) => {
      this.el.lives.innerHTML = [0, 1, 2].map((i) => `<span class="${i < v ? '' : 'out'}">🪔</span>`).join('');
    });
    this.set('modak', s.modaks, (v) => {
      this.el.modak.textContent = v;
      this.el.modakBar.style.width = `${(v / 21) * 100}%`;
    });
    this.set('puja', s.puja, (v) => {
      this.el.puja.textContent = v;
      this.el.pujaBar.style.width = `${Math.min(100, (v / s.pujaMax) * 100)}%`;
    });
  }

  // phase 0..1 within the current beat; the outer ring shrinks onto the core.
  beat(phase, flash) {
    const k = 1 - phase;
    this.el.beat.style.setProperty('--beat-scale', (1 + phase * 0.9).toFixed(3));
    this.el.beat.style.setProperty('--beat-op', (k * k).toFixed(3));
    this.el.beat.classList.toggle('flash', phase < 0.12);
    if (flash) {
      this.el.beat.classList.add('hit');
      clearTimeout(this.beatTimer);
      this.beatTimer = setTimeout(() => this.el.beat.classList.remove('hit'), 180);
    }
  }

  vighna(on) {
    this.el.vighna.classList.toggle('on', on);
    $('vighna-glow').classList.toggle('on', on);
    if (!on) $('vighna-glow').classList.remove('ending');
    if (on) this.vighnaTimer(1);
  }

  // k: 1 = just started, 0 = over. Blinks during the last ~quarter.
  vighnaTimer(k) {
    $('vighna-bar').style.width = `${Math.max(0, k) * 100}%`;
    $('vighna-glow').classList.toggle('ending', k < 0.24);
  }

  // Tutorial hint shown the first time each obstacle type appears.
  hint(type, touch) {
    const el = $('hint');
    if (!type) { el.classList.remove('show'); return; }
    const HINTS = {
      jump: ['⬆️', touch ? 'Swipe UP to jump!' : 'Press ↑ or SPACE to jump!'],
      slide: ['⬇️', touch ? 'Swipe DOWN to slide!' : 'Press ↓ or S to slide!'],
      lane: ['⬅️ ➡️', touch ? 'Swipe LEFT or RIGHT!' : 'Press ← or → to change lane!'],
      gate: ['🌱', 'Run through the green CLAY gate!'],
    };
    const [icon, text] = HINTS[type];
    $('hint-icon').textContent = icon;
    $('hint-text').textContent = text;
    el.classList.add('show');
  }

  flash() {
    const f = $('hit-flash');
    f.classList.remove('on');
    void f.offsetWidth; // restart the CSS animation
    f.classList.add('on');
  }

  floater(text, x, y, cls = '') {
    const d = document.createElement('div');
    d.className = `floater ${cls}`;
    d.textContent = text;
    d.style.left = `${x}px`; d.style.top = `${y}px`;
    this.el.floaters.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  banner(sub, main, ms = 1800) {
    this.el.bannerSub.textContent = sub;
    this.el.bannerMain.textContent = main;
    this.el.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.el.banner.classList.remove('show'), ms);
  }

  // Shows a story card with a timed quiz. Resolves true/false.
  story(st, seconds, audio) {
    return new Promise((resolve) => {
      $('story-title').textContent = st.title;
      $('story-text').textContent = st.text;
      $('quiz-q').textContent = st.q;
      const opts = $('quiz-opts');
      opts.innerHTML = '';
      const bar = $('quiz-timer');
      let done = false;
      const finish = (idx) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        const correct = idx === st.answer;
        [...opts.children].forEach((b, i) => {
          if (i === st.answer) b.classList.add('correct');
          else if (i === idx) b.classList.add('wrong');
          b.disabled = true;
        });
        audio?.sfx(correct ? 'correct' : 'wrong');
        setTimeout(() => resolve(correct), 1100);
      };
      st.options.forEach((o, i) => {
        const b = document.createElement('button');
        b.textContent = o;
        b.addEventListener('click', (e) => { e.stopPropagation(); finish(i); });
        opts.appendChild(b);
      });
      const start = performance.now();
      let raf;
      const tick = () => {
        const k = 1 - (performance.now() - start) / (seconds * 1000);
        bar.style.width = `${Math.max(0, k) * 100}%`;
        if (k <= 0) finish(-1);
        else raf = requestAnimationFrame(tick);
      };
      tick();
      this.show('story');
    });
  }

  results(r) {
    $('res-kicker').textContent = r.kicker;
    $('res-title').textContent = r.title;
    $('res-score').textContent = '0';
    $('res-new').classList.toggle('show', r.newBest);
    $('res-blessing').textContent = r.blessing;
    $('res-breakdown').innerHTML = r.rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
    const stars = [...$('res-stars').children];
    stars.forEach((s) => s.classList.remove('lit', 'pop'));
    $('res-stars').style.display = r.showStars ? '' : 'none';
    this.show('results');

    // Count-up score and pop the stars one by one
    const start = performance.now();
    const dur = 1200;
    const count = () => {
      const k = Math.min(1, (performance.now() - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      $('res-score').textContent = Math.floor(r.score * e).toLocaleString();
      if (k < 1) requestAnimationFrame(count);
    };
    count();
    stars.forEach((s, i) => setTimeout(() => {
      s.classList.add('pop');
      if (i < r.stars) { s.classList.add('lit'); r.onStar?.(i); }
    }, 500 + i * 350));
  }

  // Project a 3D point to screen pixels for floating score text.
  project(vec3, camera) {
    const v = vec3.clone().project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }
}
