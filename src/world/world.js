import * as THREE from 'three';
import {
  roadTexture, facadeTexture, buntingTexture, signTexture, glowTexture, waterNormalish,
} from './textures.js';
import { Festive } from './festive.js';

// The world scrolls toward the camera while Mushak stays near z = 0.
// Scenery is built from recycled "segments" so memory stays flat no matter
// how long you play. Each act has its own lighting mood and decorations.

export const LANE = 2.2;
const SEG_LEN = 16;
const SEG_COUNT = 12;

const ENVS = [
  { // Act 1: Bazaar at Dawn
    top: '#5f86d8', mid: '#ffae7a', bottom: '#ffe0a8', fog: '#f2b48c', near: 35, far: 150,
    sun: '#ffd6a8', sunI: 2.6, hemiSky: '#ffe2c0', hemiGround: '#7a5040', hemiI: 1.1,
    road: '#ffffff', walk: '#c9a27e', ground: '#a8744c', stars: 0, exposure: 1.0, emissive: 0.35,
  },
  { // Act 2: Pandal Nights
    top: '#07041a', mid: '#2e0f48', bottom: '#8c2b5e', fog: '#2a0e3a', near: 22, far: 120,
    sun: '#9aa8ff', sunI: 0.7, hemiSky: '#7a58b8', hemiGround: '#2a1020', hemiI: 0.75,
    road: '#b9a3c7', walk: '#6f4f7a', ground: '#3a2140', stars: 0.8, exposure: 1.2, emissive: 1.6,
  },
  { // Act 3: Visarjan by the Sea
    top: '#040720', mid: '#15245e', bottom: '#e0703a', fog: '#1c2350', near: 28, far: 150,
    sun: '#b4c6ff', sunI: 0.9, hemiSky: '#5a6ac0', hemiGround: '#2a1a30', hemiI: 0.8,
    road: '#e3c9a6', walk: '#8a7258', ground: '#6a5040', stars: 1, exposure: 1.2, emissive: 1.8,
  },
];

const skyVert = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const skyFrag = `
  uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBottom; uniform float uStars; uniform float uTime;
  varying vec3 vDir;
  float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  void main(){
    float h = vDir.y;
    vec3 col = h > 0.08 ? mix(uMid, uTop, smoothstep(0.08, 0.6, h)) : mix(uBottom, uMid, smoothstep(-0.05, 0.08, h));
    // Stars
    vec3 cell = floor(vDir * 180.0);
    float s = hash(cell);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 50.0);
    col += vec3(1.0, 0.95, 0.85) * step(0.9975, s) * uStars * smoothstep(0.1, 0.5, h) * tw;
    gl_FragColor = vec4(col, 1.0);
  }`;

const waterVert = `
  uniform float uTime; varying vec2 vUv; varying float vWave;
  void main(){
    vUv = uv; vec3 p = position;
    float w = sin(p.x*0.35 + uTime*1.3)*0.18 + sin(p.y*0.5 - uTime*0.9)*0.12;
    p.z += w; vWave = w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
  }`;
const waterFrag = `
  uniform float uTime; uniform vec3 uDeep; uniform vec3 uGlow; uniform float uOpacity; uniform sampler2D uMap; uniform float uScroll;
  varying vec2 vUv; varying float vWave;
  void main(){
    vec3 ripple = texture2D(uMap, vUv*vec2(6.0,20.0) + vec2(uTime*0.02, uScroll)).rgb;
    vec3 col = mix(uDeep, uGlow, smoothstep(0.0, 1.0, vUv.x) * 0.55);
    col += ripple * 0.35 + vWave * 0.3;
    // shimmering reflection path of the moon / lights
    float path = exp(-pow((vUv.x - 0.35) * 5.0, 2.0)) * (0.5 + 0.5 * sin(vUv.y * 400.0 + uTime * 3.0));
    col += uGlow * path * 0.35;
    gl_FragColor = vec4(col, uOpacity);
  }`;

export class World {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.time = 0;
    this.act = 0;
    this.distance = 0;
    this.envT = 1;
    this.fireworkTimer = 2;
    this.lanternTimer = 0;
    this.finale = false;

