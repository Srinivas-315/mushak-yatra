import { Renderer } from './core/renderer.js';
import { Input } from './core/input.js';
import { Audio } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Game } from './game/game.js';

// Entry point: builds everything behind a loading screen, then runs the
// main loop. The game logic itself lives in game/game.js.

// Waits one frame, but never longer than 60 ms, so loading still finishes
// if the page was opened in a background tab (browsers pause frames there).
const nextFrame = () => new Promise((r) => {
  let done = false;
  const finish = () => { if (!done) { done = true; r(); } };
  requestAnimationFrame(finish);
  setTimeout(finish, 60);
});

async function boot() {
  const ui = new UI();
  ui.setLoading(0.1, 'Lighting the diyas…');
  await nextFrame();

  const renderer = new Renderer(document.getElementById('stage'));
  ui.setLoading(0.3, 'Decorating the pandal…');
  await nextFrame();

  // Wait for the web fonts so canvas-painted signs use them (max 1.5 s)
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);

  const audio = new Audio();
  const input = new Input(window);
  ui.setLoading(0.55, 'Making 21 modaks…');
  await nextFrame();

  const game = new Game(renderer, ui, audio, input);
  renderer.onTierChange = (_, tier) => game.setDensity(tier.particles);
  game.setDensity(renderer.tier.particles);
  ui.setLoading(0.85, 'Tuning the dhol…');

  // Warm up: render a few frames so shaders compile before the title shows
  for (let i = 0; i < 3; i++) { game.update(1 / 60); renderer.render(); await nextFrame(); }
  ui.setLoading(1, 'Ganpati Bappa Morya!');

  // ---------- Buttons ----------
  const soundBtn = document.getElementById('btn-sound');
  const qualityBtn = document.getElementById('btn-quality');
  const label = (m) => m[0].toUpperCase() + m.slice(1);
  // Sound cycles full -> low -> off, so players can turn it down, not just off
  const LEVELS = [{ v: 1, text: '🔊 Sound On' }, { v: 0.45, text: '🔉 Sound Low' }, { v: 0, text: '🔇 Sound Off' }];
  const refreshSettings = () => {
    const level = LEVELS.find((l) => l.v === audio.volume) || LEVELS[0];
    soundBtn.textContent = level.text;
    qualityBtn.textContent = `✨ Quality: ${label(renderer.mode)}`;
  };
  refreshSettings();

  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    const i = LEVELS.findIndex((l) => l.v === audio.volume);
    audio.setVolume(LEVELS[(i + 1) % LEVELS.length].v);
    audio.sfx('ui');
    refreshSettings();
  });
  qualityBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    renderer.cycleMode();
    audio.sfx('ui');
    refreshSettings();
  });
  document.getElementById('btn-pause').addEventListener('click', (e) => { e.stopPropagation(); game.pause(); });

  ui.bindActions((action) => {
    audio.unlock();
    audio.sfx('ui');
    switch (action) {
      case 'play': game.startRun('yatra'); break;
      case 'endless':
        if (game.save.completed) game.startRun('endless');
        else ui.banner('Locked', 'Finish the Yatra first!', 1600);
        break;
      case 'howto': ui.show('howto'); break;
      case 'back': ui.show('title'); break;
      case 'resume': game.resume(); break;
      case 'restart': game.audio.ctx?.resume(); game.startRun(game.mode); break;
      case 'menu': game.toMenu(); break;
      default: break;
    }
  });

  // Enter starts the Yatra from the title and restarts from the results
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
    const active = (id) => document.getElementById(id).classList.contains('active');
    if (active('title')) { audio.unlock(); game.startRun('yatra'); }
    else if (active('results')) { audio.unlock(); game.startRun(game.mode); }
  });

  ui.setBest(game.save);
  setTimeout(() => ui.show('title'), 350);

  // ---------- Main loop ----------
  let last = performance.now();
  const loop = (now) => {
    // Schedule the next frame first so one unexpected error can never freeze the game.
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      game.update(dt);
      renderer.render();
      renderer.trackFps(dt);
    } catch (err) {
      console.error(err);
    }
  };
  requestAnimationFrame(loop);

  // Handy for debugging in the browser console
  window.__game = game;
  // Dev-only playtest bot (removed from the production build by Vite)
  if (import.meta.env.DEV) window.__loadBot = () => import('./dev/bot.js');
}

boot().catch((err) => {
  console.error(err);
  const t = document.getElementById('load-text');
  if (t) t.textContent = 'Could not start the game. Please try a different browser. (' + err.message + ')';
});
