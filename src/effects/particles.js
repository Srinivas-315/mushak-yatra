import * as THREE from 'three';

// A pooled, GPU-drawn particle system. One draw call per system no matter
// how many particles are alive. Particle motion is simulated on the CPU,
// which is plenty fast for a few thousand points.

const vert = /* glsl */`
  attribute float size;
  attribute float alpha;
  attribute vec3 pcolor;
  attribute float spin;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vSpin;
  uniform float uPixel;
  void main() {
    vAlpha = alpha; vColor = pcolor; vSpin = spin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Clamp so particles right next to the camera never cover the screen
    gl_PointSize = min(size * uPixel * (300.0 / -mv.z), 48.0 * uPixel);
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */`
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vSpin;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vSpin), s = sin(vSpin);
    uv = mat2(c, -s, s, c) * uv + 0.5;
    vec4 t = texture2D(uMap, uv);
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

export class ParticleSystem {
  constructor(max, map, additive = true) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.spinV = new Float32Array(max);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('spin', new THREE.BufferAttribute(this.spin, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uPixel: { value: 1 } },
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.density = 1;
  }

  emit(x, y, z, o = {}) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = o.vx || 0; this.vel[i3 + 1] = o.vy || 0; this.vel[i3 + 2] = o.vz || 0;
    const c = o.color || new THREE.Color(1, 1, 1);
    this.col[i3] = c.r; this.col[i3 + 1] = c.g; this.col[i3 + 2] = c.b;
    this.life[i] = this.maxLife[i] = o.life || 1;
    this.baseSize[i] = o.size || 1;
    this.grav[i] = o.gravity ?? -9;
    this.drag[i] = o.drag ?? 0.5;
    this.spin[i] = Math.random() * 6.28;
    this.spinV[i] = o.spinV ?? 0;
  }

  burst(x, y, z, n, o = {}) {
    const count = Math.max(1, Math.round(n * this.density));
    const colors = o.colors || [o.color || new THREE.Color(1, 0.8, 0.3)];
    for (let k = 0; k < count; k++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = (o.speed || 4) * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, {
        vx: Math.sin(ph) * Math.cos(th) * sp,
        vy: Math.abs(Math.cos(ph)) * sp * (o.up ?? 1) + (o.lift || 0),
        vz: Math.sin(ph) * Math.sin(th) * sp,
        color: colors[k % colors.length],
        life: (o.life || 1) * (0.6 + Math.random() * 0.6),
        size: (o.size || 1) * (0.6 + Math.random() * 0.8),
        gravity: o.gravity, drag: o.drag, spinV: (Math.random() - 0.5) * (o.spin || 0),
      });
    }
  }

  // Moves all particles along with the world (the world scrolls toward
  // the camera instead of the player moving forward).
  update(dt, worldShift = 0) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d; this.vel[i3 + 2] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d + this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt + worldShift;
      this.spin[i] += this.spinV[i] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, k * 2.5);
      this.size[i] = this.baseSize[i] * (0.5 + 0.5 * k);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.alpha.needsUpdate = a.size.needsUpdate = a.spin.needsUpdate = a.pcolor.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.alpha.fill(0); }
}

// Fireworks: rockets that rise, then burst into coloured stars.
export class Fireworks {
  constructor(sparks) {
    this.sparks = sparks;
    this.rockets = [];
    this.palette = [
      [1, 0.75, 0.2], [1, 0.25, 0.35], [0.3, 1, 0.5], [0.4, 0.7, 1], [1, 0.4, 1], [1, 1, 0.6],
    ].map((c) => new THREE.Color(...c));
  }

  launch(x, z, height = 22, onBurst) {
    this.rockets.push({ x, y: 0, z, vy: height * 1.1, target: height, onBurst });
  }

  update(dt, worldShift = 0) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.y += r.vy * dt; r.z += worldShift;
      this.sparks.emit(r.x, r.y, r.z, { color: new THREE.Color(1, 0.8, 0.5), life: 0.35, size: 0.8, gravity: -2 });
      if (r.y >= r.target) {
        const c1 = this.palette[Math.floor(Math.random() * this.palette.length)];
        const c2 = this.palette[Math.floor(Math.random() * this.palette.length)];
        this.sparks.burst(r.x, r.y, r.z, 90, { colors: [c1, c2, new THREE.Color(1, 1, 1)], speed: 12, up: 1, life: 1.6, size: 1.6, gravity: -3, drag: 1.2 });
        // burst() only sends particles upward-ish; add a downward shell too
        this.sparks.burst(r.x, r.y, r.z, 60, { colors: [c1, c2], speed: 11, up: -1, life: 1.5, size: 1.4, gravity: -3, drag: 1.2 });
        r.onBurst?.();
        this.rockets.splice(i, 1);
      }
    }
  }
}
