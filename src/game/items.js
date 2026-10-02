import * as THREE from 'three';
import { LANE } from '../world/world.js';
import { glowTexture, rangoliTexture, signTexture, buntingTexture } from '../world/textures.js';

// Collectibles, obstacles and eco gates. Each kind has a template mesh that
// is cloned when spawned (geometry and materials are shared, so clones are
// cheap). A pattern-based spawner always leaves a free path for the player.

export const KIND = {
  MODAK: 'modak', DURVA: 'durva', FLOWER: 'flower', DIYA: 'diya', RANGOLI: 'rangoli',
  LOW: 'low', HIGH: 'high', TALL: 'tall', PLASTIC: 'plastic', GATE: 'gate',
};

function modakGeometry() {
  // Lathe profile of a modak: round base rising to a pinched tip.
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const y = t * 0.62;
    const r = t < 0.45 ? Math.sin((t / 0.45) * Math.PI * 0.5) * 0.3 : 0.3 * Math.pow(1 - (t - 0.45) / 0.55, 1.4);
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 32);
  // Pleats: push vertices in and out around the circumference
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ang = Math.atan2(v.z, v.x);
    const k = 1 + Math.sin(ang * 10) * 0.07 * Math.min(1, v.y * 3);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  geo.translate(0, -0.3, 0);
  return geo;
}

export class Items {
  constructor(scene, particles, audio) {
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;
    this.active = [];
    this.pools = {};
    this.nextSpawn = 30;
    this.gateCooldown = 0;
    this.buildTemplates();
  }