    this.env = this.cloneEnv(ENVS[0]);
    this.fromEnv = this.cloneEnv(ENVS[0]);
    this.toEnv = this.cloneEnv(ENVS[0]);

    this.buildShared();
    this.buildStatic();
    this.buildSegments();
    this.festive = new Festive(scene, particles);
    this.beat = 0;
    this.applyEnv();
  }

  cloneEnv(e) {
    const out = {};
    for (const k in e) out[k] = typeof e[k] === 'string' ? new THREE.Color(e[k]) : e[k];
    return out;
  }

  // ---------- Shared geometry & materials (created once) ----------
  buildShared() {
    const G = this.G = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
      sph: new THREE.SphereGeometry(0.5, 14, 10),
      bulb: new THREE.SphereGeometry(0.09, 8, 6),
      flower: new THREE.IcosahedronGeometry(0.16, 1),
      plane: new THREE.PlaneGeometry(1, 1),
      cone: new THREE.ConeGeometry(0.5, 1, 10),
      torusHalf: new THREE.TorusGeometry(4.6, 0.28, 10, 32, Math.PI),
      capsule: new THREE.CapsuleGeometry(0.22, 0.6, 4, 8),
      head: new THREE.SphereGeometry(0.19, 12, 10),
      kandil: new THREE.OctahedronGeometry(0.32, 0),
    };
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
    this.M = {
      wood: std(0x7a4a2a),
      pole: std(0x3a2a22, { metalness: 0.4, roughness: 0.5 }),
      gold: std(0xffc24a, { metalness: 0.85, roughness: 0.3, emissive: 0x442200 }),
      marigold: std(0xff9a00, { emissive: 0x552200, roughness: 0.6 }),
      marigoldY: std(0xffd000, { emissive: 0x443300, roughness: 0.6 }),
      leaf: std(0x2f8f3a, { roughness: 0.7 }),
      trunk: std(0x6a4a30),
      white: std(0xfff4e0),
      rail: std(0xdad2c8, { metalness: 0.2 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc060, emissiveIntensity: 1 }),
      bunting: new THREE.MeshStandardMaterial({ map: buntingTexture(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.4, roughness: 0.9 }),
      sign: new THREE.MeshStandardMaterial({ map: signTexture('Ganpati Bappa Morya'), emissive: 0xffffff, emissiveMap: signTexture('Ganpati Bappa Morya'), emissiveIntensity: 0.4 }),
      glow: new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
    this.bulbMats = [0xff3355, 0xffcc00, 0x33ff88, 0x33aaff, 0xff66ff, 0xff8800].map((c) =>
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5 }));
    // One shared material for every string of lights (pulses with the beat)
    this.stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.awningMats =[['#e8262b', '#fff3d6'], ['#ff8a00', '#ffe066'], ['#1b9e5a', '#fff3d6'], ['#8e2de2', '#ffd66b']].map(([a, b]) => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32;
      const g = c.getContext('2d');
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, 32); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 });
    });
    const hues = [8, 28, 45, 175, 200, 320, 280, 350];
    this.dayFacades = hues.map((h) => new THREE.MeshStandardMaterial({ map: facadeTexture(h, false), roughness: 0.9 }));
    this.nightFacades = hues.map((h) => {
      const t = facadeTexture(h, true);
      return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.9 });
    });
    this.clothMats = [0xe8262b, 0xff8a00, 0xffd000, 0x2e86de, 0x10ac84, 0xf368e0, 0xffffff].map((c) => std(c, { roughness: 0.9 }));
    this.skinMat = std(0x8a5a3c);
    this.hairMat = std(0x1a1010);
  }

  // ---------- Things that never move ----------
  buildStatic() {
    const s = this.scene;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uStars: { value: 0 }, uTime: { value: 0 } },
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), this.skyMat);
    s.add(this.sky);
    s.fog = new THREE.Fog(0xffffff, 30, 150);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.position.set(-6, 14, 4);
    this.sun.target.position.set(0, 0, -6);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -8; sc.right = 8; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 40;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    s.add(this.sun, this.sun.target);

    // Warm light that follows Mushak so he always pops, even at night
    this.rim = new THREE.PointLight(0xffb060, 0, 9, 1.6);
    this.rim.position.set(0, 2.5, 2.5);
    s.add(this.rim);

    // Road
    this.roadTex = roadTexture();
    this.roadTex.repeat.set(1, 30);
    this.roadMat = new THREE.MeshStandardMaterial({ map: this.roadTex, roughness: 0.85 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(LANE * 3 + 0.8, 240), this.roadMat);
    road.rotation.x = -Math.PI / 2; road.position.z = -100; road.receiveShadow = true;
    s.add(road);

    this.walkMat = new THREE.MeshStandardMaterial({ color: 0xc9a27e, roughness: 0.9 });
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(this.G.box, this.walkMat);
      walk.scale.set(3, 0.3, 240); walk.position.set(side * (LANE * 1.5 + 0.4 + 1.5), 0.15, -100);
      walk.receiveShadow = true;
      s.add(walk);
      const curb = new THREE.Mesh(this.G.box, this.M.white);
      curb.scale.set(0.2, 0.34, 240); curb.position.set(side * (LANE * 1.5 + 0.5), 0.17, -100);
      s.add(curb);
    }
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0xa8744c, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), this.groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, -150);
    s.add(ground);

    // Sea for Act 3 (hidden until then)
    const wtex = waterNormalish();
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uDeep: { value: new THREE.Color(0x0a1d3a) }, uGlow: { value: new THREE.Color(0xff9a55) },
        uOpacity: { value: 0 }, uMap: { value: wtex }, uScroll: { value: 0 },
      },
      vertexShader: waterVert, fragmentShader: waterFrag, transparent: true,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(260, 300, 40, 40), this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(137, 0.05, -120);
    this.water.visible = false;
    s.add(this.water);

    // Floating sky lanterns (akash kandil)
    this.lanterns = [];
    const lanternMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,230,160,1)', 'rgba(255,120,30,0.7)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 24; i++) {
      const sp = new THREE.Sprite(lanternMat);
      sp.visible = false;
      s.add(sp);
      this.lanterns.push(sp);
    }
  }

  // ---------- Recycled scenery segments ----------
  buildSegments() {
    this.segments = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const g = new THREE.Group();
      g.position.z = -i * SEG_LEN + SEG_LEN;
      this.scene.add(g);
      const seg = { group: g, index: i, dancers: [], cache: {}, dancersByAct: {}, shown: null };
      this.segments.push(seg);
      this.fillSegment(seg, 0);
    }
    this.segCounter = SEG_COUNT;
    // Build the other two acts now, while the loading screen is up, so that
    // changing act later is just a swap and never stutters.
    for (const seg of this.segments) {
      this.fillSegment(seg, 1);
      this.fillSegment(seg, 2);
      this.fillSegment(seg, 0);
    }
  }

  // Each segment builds its scenery for an act ONCE and then keeps it.
  // Recycling only swaps which act's group is attached, so no objects are
  // created while playing (rebuilding caused a visible hitch every second).
  fillSegment(seg, act) {
    if (seg.shown && seg.shown !== seg.cache[act]) {
      seg.group.remove(seg.shown);
      seg.shown = null;
    }
    if (seg.cache[act]) {
      if (seg.shown !== seg.cache[act]) seg.group.add(seg.cache[act]);
      seg.shown = seg.cache[act];
      seg.dancers = seg.dancersByAct[act];
      return;
    }

    const g = new THREE.Group();
    const dancers = [];
    const n = this.segCounter = (this.segCounter || 0) + 1;
    const r = Math.random;

    if (act === 0) {
      for (const side of [-1, 1]) {
        this.building(g, side, this.dayFacades, 0);
        if (r() < 0.7) this.stall(g, side, (r() - 0.5) * 8);
        if (r() < 0.5) this.people(g, dancers, side, 1 + Math.floor(r() * 2));
      }
      if (n % 2 === 0) this.bunting(g, 5.5 + r());
      if (n % 3 === 0) this.lampPost(g, r() < 0.5 ? -1 : 1, 0);
    } else if (act === 1) {
      for (const side of [-1, 1]) {
        this.building(g, side, this.nightFacades, 1);
        if (r() < 0.6) this.people(g, dancers, side, 2 + Math.floor(r() * 2), false, true);
        if (r() < 0.4) this.stall(g, side, (r() - 0.5) * 8);
      }
      this.stringLights(g, -SEG_LEN * 0.25, 6.2, true);
      if (n % 5 === 0) this.pandalArch(g);
      if (n % 2 === 0) this.lampPost(g, n % 4 === 0 ? -1 : 1, 1);
    } else {
      // Left: palms and a crowd carrying lanterns. Right: sea promenade.
      if (r() < 0.8) this.palm(g, -1, (r() - 0.5) * 10);
      this.people(g, dancers, -1, 3 + Math.floor(r() * 3), true);
      this.railing(g, 1);
      if (n % 2 === 0) this.lampPost(g, 1, 2);
      if (n % 3 === 0) this.stringLights(g, 0, 6.8);
      if (n % 6 === 0) this.pandalArch(g);
    }

    seg.cache[act] = g;
    seg.dancersByAct[act] = dancers;
    seg.dancers = dancers;
    seg.shown = g;
    seg.group.add(g);
  }

  mesh(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }

  building(g, side, facades, act) {
    const w = 5 + Math.random() * 3;
    const h = 7 + Math.random() * 8;
    const d = SEG_LEN - 0.6;
    const x = side * (LANE * 1.5 + 3.4 + w / 2);
    const mat = facades[Math.floor(Math.random() * facades.length)];
    const b = this.mesh(g, this.G.box, mat, x, h / 2, 0, w, h, d);
    b.receiveShadow = false;
    this.mesh(g, this.G.box, this.M.white, x, h + 0.2, 0, w + 0.4, 0.4, d + 0.2);
    // Hanging marigold garland along the facade
    for (let i = 0; i < 7; i++) {
      const fz = -d / 2 + (i + 0.5) * (d / 7);
      const sag = Math.sin((i / 6) * Math.PI) * 0.6;
      this.mesh(g, this.G.flower, i % 2 ? this.M.marigold : this.M.marigoldY, x - side * (w / 2 + 0.1), 4.2 - sag, fz, 1.6, 1.6, 1.6);
    }
    if (act === 1 && Math.random() < 0.6) {
      // A glowing lantern on the balcony
      const sp = new THREE.Sprite(this.M.glow);
      sp.scale.set(2, 2, 1);
      sp.position.set(x - side * (w / 2 + 0.3), 3.2, (Math.random() - 0.5) * 8);
      g.add(sp);
      this.mesh(g, this.G.sph, this.bulbMats[1], sp.position.x, 3.2, sp.position.z, 0.5, 0.7, 0.5);
    }
  }

  stall(g, side, z) {
    const x = side * (LANE * 1.5 + 2.4);
    this.mesh(g, this.G.box, this.M.wood, x, 0.75, z, 1.8, 1.0, 3).castShadow = true;
    const aw = this.mesh(g, this.G.plane, this.awningMats[Math.floor(Math.random() * 4)], x - side * 0.2, 2.6, z, 2.6, 3.4, 1);
    aw.rotation.set(-Math.PI / 2, 0, 0); aw.rotation.y = side * 0.35;
    for (const pz of [-1.4, 1.4]) this.mesh(g, this.G.cyl, this.M.pole, x - side * 0.8, 1.3, z + pz, 0.08, 2.6, 0.08);
    // Heaps of marigolds and a few modaks on the counter
    for (let i = 0; i < 10; i++) {
      this.mesh(g, this.G.flower, i % 3 ? this.M.marigold : this.M.marigoldY,
        x + (Math.random() - 0.5) * 1.2, 1.35 + Math.random() * 0.2, z + (Math.random() - 0.5) * 2.4, 1.4, 1.4, 1.4);
    }
  }

  people(parent, dancers, side, count, lanterns = false, drums = false) {
    for (let i = 0; i < count; i++) {
      const p = new THREE.Group();
      const x = side * (LANE * 1.5 + 1.2 + Math.random() * 1.6);
      p.position.set(x, 0.3, (Math.random() - 0.5) * SEG_LEN);
      const cloth = this.clothMats[Math.floor(Math.random() * this.clothMats.length)];
      const h = 0.85 + Math.random() * 0.25;
      this.mesh(p, this.G.capsule, cloth, 0, 0.55 * h, 0, h, h, h);
      this.mesh(p, this.G.head, this.skinMat, 0, 1.12 * h, 0);
      this.mesh(p, this.G.sph, this.hairMat, 0, 1.2 * h, 0.03, 0.36, 0.2, 0.36);
      // Arms raised in celebration
      const arm = this.mesh(p, this.G.capsule, cloth, 0.25, 0.95 * h, 0, 0.3, 0.6, 0.3);
      arm.rotation.z = -2.4;
      const arm2 = this.mesh(p, this.G.capsule, cloth, -0.25, 0.95 * h, 0, 0.3, 0.6, 0.3);
      arm2.rotation.z = 2.4;
      if (lanterns && Math.random() < 0.7) {
        const sp = new THREE.Sprite(this.M.glow);
        sp.scale.set(1.3, 1.3, 1);
        sp.position.set(0.3, 1.5 * h, 0);
        p.add(sp);
      }
      if (drums && Math.random() < 0.35) {
        // Dhol player: a red drum slung at the waist
        const drum = this.mesh(p, this.G.cyl, this.bulbMats[0], 0, 0.55 * h, 0.28, 0.5, 0.6, 0.5);
        drum.rotation.z = Math.PI / 2;
      }
      p.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      p.userData.phase = Math.random() * 6.28;
      p.userData.arms = [arm, arm2];
      parent.add(p);
      dancers.push(p);
    }
  }

  bunting(g, y) {
    const b = this.mesh(g, this.G.plane, this.M.bunting, 0, y, 0, 13, 0.7, 1);
    this.M.bunting.map.repeat.set(3, 1);
    b.rotation.y = 0;
  }

  lampPost(g, side, act) {
    const x = side * (LANE * 1.5 + 1.3);
    this.mesh(g, this.G.cyl, this.M.pole, x, 2.2, 0, 0.12, 4.4, 0.12);
    this.mesh(g, this.G.box, this.M.pole, x - side * 0.5, 4.4, 0, 1.1, 0.08, 0.08);
    this.mesh(g, this.G.sph, this.M.lamp, x - side * 1.0, 4.2, 0, 0.45, 0.35, 0.45);
    if (act > 0) {
      const sp = new THREE.Sprite(this.M.glow);
      sp.scale.set(4, 4, 1); sp.position.set(x - side * 1.0, 4.2, 0);
      g.add(sp);
    }
  }

  stringLights(g, z, y, kandils = false) {
    const count = 22;
    const inst = new THREE.InstancedMesh(this.G.bulb, this.stringMat, count);
    const colors = [0xff3355, 0xffcc00, 0x33ff88, 0x33aaff, 0xff66ff];
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const sagAt = (k) => Math.sin(k * Math.PI) * 1.4;
    for (let i = 0; i < count; i++) {
      const k = i / (count - 1);
      m.makeTranslation(-6 + k * 12, y - sagAt(k), z);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, c.setHex(colors[i % colors.length]).multiplyScalar(2.2));
    }
    g.add(inst);
    if (kandils) {
      // Akash kandil star lanterns hanging from the string
      for (const k of [0.25, 0.5, 0.75]) {
        const x = -6 + k * 12;
        const ly = y - sagAt(k) - 0.7;
        const lantern = this.mesh(g, this.G.kandil, this.bulbMats[Math.floor(Math.random() * this.bulbMats.length)], x, ly, z, 1, 1.3, 1);
        lantern.rotation.y = Math.random();
        const sp = new THREE.Sprite(this.M.glow);
        sp.scale.set(2.2, 2.2, 1); sp.position.set(x, ly, z);
        g.add(sp);
      }
    }
  }

  pandalArch(g) {
    for (const side of [-1, 1]) {
      this.mesh(g, this.G.box, this.M.gold, side * 4.6, 2.6, 0, 0.6, 5.2, 0.6).castShadow = true;
      this.mesh(g, this.G.cone, this.bulbMats[1], side * 4.6, 5.6, 0, 0.9, 0.9, 0.9);
    }
    const arch = this.mesh(g, this.G.torusHalf, this.M.gold, 0, 5.2, 0);
    arch.scale.set(1, 0.55, 1);
    // Bulbs along the arch
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      this.mesh(g, this.G.bulb, this.bulbMats[i % this.bulbMats.length], Math.cos(a) * 4.6, 5.2 + Math.sin(a) * 4.6 * 0.55, 0.3, 1.8, 1.8, 1.8);
    }
    const sign = this.mesh(g, this.G.plane, this.M.sign, 0, 6.9, 0.2, 4.4, 1.1, 1);
    sign.rotation.y = 0;
    const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = 0.1; g.add(back);
  }

  palm(g, side, z) {
    const x = side * (LANE * 1.5 + 4.5 + Math.random() * 3);
    const trunk = new THREE.Group();
    trunk.position.set(x, 0, z);
    g.add(trunk);
    let px = 0, py = 0;
    for (let i = 0; i < 6; i++) {
      this.mesh(trunk, this.G.cyl, this.M.trunk, px, py + 0.6, 0, 0.35 - i * 0.03, 1.25, 0.35 - i * 0.03);
      py += 1.15; px += side * -0.12 * i * 0.3;
    }
    for (let i = 0; i < 7; i++) {
      const leaf = this.mesh(trunk, this.G.cone, this.M.leaf, px, py + 0.2, 0, 0.5, 3, 0.12);
      leaf.rotation.set(0, (i / 7) * Math.PI * 2, 1.9);
      leaf.translateY(1.3);
    }
  }

  railing(g, side) {
    const x = side * (LANE * 1.5 + 3.2);
    this.mesh(g, this.G.box, this.M.rail, x, 1.0, 0, 0.12, 0.12, SEG_LEN);
    this.mesh(g, this.G.box, this.M.rail, x, 0.55, 0, 0.08, 0.08, SEG_LEN);
    for (let i = 0; i < 4; i++) this.mesh(g, this.G.box, this.M.rail, x, 0.5, -SEG_LEN / 2 + i * 4 + 2, 0.12, 1, 0.12);
    // Sand strip between promenade and sea
    this.mesh(g, this.G.box, this.M.white, x + side * 3, -0.02, 0, 6, 0.05, SEG_LEN).material = this.groundMat;
  }

  // ---------- Act transitions ----------
  setAct(act, instant = false) {
    this.act = act;
    this.fromEnv = this.cloneEnvFromCurrent();
    this.toEnv = this.cloneEnv(ENVS[act]);
    this.envT = instant ? 1 : 0;
    if (instant) { this.env = this.cloneEnv(ENVS[act]); this.applyEnv(); }
    this.water.visible = act === 2;
    if (instant) this.segments.forEach((s) => this.fillSegment(s, act));
  }

  cloneEnvFromCurrent() {
    const o = {};
    for (const k in this.env) o[k] = this.env[k] instanceof THREE.Color ? this.env[k].clone() : this.env[k];
    return o;
  }

  applyEnv() {
    const e = this.env;
    this.skyMat.uniforms.uTop.value.copy(e.top);
    this.skyMat.uniforms.uMid.value.copy(e.mid);
    this.skyMat.uniforms.uBottom.value.copy(e.bottom);
    this.skyMat.uniforms.uStars.value = e.stars;
    this.scene.fog.color.copy(e.fog);
    this.scene.fog.near = e.near; this.scene.fog.far = e.far;
    this.sun.color.copy(e.sun); this.sun.intensity = e.sunI;
    this.hemi.color.copy(e.hemiSky); this.hemi.groundColor.copy(e.hemiGround); this.hemi.intensity = e.hemiI;
    this.roadMat.color.copy(e.road);
    this.walkMat.color.copy(e.walk);
    this.groundMat.color.copy(e.ground);
    this.rim.intensity = e.stars * 6;
    this.M.lamp.emissiveIntensity = e.emissive;
    this.nightFacades.forEach((m) => { m.emissiveIntensity = 0.25 + e.stars * 0.4; });
    this.exposure = e.exposure;
  }

  // ---------- Per-frame ----------
  update(dt, dz) {
    this.time += dt;
    this.distance += dz;

    // Festival lights pulse with the dhol beat (mostly visible at night)
    const pulse = this.beat || 0;
    const night = this.env.stars;
    this.stringMat.color.setScalar(0.7 + (1 - night) * 0.3 + pulse * 0.7 * night);
    for (const mat of this.bulbMats) mat.emissiveIntensity = 1.1 + pulse * 1.4 * night;
    this.M.lamp.emissiveIntensity = this.env.emissive * (1 + 0.3 * pulse * night);
    this.festive.update(dt, dz, this.act, pulse, night);

    if (this.envT < 1) {
      this.envT = Math.min(1, this.envT + dt / 3);
      const k = this.envT * this.envT * (3 - 2 * this.envT);
      for (const key in this.toEnv) {
        const a = this.fromEnv[key], b = this.toEnv[key];
        if (a instanceof THREE.Color) this.env[key].copy(a).lerp(b, k);
        else this.env[key] = a + (b - a) * k;
      }
      this.applyEnv();
    }
    this.skyMat.uniforms.uTime.value = this.time;

    // Scroll road texture and water
    this.roadTex.offset.y += dz / 8;
    this.waterMat.uniforms.uTime.value = this.time;
    this.waterMat.uniforms.uScroll.value += dz / 60;
    const wTarget = this.act === 2 ? 1 : 0;
    this.waterMat.uniforms.uOpacity.value += (wTarget - this.waterMat.uniforms.uOpacity.value) * Math.min(1, dt * 1.5);

    // Move segments; recycle those behind the camera to the far end
    let farZ = Infinity;
    for (const s of this.segments) farZ = Math.min(farZ, s.group.position.z);
    for (const s of this.segments) {
      s.group.position.z += dz;
      if (s.group.position.z > SEG_LEN * 1.5) {
        s.group.position.z = farZ - SEG_LEN + dz;
        farZ = s.group.position.z;
        this.fillSegment(s, this.act);
      }
      // Dancing crowd
      for (const p of s.dancers) {
        const ph = this.time * 6 + p.userData.phase;
        p.position.y = 0.3 + Math.abs(Math.sin(ph)) * 0.18;
        p.userData.arms[0].rotation.z = -2.4 + Math.sin(ph) * 0.4;
        p.userData.arms[1].rotation.z = 2.4 - Math.sin(ph) * 0.4;
      }
    }

    // Sky lanterns drift upward at night
    if (this.env.stars > 0.3) {
      this.lanternTimer -= dt;
      if (this.lanternTimer < 0) {
        this.lanternTimer = 0.6;
        const l = this.lanterns.find((x) => !x.visible);
        if (l) {
          l.visible = true;
          l.position.set((Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 25), 2 + Math.random() * 4, -40 - Math.random() * 80);
          l.userData.v = 0.8 + Math.random() * 0.8;
          l.scale.setScalar(1.2 + Math.random());
        }
      }
    }
    for (const l of this.lanterns) {
      if (!l.visible) continue;
      l.position.y += l.userData.v * dt;
      l.position.x += Math.sin(this.time + l.position.y) * dt * 0.3;
      l.position.z += dz * 0.6;
      if (l.position.y > 45 || l.position.z > 10) l.visible = false;
    }

    // Fireworks over the sea in Act 3 (and a few in Act 2)
    if (this.act >= 1 && this.particles) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer < 0) {
        this.fireworkTimer = this.act === 2 ? 1.2 + Math.random() * 1.5 : 3 + Math.random() * 3;
        const x = (this.act === 2 ? 1 : (Math.random() < 0.5 ? -1 : 1)) * (15 + Math.random() * 30);
        this.particles.fireworks.launch(x, -70 - Math.random() * 50, 18 + Math.random() * 14, () => this.onFirework?.());
      }
    }
  }
}
