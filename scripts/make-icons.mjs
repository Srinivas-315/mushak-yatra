// Generates the PWA app icons as PNG files, with no image libraries:
// pixels are drawn by hand and encoded with Node's built-in zlib.
//
//   node scripts/make-icons.mjs
//
// Produces public/icons/icon-192.png, icon-512.png and apple-touch-icon-180.png

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ---------- tiny PNG encoder ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- the artwork: a golden modak on a festive glow ----------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// Smooth coverage of a shape edge, for anti-aliasing
const edge = (d, w = 0.012) => clamp01(0.5 - d / w);

function modakDistance(x, y) {
  // x,y in -1..1 with y up. A modak: round base, pinched tip.
  const yy = (y + 0.42) / 1.05;           // 0 at base, 1 at tip
  if (yy < 0 || yy > 1.08) return 1;
  const halfWidth = yy < 0.42
    ? 0.46 * Math.sqrt(1 - Math.pow((0.42 - yy) / 0.52, 2))
    : 0.46 * Math.pow(1 - (yy - 0.42) / 0.66, 0.85);
  // Gentle pleats around the sides
  const pleat = 1 + 0.045 * Math.cos(x * 22) * Math.min(1, yy * 2.2);
  return Math.abs(x) - halfWidth * pleat;
}

function pixel(u, v, size) {
  // u,v are 0..1 across the icon; convert to -1..1 with y up
  const x = (u - 0.5) * 2;
  const y = (0.5 - v) * 2;
  const r = Math.hypot(x, y);

  // Background: deep festive purple with a warm glow behind the modak
  const glow = Math.exp(-Math.pow(r * 1.35, 2));
  let R = lerp(26, 150, glow * 0.95);
  let G = lerp(11, 50, glow * 0.8);
  let B = lerp(46, 70, glow * 0.35);
  // Warm vignette edge
  const vig = clamp01((r - 0.9) * 1.4);
  R = lerp(R, 18, vig); G = lerp(G, 8, vig); B = lerp(B, 36, vig);

  // Sparkles
  for (const [sx, sy, ss] of [[-0.62, 0.55, 0.05], [0.6, 0.62, 0.042], [-0.68, -0.5, 0.036], [0.66, -0.42, 0.045], [0, 0.86, 0.04]]) {
    const d = Math.hypot(x - sx, y - sy);
    const star = Math.max(0, 1 - d / ss) ** 2 + Math.max(0, 1 - Math.abs(x - sx) / (ss * 3)) * Math.max(0, 1 - Math.abs(y - sy) / (ss * 0.35)) * 0.55
      + Math.max(0, 1 - Math.abs(y - sy) / (ss * 3)) * Math.max(0, 1 - Math.abs(x - sx) / (ss * 0.35)) * 0.55;
    const s = clamp01(star);
    R = lerp(R, 255, s); G = lerp(G, 240, s); B = lerp(B, 190, s);
  }

  // The modak itself, shaded from top-left
  const d = modakDistance(x, y);
  const cover = edge(d, 0.02);
  if (cover > 0) {
    const shade = clamp01(0.55 + 0.45 * (0.6 * (1 - (y - 0.1)) + 0.5 * (0.4 - x)));
    const mr = lerp(214, 255, shade);
    const mg = lerp(140, 226, shade);
    const mb = lerp(40, 140, shade);
    R = lerp(R, mr, cover); G = lerp(G, mg, cover); B = lerp(B, mb, cover);
    // Darker outline just inside the edge
    const outline = clamp01(1 - Math.abs(d + 0.022) / 0.02) * 0.5;
    R = lerp(R, 150, outline); G = lerp(G, 80, outline); B = lerp(B, 20, outline);
  }
  return [R, G, B, 255];
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 2; // supersampling for smooth edges
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let R = 0, G = 0, B = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [r, g, b] = pixel((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, size);
          R += r; G += g; B += b;
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      buf[i] = Math.round(R / n); buf[i + 1] = Math.round(G / n); buf[i + 2] = Math.round(B / n); buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

mkdirSync(OUT, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon-180.png', 180]]) {
  writeFileSync(join(OUT, name), render(size));
  console.log('wrote', name, size + 'x' + size);
}
