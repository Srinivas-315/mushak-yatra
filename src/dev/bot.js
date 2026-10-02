// DEV-ONLY playtest bot. Never included in the production build.
// It plays a full Yatra like a human with a reaction delay and a chance to
// miss obstacles, then reports hits, score and Vighnaharta count so we can
// balance difficulty and check that every obstacle pattern is fair.
//
// Usage in the browser console (dev server only):
//   const bot = await __loadBot();
//   await bot.run({ missRate: 0.08, reaction: 0.35 });

export async function run({ missRate = 0.05, reaction = 0.25, mode = 'yatra', maxSeconds = 420 } = {}) {
  const g = window.__game;
  g.save.tutorialDone = true;
  g.startRun(mode);

  const seenAt = new Map();
  const ignored = new Set();
  const hits = [];
  const origHit = g.handlers.onHit;
  g.handlers.onHit = (it) => {
    hits.push({ act: g.act + 1, kind: it.kind, lane: it.lane, m: Math.round(g.distance), missed: ignored.has(it) });
    origHit(it);
  };

  let simT = 0;
  let frame = 0;
  const tallIn = (lane, zFrom, zTo) => g.items.active.some((it) => it.alive && it.lane === lane && it.kind === 'tall' && it.z > zFrom && it.z < zTo);

  const think = () => {
    const p = g.p;
    const v = Math.max(1, g.speed * g.speedFactor);
    const look = v * 1.1;
    for (const it of g.items.active) {
      if (it.z > -look && !seenAt.has(it)) {
        seenAt.set(it, simT);
        if (g.items.isObstacle(it) && Math.random() < missRate) ignored.add(it);
      }
    }
    const known = (it) => seenAt.has(it) && simT - seenAt.get(it) >= reaction && !ignored.has(it);

    let target = p.lane;
    const gate = g.items.active.find((it) => it.kind === 'gate' && it.good && it.alive && it.z < -1 && known(it));
    if (gate) target = gate.lane;

    const ahead = g.items.active
      .filter((it) => it.alive && g.items.isObstacle(it) && it.z < 0.9 && known(it))
      .sort((a, b) => b.z - a.z);
    const tall = ahead.find((it) => it.lane === target && it.kind === 'tall' && it.z > -look);
    if (tall) {
      const opts = [target - 1, target + 1]
        .filter((l) => l >= 0 && l <= 2 && !tallIn(l, tall.z - 4, 1))
        .sort((a, b) => Math.abs(a - p.lane) - Math.abs(b - p.lane));
      if (opts.length) target = opts[0];
    }
    if (target !== p.lane) { g.onAction(target < p.lane ? 'left' : 'right'); return; }

    const near = ahead.find((it) => it.lane === p.lane);
    if (!near) return;
    const t = -near.z / v;
    // Like a human, the bot may press jump just before landing (the game buffers it)
    if ((near.kind === 'low' || near.kind === 'plastic') && t < 0.3 && t > 0.05 && (p.y < 0.01 || (p.vy < 0 && p.bufferJump <= 0))) g.onAction('up');
    else if (near.kind === 'high' && t < 0.35 && p.slide <= 0.1) g.onAction('down');
  };

  while (g.state !== 'results' && simT < maxSeconds) {
    if (g.state === 'story') {
      await new Promise((r) => setTimeout(r, 150));
      document.querySelector('#quiz-opts button:not([disabled])')?.click();
      await new Promise((r) => setTimeout(r, 1300));
      continue;
    }
    if (g.state === 'play') think();
    g.update(1 / 60);
    simT += 1 / 60;
    frame++;
    if (frame % 900 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  g.handlers.onHit = origHit;

  const st = g.stats;
  const unfair = hits.filter((h) => !h.missed);
  return {
    finished: st.lives > 0, act: g.act + 1, m: Math.round(g.distance), score: Math.round(st.score),
    lives: st.lives, modaks: st.modaksTotal, vighnas: st.vighnas, hits: hits.length,
    unfairHits: unfair.length, unfairDetail: unfair.slice(0, 5), seconds: Math.round(simT),
  };
}

// Runs several skill profiles and prints a compact table.
export async function profile(runsEach = 3) {
  const profiles = [['good', 0.03, 0.25], ['average', 0.08, 0.35], ['casual', 0.15, 0.45]];
  const out = {};
  for (const [name, missRate, reaction] of profiles) {
    const runs = [];
    for (let i = 0; i < runsEach; i++) runs.push(await run({ missRate, reaction }));
    out[name] = {
      finished: `${runs.filter((r) => r.finished).length}/${runsEach}`,
      scores: runs.map((r) => r.score),
      vighnas: runs.map((r) => r.vighnas),
      hits: runs.map((r) => r.hits),
      unfairHits: runs.flatMap((r) => r.unfairDetail),
      reached: runs.map((r) => `act${r.act}@${r.m}m`),
    };
  }
  return out;
}
