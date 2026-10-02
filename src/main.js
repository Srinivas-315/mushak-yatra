import { Renderer } from './core/renderer.js';
import { Input } from './core/input.js';
import { Audio } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Game } from './game/game.js';
import * as lb from './net/leaderboard.js';

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

  // ---------- Online leaderboard (nickname only, no accounts) ----------
  const lbList = document.getElementById('lb-list');
  const lbNote = document.getElementById('lb-note');
  let lbMode = 'yatra';

  const renderRows = (rows, me) => {
    if (!rows.length) {
      lbList.innerHTML = '<div class="lb-empty">No scores yet — be the first!</div>';
      return;
    }
    lbList.innerHTML = rows.map((r, i) => {
      const mine = me && r.player_id === me.id ? ' mine' : '';
      const rank = ['🥇', '🥈', '🥉'][i] || `${i + 1}`;
      return `<div class="lb-row${mine}"><span class="lb-rank">${rank}</span>` +
        `<span class="lb-name"></span><span class="lb-stars">${'★'.repeat(r.stars || 0)}</span>` +
        `<span class="lb-score">${Number(r.score).toLocaleString()}</span></div>`;
    }).join('');
    // Nicknames are set as text, never as HTML
    [...lbList.querySelectorAll('.lb-name')].forEach((el, i) => { el.textContent = rows[i].nickname; });
  };

  const openLeaderboard = async (mode) => {
    lbMode = mode;
    document.querySelectorAll('.lb-tab').forEach((t) => t.classList.toggle('active', t.dataset.lbMode === mode));
    ui.show('leaderboard');
    const codeBox = document.getElementById('lb-code');
    if (!lb.enabled()) {
      codeBox.hidden = true;
      lbList.innerHTML = '';
      lbNote.textContent = `The online leaderboard isn't switched on yet. Your best scores are saved on this device — Yatra ${game.save.best.toLocaleString()} · Endless ${game.save.endless.toLocaleString()}.`;
      return;
    }
    const me = lb.getPlayer();
    codeBox.hidden = false;
    document.getElementById('lb-code-value').textContent = me.id;
    lbNote.textContent = '';
    lbList.innerHTML = '<div class="lb-empty">Loading…</div>';
    try {
      renderRows(await lb.top(mode, 20), me);
    } catch {
      lbList.innerHTML = '';
      lbNote.textContent = 'Could not load the leaderboard. Check your internet and try again.';
    }
  };

  document.querySelectorAll('.lb-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => { e.stopPropagation(); audio.sfx('ui'); openLeaderboard(tab.dataset.lbMode); });
  });
  document.getElementById('lb-restore-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const input = document.getElementById('lb-restore-input');
    if (lb.restorePlayer(input.value)) {
      input.value = '';
      openLeaderboard(lbMode);
      lbNote.textContent = 'Restored — this device now owns that player again.';
    } else {
      lbNote.textContent = 'That code looks wrong. It is 24 letters and numbers.';
    }
  });

  // Results screen: offer to send the run
  const submitRow = document.getElementById('submit-row');
  const nickInput = document.getElementById('nickname');
  const submitBtn = document.getElementById('btn-submit');
  const submitMsg = document.getElementById('submit-msg');
  let lastRun = null;

  game.onResults = (run) => {
    lastRun = run;
    submitRow.hidden = !lb.enabled();
    if (submitRow.hidden) return;
    submitBtn.disabled = false;
    submitBtn.textContent = '🏆 Submit score';
    submitMsg.textContent = '';
    nickInput.value = lb.getPlayer().nickname;
  };

  const doSubmit = async () => {
    if (!lastRun) return;
    const name = lb.setNickname(nickInput.value);
    if (!name) { submitMsg.textContent = 'Type a nickname first.'; return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      await lb.submit(lastRun);
      const rank = await lb.rankOf(lastRun.mode, lastRun.score);
      submitBtn.textContent = '✔ Submitted';
      submitMsg.textContent = rank
        ? `You are #${rank} on the ${lastRun.mode === 'endless' ? 'Endless' : 'Yatra'} board!`
        : 'Score sent!';
      audio.sfx('correct');
    } catch {
      submitBtn.disabled = false;
      submitBtn.textContent = '🏆 Submit score';
      submitMsg.textContent = 'Could not send it. Check your internet.';
    }
  };
  submitBtn.addEventListener('click', (e) => { e.stopPropagation(); doSubmit(); });
  nickInput.addEventListener('keydown', (e) => { if (e.code === 'Enter') { e.stopPropagation(); doSubmit(); } });

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
      case 'leaderboard': openLeaderboard('yatra'); break;
      case 'install-later': ui.show('title'); break;
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
    // Don't restart the game while someone is typing their nickname
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    const active = (id) => document.getElementById(id).classList.contains('active');
    if (active('title')) { audio.unlock(); game.startRun('yatra'); }
    else if (active('results')) { audio.unlock(); game.startRun(game.mode); }
  });

  ui.setBest(game.save);
  // On a player's very first visit, show how to install the game on THEIR
  // device before they start. Shown once; the Install button is always there.
  let seenInstall = true;
  try { seenInstall = localStorage.getItem('my-install-seen') === '1'; } catch { /* private mode */ }
  setTimeout(() => {
    ui.show('title');
    if (!seenInstall && !installed()) {
      try { localStorage.setItem('my-install-seen', '1'); } catch { /* private mode */ }
      setTimeout(openInstall, 1200);
    }
  }, 350);

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

  // ---------- Installable app (PWA) ----------
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
  }
  // Every device installs differently, so detect it and show the right steps.
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium/.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  // Browsers inside other apps (WhatsApp, Instagram, Facebook) cannot install
  const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat/.test(ua);
  const installed = () => window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;

  let installPrompt = null;
  const installBtn = document.getElementById('btn-install');
  const installNow = document.getElementById('install-now');

  const installGuide = () => {
    if (installed()) {
      return { title: '✅ Already installed', lead: 'You are playing the installed app. Enjoy!', list: [], note: '' };
    }
    if (inAppBrowser) {
      return {
        title: '📲 Open in your browser first',
        lead: 'You opened the game inside another app (like WhatsApp or Instagram), and those cannot install it.',
        list: [
          'Tap the <b>⋮</b> or <b>···</b> button in the corner.',
          'Choose <b>Open in browser</b> (Chrome on Android, Safari on iPhone).',
          'Then open this Install screen again.',
        ],
        note: 'The link also works fine here — installing is optional.',
      };
    }
    if (isIOS) {
      if (!isSafari) {
        return {
          title: '📲 Install on iPhone / iPad',
          lead: 'On iPhone only <b>Safari</b> can add a game to the home screen.',
          list: [
            'Copy this page link.',
            'Open <b>Safari</b> and paste the link.',
            'Tap <b>Share</b> (the box with an arrow ⬆️), then <b>Add to Home Screen</b>.',
          ],
          note: 'After that the game opens fullscreen, just like a normal app.',
        };
      }
      return {
        title: '📲 Install on iPhone / iPad',
        lead: 'Add Mushak Yatra to your home screen in 3 taps:',
        list: [
          'Tap the <b>Share</b> button ⬆️ at the bottom of Safari.',
          'Scroll down and tap <b>Add to Home Screen</b>.',
          'Tap <b>Add</b> in the top-right corner.',
        ],
        note: 'The icon appears with your other apps, and the game works without internet.',
      };
    }
    if (isAndroid) {
      return {
        title: '📲 Install on Android',
        lead: installPrompt
          ? 'Tap the button below and confirm <b>Install</b>.'
          : 'Add Mushak Yatra to your home screen:',
        list: installPrompt ? [] : [
          `Tap the <b>${isFirefox ? '⋮ menu' : '⋮ menu'}</b> in the top-right of your browser.`,
          'Choose <b>Install app</b> (or <b>Add to Home screen</b>).',
          'Confirm with <b>Install</b>.',
        ],
        note: 'It then opens fullscreen like a normal app and works offline.',
      };
    }
    return {
      title: '📲 Install on your computer',
      lead: installPrompt
        ? 'Click the button below and confirm <b>Install</b>.'
        : 'Install the game as a desktop app:',
      list: installPrompt ? [] : [
        'Look for the <b>install icon</b> (a screen with an arrow) at the right of the address bar.',
        'Or open the browser <b>⋮ menu → Install Mushak Yatra</b>.',
        'Confirm with <b>Install</b>.',
      ],
      note: 'Chrome and Edge support this. In Firefox or Safari on a computer, just bookmark the page.',
    };
  };

  const openInstall = () => {
    const g = installGuide();
    document.getElementById('install-title').textContent = g.title;
    document.getElementById('install-lead').innerHTML = g.lead;
    document.getElementById('install-steps').innerHTML = g.list.map((s) => `<li>${s}</li>`).join('');
    document.getElementById('install-note').textContent = g.note;
    installNow.hidden = !installPrompt;
    ui.show('install');
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    installNow.hidden = false;
    // If the install screen is already open, redraw it now that one-tap install exists
    if (document.getElementById('install').classList.contains('active')) openInstall();
  });
  installNow.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    installNow.hidden = true;
    if (outcome === 'accepted') ui.show('title');
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installBtn.hidden = true;
    ui.show('title');
  });
  installBtn.addEventListener('click', (e) => { e.stopPropagation(); audio.sfx('ui'); openInstall(); });
  if (installed()) installBtn.hidden = true;

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
