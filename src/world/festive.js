import * as THREE from 'three';
import { glowTexture } from './textures.js';

// Night-time festival atmosphere layered on top of the street scenery:
//  - Act 2 & 3: moon, sweeping pandal spotlight beams that pulse with the dhol
//  - Act 3: city skyline across the bay, floating diyas and lantern boats on
//    the sea, and clouds of gulal (coloured powder) from the procession crowd.

export class Festive {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.t = 0;
    this.gulalBeat = 0;
    this.build();
  }

  build() {
    const glow = glowTexture('rgba(255,245,215,1)', 'rgba(255,200,120,0.5)');

    // ---------- Moon ----------
    this.moon = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(9, 40),
      new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false, depthWrite: false }),
    );
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,250,230,0.9)', 'rgba(180,200,255,0.25)'),
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.set(70, 70, 1);
    this.moon.add(halo, disc);
    this.moon.position.set(-80, 85, -260);
    this.moon.lookAt(0, 0, 0);
    this.moon.visible = false;
    this.scene.add(this.moon);

    // ---------- Spotlight beams from distant pandals ----------
    this.beams = [];
    const beamGeo = new THREE.CylinderGeometry(3.2, 0.25, 70, 16, 1, true);
    beamGeo.translate(0, 35, 0); // pivot at the base
    const beamColors = [0xffc040, 0xff4fa0, 0x40c0ff, 0xffe080, 0x9a6bff, 0x50ffb0];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: beamColors[i], transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      });
      const beam = new THREE.Mesh(beamGeo, mat);
      const side = i % 2 ? 1 : -1;
      beam.position.set(side * (26 + i * 7), -2, -90 - i * 22);
      beam.userData = { phase: i * 1.3, side, base: 0.07 };
      this.scene.add(beam);
      this.beams.push(beam);
    }

    // ---------- Act 3: skyline across the bay ----------
    this.bay = new THREE.Group();
    this.bay.visible = false;
    this.scene.add(this.bay);
    const count = 70;
    const towers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x141a3a, fog: false }),
      count,
    );
    const m = new THREE.Matrix4();
    const windowPts = [];
    for (let i = 0; i < count; i++) {
      const w = 5 + Math.random() * 9;
      const h = 8 + Math.random() * (i % 7 === 0 ? 45 : 22);
      const d = 5 + Math.random() * 6;
      const x = 95 + Math.random() * 70;
      const z = -110 - (i / count) * 200 + Math.random() * 6;
      m.compose(new THREE.Vector3(x, h / 2 - 1, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      towers.setMatrixAt(i, m);
      // Lit windows on the face that looks back across the water
      const n = Math.floor(h / 3);
      for (let k = 0; k < n; k++) {
        if (Math.random() < 0.45) windowPts.push(x - w / 2 - 0.2, 1 + Math.random() * (h - 2), z + (Math.random() - 0.5) * d);
      }
    }
    this.bay.add(towers);
    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute('position', new THREE.Float32BufferAttribute(windowPts, 3));
    this.bay.add(new THREE.Points(winGeo, new THREE.PointsMaterial({
      color: 0xffc36b, size: 1.1, map: glow, transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending,
    })));

    // ---------- Act 3: floating diyas on the water ----------
    const diyaCount = 70;
    this.diyaPos = new Float32Array(diyaCount * 3);
    for (let i = 0; i < diyaCount; i++) {
      this.diyaPos[i * 3] = 8.5 + Math.pow(Math.random(), 1.6) * 45;
      this.diyaPos[i * 3 + 1] = 0.35;
      this.diyaPos[i * 3 + 2] = -Math.random() * 200 + 10;
    }
    const diyaGeo = new THREE.BufferGeometry();
    diyaGeo.setAttribute('position', new THREE.BufferAttribute(this.diyaPos, 3));
    this.diyaMat = new THREE.PointsMaterial({
      color: 0xffb040, size: 1.6, map: glowTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.diyas = new THREE.Points(diyaGeo, this.diyaMat);
    this.diyas.frustumCulled = false;
    this.bay.add(this.diyas);

    // ---------- Act 3: lantern boats ----------
    this.boats = [];
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x5a3320, roughness: 0.8 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.7, side: THREE.DoubleSide });
    const lampMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 4, 10, 1, false, 0, Math.PI), hullMat);
      hull.rotation.set(Math.PI / 2, 0, Math.PI);
      b.add(hull);
      const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10, 1, true, 0, Math.PI), clothMat);
      canopy.rotation.z = Math.PI / 2; canopy.rotation.y = Math.PI / 2; canopy.position.y = 0.6;
      b.add(canopy);
      const lamp = new THREE.Sprite(lampMat);
      lamp.scale.set(3, 3, 1); lamp.position.set(0, 1.6, 1.4);
      b.add(lamp);
      b.position.set(16 + Math.random() * 40, 0.1, -30 - i * 34);
      b.rotation.y = Math.random() * Math.PI;
      b.userData.phase = Math.random() * 6;
      this.bay.add(b);
      this.boats.push(b);
    }
  }

  // beat: 1 exactly on a dhol beat, decaying toward 0 between beats
  update(dt, dz, act, beat, night) {
    this.t += dt;
    const isNight = act >= 1;
    this.moon.visible = isNight;
    this.bay.visible = act === 2;

    // Beams sweep slowly and flare on each beat
    for (const b of this.beams) {
      const u = b.userData;
      const target = isNight ? u.base + beat * 0.07 : 0;
      b.material.opacity += (target - b.material.opacity) * Math.min(1, dt * 8);
      b.rotation.z = Math.sin(this.t * 0.45 + u.phase) * 0.45 - u.side * 0.2;
      b.rotation.x = Math.cos(this.t * 0.3 + u.phase) * 0.15;
      b.visible = b.material.opacity > 0.003;
    }

    if (act !== 2) return;

    // Diyas drift toward the camera with the world and flicker
    for (let i = 0; i < this.diyaPos.length; i += 3) {
      this.diyaPos[i + 2] += dz;
      if (this.diyaPos[i + 2] > 12) this.diyaPos[i + 2] -= 210;
    }
    this.diyas.geometry.attributes.position.needsUpdate = true;
    this.diyaMat.size = 1.5 + Math.sin(this.t * 13) * 0.12 + beat * 0.25;

    for (const b of this.boats) {
      b.position.z += dz;
      if (b.position.z > 20) { b.position.z -= 220; b.position.x = 16 + Math.random() * 40; }
      b.position.y = 0.1 + Math.sin(this.t * 1.4 + b.userData.phase) * 0.12;
      b.rotation.z = Math.sin(this.t * 1.1 + b.userData.phase) * 0.06;
    }

    // Gulal clouds burst from the procession crowd on every other beat
    if (beat > 0.95 && this.t - this.gulalBeat > 0.5 && this.particles) {
      this.gulalBeat = this.t;
      if (Math.random() < 0.55) {
        const cols = [[1, 0.25, 0.6], [1, 0.8, 0.1], [0.3, 1, 0.45], [1, 0.45, 0.1], [0.7, 0.35, 1]]
          .map((c) => new THREE.Color(...c));
        const pick = [cols[Math.floor(Math.random() * 5)], cols[Math.floor(Math.random() * 5)]];
        this.particles.sparks.burst(-6 - Math.random() * 2, 1.8, -18 - Math.random() * 30, 26, {
          colors: pick, speed: 2.6, up: 1, lift: 1.5, life: 1.6, size: 2.4, gravity: 0.3, drag: 1.4,
        });
      }
    }
  }
}