  buildTemplates() {
    const T = this.templates = {};
    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 });

    // Modak
    {
      const g = new THREE.Group();
      const m = new THREE.Mesh(modakGeometry(), new THREE.MeshPhysicalMaterial({
        color: 0xffd89a, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.4, emissive: 0x6a3500, emissiveIntensity: 0.6, sheen: 0.5,
      }));
      m.castShadow = true;
      m.scale.setScalar(1.25);
      g.add(m);
      const glow = new THREE.Sprite(glowMat); glow.scale.set(0.95, 0.95, 1); g.add(glow);
      
      T.modak = g;
    }
    // Durva grass bundle
    {
      const g = new THREE.Group();
      const blade = new THREE.ConeGeometry(0.035, 0.7, 4);
      const mat = std(0x4ccf4c, { emissive: 0x0b3a0b });
      for (let i = 0; i < 9; i++) {
        const b = new THREE.Mesh(blade, mat);
        b.position.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
        b.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
        g.add(b);
      }
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), std(0xe8262b));
      tie.rotation.x = Math.PI / 2; tie.position.y = -0.15; g.add(tie);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(220,255,200,1)', 'rgba(80,255,120,0.5)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(1.3, 1.3, 1); g.add(glow);
      
      T.durva = g;
    }
    // Hibiscus / marigold flower
    {
      const g = new THREE.Group();
      const petalGeo = new THREE.SphereGeometry(0.16, 10, 8);
      const red = std(0xff2a3a, { emissive: 0x440000 });
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(petalGeo, red);
        const a = (i / 5) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
        p.scale.set(1.2, 0.35, 0.8); p.rotation.y = -a;
        g.add(p);
      }
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(0xffd000, { emissive: 0x553300 }));
      g.add(c);
      g.rotation.x = -0.9;
      const holder = new THREE.Group(); holder.add(g);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,220,220,1)', 'rgba(255,60,80,0.5)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(1.3, 1.3, 1); holder.add(glow);
      
      T.flower = holder;
    }
    // Diya (restores a life)
    {
      const g = new THREE.Group();
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(0xb5562a, { roughness: 0.9 }));
      bowl.scale.set(1, 0.6, 1.3); bowl.rotation.x = Math.PI; bowl.position.y = 0.05;
      g.add(bowl);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      flame.position.set(0, 0.22, -0.15); g.add(flame);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.8, 1.8, 1); glow.position.set(0, 0.25, -0.15); g.add(glow);
      
      T.diya = g;
    }
    // Rangoli floor tiles (Act 2), lights up when you run over it
    T.rangoli = [0, 1, 2].map((seed) => {
      const t = rangoliTexture(seed + 1);
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshStandardMaterial({
        map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.15, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.02;
      const g = new THREE.Group(); g.add(m); 
      return g;
    });

    // LOW obstacle: stacked coconut crates with marigolds (jump over)
    {
      const g = new THREE.Group();
      const wood = std(0x9a6232, { roughness: 0.85 });
      const crate = new THREE.BoxGeometry(1.6, 0.55, 0.9);
      const c1 = new THREE.Mesh(crate, wood); c1.position.y = 0.28; c1.castShadow = true; g.add(c1);
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.95), std(0x6a3a1a));
      slat.position.y = 0.3; g.add(slat);
      const coco = new THREE.SphereGeometry(0.17, 10, 8);
      const cocoMat = std(0x5a3a1e, { roughness: 1 });
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Mesh(coco, cocoMat);
        c.position.set(-0.6 + i * 0.3, 0.68, (i % 2) * 0.15 - 0.07); c.castShadow = true; g.add(c);
      }
      const mg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), std(0xff9a00, { emissive: 0x552200 }));
      for (const x of [-0.75, 0.75]) { const f = mg.clone(); f.position.set(x, 0.62, 0.35); g.add(f); }
      T.low = g;
    }
    // HIGH obstacle: festive toran bar (slide under)
    {
      const g = new THREE.Group();
      const poleMat = std(0xc81e1e, { roughness: 0.5 });
      for (const x of [-0.95, 0.95]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), poleMat);
        p.position.set(x, 1.1, 0); p.castShadow = true; g.add(p);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 0.2), std(0xffc24a, { metalness: 0.7, roughness: 0.35, emissive: 0x331800 }));
      bar.position.y = 1.55; bar.castShadow = true; g.add(bar);
      const bt = buntingTexture(); bt.repeat.set(0.5, 1);
      const flags = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.45), new THREE.MeshStandardMaterial({ map: bt, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
      flags.position.set(0, 1.1, 0.12); g.add(flags);
      const bells = new THREE.SphereGeometry(0.07, 8, 6);
      const gold = std(0xffd24a, { metalness: 0.9, roughness: 0.2 });
      for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(bells, gold); b.position.set(-0.8 + i * 0.4, 1.25, 0.1); g.add(b); }
      
      T.high = g;
    }
    // TALL obstacles: vendor cart & big dhol drum (change lanes)
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 1.6), std(0x1b75bb, { roughness: 0.5 }));
      body.position.y = 0.95; body.castShadow = true; g.add(body);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 1.65), std(0xffd000)); trim.position.y = 1.4; g.add(trim);
      const wheelGeo = new THREE.TorusGeometry(0.35, 0.07, 8, 18);
      const wheelMat = std(0x2a1a10);
      for (const x of [-0.9, 0.9]) { const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(x, 0.4, 0); w.rotation.y = Math.PI / 2; g.add(w); }
      const umb = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.6, 12), std(0xe8262b, { side: THREE.DoubleSide }));
      umb.position.y = 2.7; umb.castShadow = true; g.add(umb);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), std(0x333333)); pole.position.y = 2.05; g.add(pole);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshStandardMaterial({ map: signTexture('MODAK', '#ffd000', '#b3261e') }));
      sign.position.set(0, 0.95, 0.81); g.add(sign);
      // Pile of modaks on top
      const mg = modakGeometry();
      const mm = std(0xffe0a8, { emissive: 0x442200 });
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(mg, mm); m.scale.setScalar(0.5); m.position.set(-0.5 + (i % 3) * 0.5, 1.62, i < 3 ? -0.3 : 0.3); g.add(m); }
      T.cart = g;
    }
    {
      const g = new THREE.Group();
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.5, 24), std(0xb3261e, { roughness: 0.4 }));
      drum.rotation.z = Math.PI / 2; drum.position.y = 1.3; drum.castShadow = true; g.add(drum);
      const skinMat = std(0xf1e0c0, { roughness: 0.9 });
      for (const x of [-0.77, 0.77]) {
        const sk = new THREE.Mesh(new THREE.CircleGeometry(0.84, 24), skinMat);
        sk.position.set(x, 1.3, 0); sk.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(sk);
      }
      const ropeMat = std(0xffd000);
      for (let i = 0; i < 8; i++) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.04), ropeMat);
        const a = (i / 8) * Math.PI * 2;
        r.position.set(0, 1.3 + Math.sin(a) * 0.86, Math.cos(a) * 0.86); g.add(r);
      }
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.0), std(0x5a3a22)); stand.position.y = 0.25; g.add(stand);
      
      T.dhol = g;
    }
    // PLASTIC waste (eco hazard, jump over)
    {
      const g = new THREE.Group();
      const bagMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe6ee, roughness: 0.3, transmission: 0.2, transparent: true, opacity: 0.9 });
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), bagMat);
        b.position.set(-0.45 + i * 0.45, 0.3, (i % 2) * 0.2); b.scale.set(1, 0.9 + i * 0.1, 1); b.castShadow = true;
        g.add(b);
      }
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.45, 8), new THREE.MeshPhysicalMaterial({ color: 0x66ccff, transmission: 0.5, roughness: 0.1, transparent: true, opacity: 0.8 }));
      bottle.rotation.z = Math.PI / 2; bottle.position.set(0.2, 0.1, 0.4); g.add(bottle);
      const warn = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,120,120,1)', 'rgba(255,0,0,0.3)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
      warn.scale.set(2, 1, 1); warn.position.y = 0.3; g.add(warn);
      T.plastic = g;
    }
    // Eco gate arches
    T.gate = (good, width) => {
      const g = new THREE.Group();
      const col = good ? 0x3ddc84 : 0x8a8f98;
      const mat = std(col, { emissive: good ? 0x0a5a2a : 0x111111, roughness: 0.5 });
      const w = width * LANE;
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), mat); p.position.set(x, 1.6, 0); g.add(p);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.2), new THREE.MeshStandardMaterial({
        map: signTexture(good ? '🌱 CLAY MURTI' : '✖ PLASTIC', good ? '#1b7a44' : '#4a4f58', good ? '#eaffd0' : '#ff9090'),
        emissive: 0xffffff, emissiveIntensity: good ? 0.35 : 0.1,
      }));
      top.position.y = 3.3; g.add(top);
      if (good) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), std(0x2fbf55, { emissive: 0x0a3a1a }));
        for (let i = 0; i < 10; i++) {
          const l = leaf.clone(); const k = i / 9;
          l.position.set(-w / 2 + 0.1, 0.4 + k * 2.6, 0.15); g.add(l);
          const r = leaf.clone(); r.position.set(w / 2 - 0.1, 0.4 + k * 2.6, 0.15); g.add(r);
        }
      }
      return g;
    };
  }

  // ---------- Spawning ----------
  add(kind, lane, z, extra = {}) {
    let obj;
    const T = this.templates;
    switch (kind) {
      case KIND.MODAK: obj = T.modak.clone(); obj.userData.spin = obj.children[0]; break;
      case KIND.DURVA: obj = T.durva.clone(); obj.userData.spin = obj; break;
      case KIND.FLOWER: obj = T.flower.clone(); obj.userData.spin = obj.children[0]; break;
      case KIND.DIYA: obj = T.diya.clone(); obj.userData.flame = obj.children[1]; break;
      case KIND.RANGOLI: obj = T.rangoli[Math.floor(Math.random() * 3)].clone(); obj.children[0].material = obj.children[0].material.clone(); obj.userData.tile = obj.children[0]; break;
      case KIND.LOW: obj = T.low.clone(); break;
      case KIND.HIGH: obj = T.high.clone(); obj.userData.swing = obj.children[3]; break;
      case KIND.TALL: obj = (Math.random() < 0.5 ? T.cart : T.dhol).clone(); break;
      case KIND.PLASTIC: obj = T.plastic.clone(); break;
      case KIND.GATE: obj = T.gate(extra.good, extra.width); break;
      default: return null;
    }
    const x = (lane - 1) * LANE + (extra.offsetX || 0);
    const baseY = extra.y ?? (kind === KIND.MODAK || kind === KIND.DURVA || kind === KIND.FLOWER ? 0.75 : 0);
    obj.position.set(x, baseY, z);
    this.scene.add(obj);
    const item = { kind, lane, obj, baseY, z, alive: true, t: Math.random() * 6, ...extra };
    this.active.push(item);
    return item;
  }

  // Lays out the next stretch of road ahead of the player.
  // "difficulty" goes from 0 (start of act 1) to about 1 (end of act 3).
  // "distance" is how far the player has travelled. Rows are placed at
  // their true future position, up to 95 units ahead.
  spawnAhead(distance, difficulty, act, opts = {}) {
    // Rows must be at least one full jump apart (air time ~0.66 s plus a
    // reaction margin) at the current speed, or back-to-back jumps would be impossible.
    const minGap = (opts.speed || 15) * 0.85;
    const gap = Math.max(15 - difficulty * 5, minGap);
    while (this.nextSpawn < distance + 95) {
      if (opts.stopAt !== undefined && this.nextSpawn > opts.stopAt) return;
      const z = -(this.nextSpawn - distance);
      this.pattern(z, difficulty, act, opts);
      this.nextSpawn += gap + Math.random() * 6;
    }
  }

  pattern(z, diff, act, opts) {
    const r = Math.random();
    this.gateCooldown--;

    if (opts.noObstacles) {
      // Menu / finale: only a gentle modak trail
      if (r < 0.6) this.modakLine(Math.floor(Math.random() * 3), z, 4);
      return;
    }

    // Tutorial: the very first rows teach one obstacle type at a time,
    // placed in the middle lane where Mushak starts.
    if (this.tutorialQueue?.length) {
      const kind = this.tutorialQueue.shift();
      this.add(kind, 1, z);
      if (kind === KIND.LOW) {
        for (let k = -1; k <= 1; k++) this.add(KIND.MODAK, 1, z + k * 1.4, { y: 1.9 - Math.abs(k) * 0.4 });
      }
      this.lastFree = kind === KIND.TALL ? 0 : 1;
      this.modakLine(kind === KIND.TALL ? 0 : 2, z + 3, 4);
      return;
    }

    // Fairness: the free lane never moves more than one lane from the
    // previous row's free lane, so every pattern is reachable in time.
    const last = this.lastFree ?? 1;
    const choices = [last - 1, last, last + 1].filter((l) => l >= 0 && l <= 2);
    const free = choices[Math.floor(Math.random() * choices.length)];
    this.lastFree = free;

    if (this.gateCooldown <= 0 && r < 0.12 && diff > 0.03) {
      // Eco gate row: one green clay gate, the others plastic
      this.gateCooldown = 10;
      for (let l = 0; l < 3; l++) this.add(KIND.GATE, l, z, { good: l === free, width: 1 });
      this.modakLine(free, z - 3, 3);
      return;
    }

    const lanes = [free, ...[0, 1, 2].filter((l) => l !== free).sort(() => Math.random() - 0.5)];
    // Act 1 stays gentle (single obstacles) for its first ~60%
    const blockCount = diff < 0.2 ? 1 : r < 0.3 + diff * 0.35 ? 2 : 1;
    const obstacleKinds = [KIND.LOW, KIND.HIGH, KIND.TALL, KIND.PLASTIC];
    for (let i = 0; i < blockCount; i++) {
      const lane = lanes[i + 1];
      let kind = obstacleKinds[Math.floor(Math.random() * obstacleKinds.length)];
      // Never two tall obstacles in one row, so a neighbouring lane is always an escape
      if (i === 1 && kind === KIND.TALL) kind = Math.random() < 0.5 ? KIND.LOW : KIND.HIGH;
      this.add(kind, lane, z);
      // Modaks arc over jumpable obstacles as a hint
      if (kind === KIND.LOW || kind === KIND.PLASTIC) {
        for (let k = -1; k <= 1; k++) this.add(KIND.MODAK, lane, z + k * 1.4, { y: 1.9 - Math.abs(k) * 0.4 });
      }
    }
    const roll = Math.random();
    if (roll < 0.4) this.modakLine(free, z + 2, 4);
    else if (roll < 0.8) this.add(Math.random() < 0.5 ? KIND.DURVA : KIND.FLOWER, free, z);
    else if (roll < (act === 0 ? 0.94 : 0.86) && opts.allowDiya) this.add(KIND.DIYA, free, z, { y: 0.3 }); // extra lives are more common in Act 1
    if (act === 1 && Math.random() < 0.45) this.add(KIND.RANGOLI, free, z - 6);
  }

  modakLine(lane, z, n) {
    for (let i = 0; i < n; i++) this.add(KIND.MODAK, lane, z - i * 1.6);
  }

  // ---------- Update & collision ----------
  update(dt, dz, player, handlers) {
    const px = player.x;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const it = this.active[i];
      it.z += dz;
      it.t += dt;
      const o = it.obj;
      o.position.z = it.z;

      // Idle animation
      if (it.kind === KIND.MODAK || it.kind === KIND.DURVA || it.kind === KIND.FLOWER) {
        o.position.y = it.baseY + Math.sin(it.t * 3) * 0.12;
        if (o.userData.spin) o.userData.spin.rotation.y += dt * 2.5;
        // Magnet pull during Vighnaharta Mode
        if (player.magnet && it.z > -14 && it.z < 1) {
          o.position.x += (px - o.position.x) * Math.min(1, dt * 6);
          it.magnetX = o.position.x;
        }
      } else if (it.kind === KIND.DIYA && o.userData.flame) {
        o.userData.flame.scale.y = 1 + Math.sin(it.t * 20) * 0.2;
      } else if (it.kind === KIND.HIGH && o.userData.swing) {
        o.userData.swing.rotation.x = Math.sin(it.t * 3) * 0.15;
      } else if (it.kind === KIND.RANGOLI && it.lit) {
        o.userData.tile.material.emissiveIntensity = Math.max(0.15, o.userData.tile.material.emissiveIntensity - dt * 0.6);
      }

      // Vighnaharta: obstacles ahead melt into flower petals
      if (player.vighna && it.alive && this.isObstacle(it) && it.z > -30 && it.z < 2) {
        handlers.onDissolve(it);
        this.remove(i);
        continue;
      }

      // Collision
      if (it.alive && it.z > -0.9 && it.z < 0.9) {
        const ix = it.magnetX ?? o.position.x;
        const sameLane = Math.abs(ix - px) < (it.kind === KIND.GATE ? 1.0 : 0.95);
        if (sameLane) {
          if (it.kind === KIND.MODAK || it.kind === KIND.DURVA || it.kind === KIND.FLOWER || it.kind === KIND.DIYA) {
            const itemY = o.position.y;
            if (Math.abs(itemY - (player.y + 0.6)) < 1.3) { handlers.onCollect(it); this.remove(i); continue; }
          } else if (it.kind === KIND.RANGOLI) {
            if (!it.lit) { it.lit = true; o.userData.tile.material.emissiveIntensity = 1.6; handlers.onRangoli(it); }
          } else if (it.kind === KIND.GATE) {
            it.alive = false; handlers.onGate(it);
          } else {
            const clear =
              ((it.kind === KIND.LOW || it.kind === KIND.PLASTIC) && player.y > 0.62) ||
              (it.kind === KIND.HIGH && player.sliding);
            if (!clear && !player.invulnerable) { it.alive = false; handlers.onHit(it); }
            else if (clear && !it.passed) { it.passed = true; handlers.onDodge?.(it); }
          }
        }
      }

      // Remove things once they pass Mushak so they never block the camera
      if (it.z > (it.kind === KIND.GATE ? 1.2 : 2.5)) this.remove(i);
    }
  }

  isObstacle(it) {
    return it.kind === KIND.LOW || it.kind === KIND.HIGH || it.kind === KIND.TALL || it.kind === KIND.PLASTIC;
  }

  remove(i) {
    const it = this.active[i];
    this.scene.remove(it.obj);
    this.active.splice(i, 1);
  }

  clear() {
    for (const it of this.active) this.scene.remove(it.obj);
    this.active.length = 0;
  }
}
