import * as THREE from 'three';
import { glowTexture } from '../world/textures.js';

// Mushak is modelled entirely in code from simple shapes, then brought to
// life with procedural animation (run cycle, jump squash & stretch, slide,
// tumble, blinking, ear flops and a waving tail).

export class Mushak {
  constructor() {
    this.group = new THREE.Group();   // moves between lanes / jumps
    this.body = new THREE.Group();    // squash, lean and tumble
    this.group.add(this.body);
    this.t = 0;
    this.blinkT = 2;
    this.build();
  }

  build() {
    const fur = new THREE.MeshPhysicalMaterial({
      color: 0x8d7b73, roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xd9c7bd),
    });
    const belly = new THREE.MeshPhysicalMaterial({ color: 0xe8d6c8, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffffff) });
    const pink = new THREE.MeshStandardMaterial({ color: 0xf29ab0, roughness: 0.6 });
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0508, roughness: 0.05, clearcoat: 1 });
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const saffron = new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.55, emissive: 0x3a1200 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.9, roughness: 0.25 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.5 });
    this.materials = { fur, belly };

    const sph = (r, ws = 24, hs = 18) => new THREE.SphereGeometry(r, ws, hs);
    const add = (parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // Torso (the camera sees Mushak from behind, so the back is detailed)
    const torso = add(this.body, sph(0.42), fur, 0, 0.48, 0, 1, 0.92, 1.25);
    add(torso, sph(0.36), belly, 0, -0.12, -0.1, 0.9, 0.75, 1.05);

    // Head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.78, -0.42);
    this.body.add(this.head);
    add(this.head, sph(0.3), fur, 0, 0, 0, 1, 0.95, 1.05);
    add(this.head, sph(0.18), fur, 0, -0.06, -0.28, 0.9, 0.8, 1.3);  // snout
    add(this.head, sph(0.06, 12, 10), pink, 0, -0.03, -0.5);          // nose
    // Eyes with highlights
    for (const s of [-1, 1]) {
      const eye = add(this.head, sph(0.07, 16, 12), eyeMat, 0.14 * s, 0.07, -0.22, 1, 1.15, 1);
      add(eye, sph(0.022, 8, 6), white, 0.02 * s, 0.03, -0.05);
      (this.eyes ||= []).push(eye);
    }
    // Big round ears
    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(0.22 * s, 0.24, 0.02);
      ear.rotation.z = -0.35 * s;
      this.head.add(ear);
      add(ear, new THREE.CylinderGeometry(0.19, 0.19, 0.05, 24), fur, 0, 0.12, 0, 1, 1, 1).rotation.x = Math.PI / 2;
      add(ear, new THREE.CylinderGeometry(0.13, 0.13, 0.052, 20), pink, 0, 0.12, -0.012, 1, 1, 1).rotation.x = Math.PI / 2;
      this.ears.push(ear);
    }
    // Red tilak and a tiny golden crown: Mushak is dressed for the festival
    add(this.head, sph(0.03, 8, 6), red, 0, 0.18, -0.25, 1, 1.6, 0.5);
    const crown = add(this.head, new THREE.CylinderGeometry(0.1, 0.13, 0.1, 8, 1, true), gold, 0, 0.3, 0.02);
    crown.material.side = THREE.DoubleSide;
    add(crown, sph(0.035, 8, 6), red, 0, 0.08, 0);

    // Whiskers
    const wMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const pts = [new THREE.Vector3(0.08 * s, -0.05, -0.4), new THREE.Vector3(0.42 * s, -0.02 + (i - 1) * 0.06, -0.3)];
        this.head.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wMat));
      }
    }

    // Saffron scarf around the neck
    const scarf = add(this.body, new THREE.TorusGeometry(0.27, 0.07, 10, 24), saffron, 0, 0.68, -0.28);
    scarf.rotation.x = Math.PI / 2.4;
    this.scarfTail = add(this.body, new THREE.BoxGeometry(0.12, 0.3, 0.03), saffron, 0.12, 0.62, 0.02);

    // Potli (offering bundle) on the back
    const potli = add(this.body, sph(0.2), red, 0, 0.85, 0.28, 1, 0.9, 0.9);
    add(potli, new THREE.TorusGeometry(0.1, 0.03, 8, 16), gold, 0, 0.17, 0).rotation.x = Math.PI / 2;
    this.potli = potli;

    // Legs
    this.legs = [];
    const legGeo = new THREE.CapsuleGeometry(0.07, 0.16, 4, 8);
    for (const [x, z] of [[-0.2, -0.3], [0.2, -0.3], [-0.22, 0.3], [0.22, 0.3]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.3, z);
      this.body.add(pivot);
      add(pivot, legGeo, fur, 0, -0.14, 0);
      add(pivot, sph(0.08, 10, 8), pink, 0, -0.26, -0.04, 1, 0.6, 1.4);
      this.legs.push(pivot);
    }

    // Tail: a curved tube, re-bent every frame for a wave
    this.tailPts = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(0, 0.4 + i * 0.03, 0.5 + i * 0.12));
    this.tailCurve = new THREE.CatmullRomCurve3(this.tailPts);
    this.tail = new THREE.Mesh(new THREE.TubeGeometry(this.tailCurve, 20, 0.03, 6), pink);
    this.tail.castShadow = true;
    this.body.add(this.tail);

    // Golden aura for Vighnaharta Mode
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,250,210,1)', 'rgba(255,190,40,0.6)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
    }));
    this.aura.scale.set(3.2, 3.2, 1);
    this.aura.position.y = 0.7;
    this.group.add(this.aura);

    // Soft contact shadow blob (cheap and always visible, even on low quality)
    const blobTex = glowTexture('rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)');
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.6),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.55 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.group.add(this.shadow);

    this.body.scale.setScalar(1.05);
  }

  // state: { speed, jumpH (height above ground), sliding, tumble (0..1), vighna (bool), dt }
  update(dt, s) {
    this.t += dt;
    const runRate = 8 + s.speed * 0.35;
    const cycle = this.t * runRate;
    const airborne = s.jumpH > 0.05;

    // Legs gallop; tucked while airborne
    this.legs.forEach((leg, i) => {
      const phase = i < 2 ? 0 : Math.PI;
      const side = i % 2 ? 0.4 : 0;
      leg.rotation.x = airborne ? (i < 2 ? -0.9 : 0.9) : Math.sin(cycle + phase + side) * 0.9;
    });

    // Body bob, lean and squash / stretch
    const bob = airborne ? 0 : Math.abs(Math.sin(cycle)) * 0.07;
    let sy = 1, sxz = 1;
    if (s.sliding) { sy = 0.55; sxz = 1.25; }
    else if (airborne) { sy = 1 + Math.min(0.2, s.vy * 0.02); sxz = 1 / Math.sqrt(sy); }
    else if (s.landSquash > 0) { sy = 1 - s.landSquash * 0.3; sxz = 1 + s.landSquash * 0.18; }
    this.body.scale.set(sxz * 1.05, sy * 1.05, sxz * 1.05);
    this.body.position.y = bob;
    this.body.rotation.x = s.sliding ? 0.25 : airborne ? -s.vy * 0.03 : -0.08;
    this.body.rotation.z = -s.leanX * 0.5;

    // Tumble: forward roll when hitting an obstacle (no harm, just dizzy)
    if (s.tumble > 0) this.body.rotation.x += s.tumble * Math.PI * 2;

    // Head, ears, scarf
    this.head.rotation.y = Math.sin(this.t * 1.3) * 0.08 - s.leanX * 0.4;
    this.head.rotation.x = Math.sin(cycle * 2) * 0.04;
    this.ears.forEach((e, i) => { e.rotation.x = Math.sin(cycle + i) * 0.18 + (airborne ? 0.4 : 0); });
    this.scarfTail.rotation.x = 0.6 + Math.sin(cycle * 2) * 0.4;
    this.potli.position.y = 0.85 + Math.sin(cycle * 2 + 1) * 0.03;

    // Blink
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 0.1 : 1;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    this.eyes.forEach((e) => { e.scale.y = 1.15 * (s.tumble > 0 ? 0.2 : blink); });

    // Tail wave (rebuild the tube geometry)
    for (let i = 0; i < this.tailPts.length; i++) {
      const k = i / this.tailPts.length;
      this.tailPts[i].x = Math.sin(this.t * 7 - i * 0.7) * 0.12 * k;
      this.tailPts[i].y = 0.4 + i * 0.045 + Math.sin(this.t * 5 - i) * 0.05 * k;
    }
    this.tail.geometry.dispose();
    this.tail.geometry = new THREE.TubeGeometry(this.tailCurve, 16, 0.03 * 1, 6);

    // Aura & shadow
    // Aura blinks quickly in the last moment so the player knows it's ending
    const auraTarget = !s.vighna ? 0 : s.vighnaEnding ? (Math.sin(this.t * 28) > 0 ? 0.9 : 0.15) : 0.85 + Math.sin(this.t * 10) * 0.12;
    this.aura.material.opacity += (auraTarget - this.aura.material.opacity) * Math.min(1, dt * 6);
    this.aura.material.rotation += dt * 0.5;
    const glow = s.vighna ? 0.35 : 0;
    this.materials.fur.emissive.setRGB(glow, glow * 0.7, 0);
    this.shadow.position.y = 0.02 - s.jumpH;
    const shScale = Math.max(0.35, 1 - s.jumpH * 0.25);
    this.shadow.scale.set(shScale, shScale, 1);
    this.shadow.material.opacity = 0.55 * shScale;
  }
}
