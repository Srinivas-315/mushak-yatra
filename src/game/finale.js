import * as THREE from 'three';
import { glowTexture } from '../world/textures.js';

// The finale: Mushak arrives at the seashore shrine for the aarti.
// Lord Ganesha is represented reverently by a radiant golden Om on a lotus
// throne inside a glowing prabhavali (halo arch). The offerings the player
// collected appear around the shrine.

function textTexture(text, font, size, color = '#fff2b0', glow = '#ffb300', w = 512, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${size}px ${font}`;
  g.shadowColor = glow; g.shadowBlur = 40;
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + size * 0.06);
  g.shadowBlur = 0;
  g.fillText(text, w / 2, h / 2 + size * 0.06);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DEVANAGARI = '"Nirmala UI", "Noto Sans Devanagari", "Kohinoor Devanagari", "Mangal", serif';

export class Finale {
  constructor(scene, particles, audio) {
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.build();
  }

  build() {
    const g = this.group;
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.9, roughness: 0.25, emissive: 0x663300, emissiveIntensity: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: 0xb3161e, roughness: 0.6 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xff8fb1, roughness: 0.5, emissive: 0x551122, emissiveIntensity: 0.4 });
    const marble = new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.4 });

    // Stepped platform
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(9 - i * 2, 0.4, 5 - i * 1.1), i === 2 ? red : marble);
      step.position.y = 0.2 + i * 0.4; step.receiveShadow = true;
      g.add(step);
    }

    // Lotus throne
    const lotus = new THREE.Group();
    lotus.position.y = 1.3;
    g.add(lotus);
    const petalGeo = new THREE.SphereGeometry(0.5, 12, 8);
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 10 : 12;
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(petalGeo, pink);
        const a = (i / n) * Math.PI * 2 + ring * 0.3;
        const r = ring ? 0.8 : 1.2;
        p.position.set(Math.cos(a) * r, 0.25 + ring * 0.25, Math.sin(a) * r);
        p.scale.set(0.45, 0.35, 1);
        p.lookAt(0, -1.5, 0);
        lotus.add(p);
      }
    }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 0.3, 24), gold);
    disc.position.y = 0.55; lotus.add(disc);

    // Prabhavali: the ornate halo arch
    const halo = new THREE.Group();
    halo.position.y = 4.2;
    g.add(halo);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.16, 12, 64), gold);
    halo.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.07, 8, 64), gold);
    halo.add(ring2);
    const flameGeo = new THREE.ConeGeometry(0.14, 0.45, 8);
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffa000, emissiveIntensity: 2 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const f = new THREE.Mesh(flameGeo, flameMat);
      f.position.set(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0);
      f.rotation.z = a - Math.PI / 2;
      halo.add(f);
    }
    this.halo = halo;

    // Radiant sun disc behind the Om
    const sunMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,220,1)', 'rgba(255,170,40,0.75)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sunGlow = new THREE.Sprite(sunMat);
    this.sunGlow.scale.set(9, 9, 1);
    this.sunGlow.position.set(0, 4.2, -0.3);
    g.add(this.sunGlow);

    // Golden Om
    const omMat = new THREE.MeshBasicMaterial({ map: textTexture('ॐ', DEVANAGARI, 380), transparent: true, depthWrite: false });
    this.om = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), omMat);
    this.om.position.set(0, 4.25, 0.1);
    g.add(this.om);

    // Light rays
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.rays = new THREE.Group();
    this.rays.position.set(0, 4.2, -0.5);
    for (let i = 0; i < 12; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 16), rayMat);
      r.rotation.z = (i / 12) * Math.PI * 2;
      r.position.set(Math.sin(-r.rotation.z) * 8, Math.cos(r.rotation.z) * 8, 0);
      this.rays.add(r);
    }
    g.add(this.rays);

    // "Shri Ganeshaya Namah" banner
    const nameMat = new THREE.MeshBasicMaterial({ map: textTexture('श्री गणेशाय नमः', DEVANAGARI, 88, '#fff6d0', '#ff8a00', 1024, 200), transparent: true, depthWrite: false });
    const name = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), nameMat);
    name.position.set(0, 8.1, 0);
    g.add(name);

    // Pillars with bells
    for (const x of [-4, 4]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 7, 12), gold);
      p.position.set(x, 3.5, -0.5); p.castShadow = true;
      g.add(p);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), gold);
      top.position.set(x, 7.2, -0.5); g.add(top);
    }

    // Diya rows on the steps
    this.diyas = [];
    const diyaMat = new THREE.MeshStandardMaterial({ color: 0xb5562a, roughness: 0.9 });
    const glow = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Group();
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.12, 10), diyaMat);
      d.add(bowl);
      const s = new THREE.Sprite(glow); s.scale.set(0.9, 0.9, 1); s.position.y = 0.18; d.add(s);
      d.position.set(-4.2 + (i % 7) * 1.4, 0.48 + (i >= 7 ? 0.4 : 0), 2.3 - (i >= 7 ? 1.05 : 0));
      d.visible = false;
      g.add(d);
      this.diyas.push(d);
    }

    // Offerings pile (filled in start())
    this.offerings = new THREE.Group();
    this.offerings.position.set(0, 1.25, 1.6);
    g.add(this.offerings);
  }

  // Returns how much the world should move this frame to glide to a stop.
  start(stats, currentSpeed) {
    this.t = 0;
    this.speed = currentSpeed;
    this.group.visible = true;
    this.group.position.set(0, 0, -70);
    this.done = false;
    this.fireworkT = 0;
    this.diyas.forEach((d) => { d.visible = false; });

    // Offerings: modaks and flowers stacked in front of the throne
    while (this.offerings.children.length) this.offerings.remove(this.offerings.children[0]);
    const modakMat = new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0x663300, emissiveIntensity: 0.5, roughness: 0.4 });
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff9a00, emissive: 0x552200, roughness: 0.6 });
    const cone = new THREE.ConeGeometry(0.16, 0.3, 10);
    const fl = new THREE.IcosahedronGeometry(0.12, 1);
    const nModak = Math.min(21, stats.modaksTotal);
    for (let i = 0; i < nModak; i++) {
      const layer = i < 10 ? 0 : i < 17 ? 1 : i < 20 ? 2 : 3;
      const inLayer = [10, 7, 3, 1][layer];
      const idx = i - [0, 10, 17, 20][layer];
      const a = (idx / inLayer) * Math.PI * 2;
      const r = [0.55, 0.38, 0.2, 0][layer];
      const m = new THREE.Mesh(cone, modakMat);
      m.position.set(Math.cos(a) * r, layer * 0.24, Math.sin(a) * r);
      this.offerings.add(m);
    }
    const nFlower = Math.min(30, stats.puja);
    for (let i = 0; i < nFlower; i++) {
      const f = new THREE.Mesh(fl, flowerMat);
      const a = Math.random() * Math.PI * 2;
      f.position.set(Math.cos(a) * (0.9 + Math.random() * 1.6), 0, Math.sin(a) * 0.5 + 0.2);
      this.offerings.add(f);
    }
  }

  update(dt, camera, mushak) {
    this.t += dt;
    const stopZ = -9;
    const remaining = stopZ - this.group.position.z;
    // Decelerate smoothly so the shrine stops just ahead of Mushak
    const target = Math.sqrt(Math.max(0, 2 * 6 * remaining));
    this.speed = Math.min(this.speed, target);
    const dz = Math.max(0, Math.min(remaining, this.speed * dt));
    this.group.position.z += dz;

    // Animate the shrine
    this.halo.rotation.z += dt * 0.15;
    this.rays.rotation.z -= dt * 0.08;
    const pulse = 1 + Math.sin(this.t * 2.5) * 0.05;
    this.sunGlow.scale.set(9 * pulse, 9 * pulse, 1);
    this.om.scale.setScalar(1 + Math.sin(this.t * 1.5) * 0.03);

    // Once arrived: light diyas one by one, aarti bells, fireworks, petals
    const arrived = remaining < 0.5;
    if (arrived) {
      if (!this.arrivedAt) { this.arrivedAt = this.t; this.audio.sfx('aarti'); this.audio.sfx('vighna'); }
      const since = this.t - this.arrivedAt;
      this.diyas.forEach((d, i) => { if (since > 0.3 + i * 0.12 && !d.visible) { d.visible = true; this.audio.sfx('petal'); } });
      this.fireworkT -= dt;
      if (this.fireworkT < 0) {
        this.fireworkT = 0.45;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.particles.fireworks.launch(side * (6 + Math.random() * 18), this.group.position.z - 20 - Math.random() * 20, 14 + Math.random() * 10, () => this.audio.sfx('firework'));
      }
      if (Math.random() < dt * 30) {
        this.particles.petals.emit((Math.random() - 0.5) * 12, 10, this.group.position.z + 4 + Math.random() * 8, {
          vx: (Math.random() - 0.5), vy: -1.5, vz: 0, gravity: -0.6, drag: 0.2, life: 6,
          size: 1.2, spinV: 3, color: new THREE.Color().setHSL(0.06 + Math.random() * 0.06, 1, 0.55),
        });
      }
      if (since > 7 && !this.done) this.done = true;
    } else {
      this.arrivedAt = null;
    }

    // Cinematic camera: rise up behind Mushak and drift to the side so we
    // see little Mushak in the foreground and the glowing shrine ahead.
    const k = Math.min(1, this.t / 4.5);
    const e = k * k * (3 - 2 * k);
    const portrait = camera.aspect < 0.8;
    const side = e * (portrait ? 2.2 : 3.6);
    const back = 6.5 + e * (portrait ? 5 : 2.5);
    camera.position.lerp(new THREE.Vector3(side, 2.6 + e * 1.4, back), Math.min(1, dt * 3));
    const shrineY = portrait ? 3.6 : 3.2;
    const look = new THREE.Vector3(side * 0.25, 1.2 + e * (shrineY - 1.2), -7 + e * (this.group.position.z + 7));
    camera.lookAt(look);

    return { dz, arrived };
  }

  hide() {
    this.group.visible = false;
    this.arrivedAt = null;
  }
}
