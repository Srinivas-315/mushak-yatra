import * as THREE from 'three';

// Every texture in the game is painted at load time on a <canvas>.
// Nothing is downloaded, so the game loads fast and has no licence issues.

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

// Soft radial glow used for diyas, lanterns and halos.
export function glowTexture(inner = 'rgba(255,240,200,1)', mid = 'rgba(255,160,40,0.55)') {
  const [c, g] = canvas(128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.25, mid);
  grd.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return tex(c);
}

export function sparkTexture() {
  const [c, g] = canvas(64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return tex(c);
}

export function petalTexture() {
  const [c, g] = canvas(64);
  g.translate(32, 32);
  for (let i = 0; i < 2; i++) {
    g.rotate(Math.PI / 2);
    const grd = g.createLinearGradient(0, -28, 0, 28);
    grd.addColorStop(0, '#fff'); grd.addColorStop(1, '#ddd');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(0, 0, 11, 27, 0, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

// Seamless stone road with warm patches.
export function roadTexture(base = '#6b5a4e', line = '#f7d77a') {
  const S = 512;
  const [c, g] = canvas(S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  // Paving slabs
  const rows = 8, cols = 6;
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const off = r % 2 ? S / cols / 2 : 0;
      const x = q * S / cols + off, y = r * S / rows;
      const l = 38 + Math.random() * 14;
      g.fillStyle = `hsl(${20 + Math.random() * 12}, ${18 + Math.random() * 10}%, ${l}%)`;
      g.fillRect(x + 3, y + 3, S / cols - 6, S / rows - 6);
      if (off) g.fillRect(x + 3 - S, y + 3, S / cols - 6, S / rows - 6);
    }
  }
  // Grain
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // Lane dividers (dashed, painted)
  g.fillStyle = line; g.globalAlpha = 0.55;
  for (const x of [S / 3, (2 * S) / 3]) {
    for (let y = 0; y < S; y += 64) g.fillRect(x - 3, y + 8, 6, 36);
  }
  g.globalAlpha = 1;
  const t = tex(c, true);
  return t;
}

export function sandTexture() {
  const S = 256;
  const [c, g] = canvas(S);
  g.fillStyle = '#d9b27a'; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 36;
    img.data[i] += n; img.data[i + 1] += n * 0.9; img.data[i + 2] += n * 0.7;
  }
  g.putImageData(img, 0, 0);
  return tex(c, true);
}

// Symmetric rangoli drawn with polar repetition.
export function rangoliTexture(seed = 1) {
  const S = 512;
  const [c, g] = canvas(S);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const palettes = [
    ['#ff2d55', '#ffcc00', '#ff7a00', '#ffffff', '#2ecc71', '#8e44ad'],
    ['#00b4d8', '#ff006e', '#ffbe0b', '#fb5607', '#ffffff', '#8338ec'],
    ['#e63946', '#f1c40f', '#ffffff', '#16a085', '#ff6f00', '#6a1b9a'],
  ];
  const pal = palettes[seed % palettes.length];
  g.translate(S / 2, S / 2);
  g.fillStyle = 'rgba(0,0,0,0)';
  const rings = 5;
  for (let r = rings; r >= 1; r--) {
    const petals = [8, 12, 16][Math.floor(rnd() * 3)];
    const rad = (r / rings) * (S / 2 - 8);
    const col = pal[r % pal.length];
    // Filled disc base
    g.beginPath(); g.arc(0, 0, rad * 0.98, 0, Math.PI * 2);
    g.fillStyle = pal[(r + 2) % pal.length]; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
    for (let i = 0; i < petals; i++) {
      g.save();
      g.rotate((i / petals) * Math.PI * 2);
      g.beginPath();
      g.moveTo(0, rad * 0.35);
      g.quadraticCurveTo(rad * 0.28, rad * 0.7, 0, rad);
      g.quadraticCurveTo(-rad * 0.28, rad * 0.7, 0, rad * 0.35);
      g.fillStyle = col; g.fill();
      g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
      // Dots
      g.beginPath(); g.arc(0, rad * 0.9, rad * 0.03 + 2, 0, Math.PI * 2);
      g.fillStyle = '#fff'; g.fill();
      g.restore();
    }
  }
  g.beginPath(); g.arc(0, 0, S * 0.07, 0, Math.PI * 2); g.fillStyle = '#ffcc00'; g.fill();
  g.beginPath(); g.arc(0, 0, S * 0.035, 0, Math.PI * 2); g.fillStyle = '#e8262b'; g.fill();
  return tex(c);
}

// Painted building facade with shuttered windows.
export function facadeTexture(hue, lit = false) {
  const W = 256, H = 512;
  const [c, g] = canvas(W, H);
  g.fillStyle = `hsl(${hue}, 55%, ${lit ? 30 : 58}%)`; g.fillRect(0, 0, W, H);
  // Weathering
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 30, 2 + Math.random() * 30);
  }
  // Floor bands
  for (let y = 120; y < H; y += 128) {
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y, W, 8);
  }
  // Windows
  for (let fy = 0; fy < 4; fy++) {
    for (let fx = 0; fx < 2; fx++) {
      const x = 36 + fx * 120, y = 24 + fy * 128;
      const on = lit && Math.random() > 0.3;
      g.fillStyle = on ? `hsl(${35 + Math.random() * 15}, 100%, ${60 + Math.random() * 15}%)` : '#2b2238';
      g.fillRect(x, y, 64, 80);
      g.fillStyle = `hsl(${(hue + 160) % 360}, 45%, 35%)`;
      g.fillRect(x - 10, y, 10, 80); g.fillRect(x + 64, y, 10, 80);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4; g.strokeRect(x, y, 64, 80);
      g.beginPath(); g.moveTo(x + 32, y); g.lineTo(x + 32, y + 80); g.stroke();
    }
  }
  return tex(c);
}

// Sky gradient on a big sphere.
export function skyTexture(top, mid, bottom) {
  const [c, g] = canvas(8, 512);
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, top); grd.addColorStop(0.55, mid); grd.addColorStop(1, bottom);
  g.fillStyle = grd; g.fillRect(0, 0, 8, 512);
  return tex(c);
}

// Toran (festive bunting) strip.
export function buntingTexture() {
  const W = 512, H = 64;
  const [c, g] = canvas(W, H);
  const cols = ['#ff2d55', '#ffcc00', '#2ecc71', '#ff7a00', '#8e44ad', '#00b4d8'];
  for (let i = 0; i < 12; i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.moveTo(i * 43, 0); g.lineTo(i * 43 + 40, 0); g.lineTo(i * 43 + 20, 58); g.fill();
  }
  return tex(c, true);
}

// Text sign (used for shop boards and the finale).
export function signTexture(text, bg = '#b3261e', fg = '#ffd66b') {
  const W = 512, H = 128;
  const [c, g] = canvas(W, H);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = fg; g.font = 'bold 60px "Baloo 2", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, W / 2, H / 2 + 4);
  return tex(c);
}

export function waterNormalish() {
  const S = 256;
  const [c, g] = canvas(S);
  g.fillStyle = '#123a5c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(160,210,255,${Math.random() * 0.25})`;
    g.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * S, y = Math.random() * S, w = 10 + Math.random() * 40;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke();
  }
  return tex(c, true);
}
