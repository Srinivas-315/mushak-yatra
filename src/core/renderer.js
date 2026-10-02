import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Quality tiers. "auto" picks a starting tier from the device and then
// adapts at runtime if the frame rate drops.
export const TIERS = {
  low: { pixelRatio: 1, shadows: false, bloom: false, antialias: false, shadowSize: 512, particles: 0.4 },
  medium: { pixelRatio: 1.5, shadows: true, bloom: true, antialias: false, shadowSize: 1024, particles: 0.7 },
  high: { pixelRatio: 2, shadows: true, bloom: true, antialias: true, shadowSize: 2048, particles: 1 },
};
const ORDER = ['low', 'medium', 'high'];

function guessTier() {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return cores >= 8 ? 'medium' : 'low';
  return cores >= 4 ? 'high' : 'medium';
}

export class Renderer {
  constructor(container) {
    this.container = container;
    this.mode = localStorage.getItem('my-quality') || 'auto';
    this.tierName = this.mode === 'auto' ? guessTier() : this.mode;
    this.tier = TIERS[this.tierName];

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // FPS tracking for adaptive quality (both down and back up)
    this.fpsAcc = 0; this.fpsFrames = 0; this.lowTime = 0; this.highTime = 0; this.downgrades = 0;

    this.applyTier();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  applyTier() {
    const t = this.tier;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.pixelRatio));
    this.renderer.shadowMap.enabled = t.shadows;
    this.bloom.enabled = t.bloom;
    this.resize();
    this.onTierChange?.(this.tierName, t);
  }

  setMode(mode) {
    this.mode = mode;
    localStorage.setItem('my-quality', mode);
    this.tierName = mode === 'auto' ? guessTier() : mode;
    this.tier = TIERS[this.tierName];
    this.applyTier();
  }

  cycleMode() {
    const modes = ['auto', 'low', 'medium', 'high'];
    this.setMode(modes[(modes.indexOf(this.mode) + 1) % modes.length]);
    return this.mode;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Portrait phones need a wider field of view so all 3 lanes are visible.
    this.camera.fov = aspect < 0.8 ? 78 : aspect < 1.2 ? 68 : 58;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  // Called every frame with the real frame delta. In auto mode the quality
  // drops after a few slow seconds and climbs back when the device keeps up.
  trackFps(dt) {
    if (this.mode !== 'auto') return;
    // One-off stalls (tab switch, screenshot, garbage collection) are not a
    // frame-rate problem, so they must not downgrade the graphics.
    if (dt > 0.25) { this.fpsAcc = 0; this.fpsFrames = 0; return; }

    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc < 1) return;
    const fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = 0; this.fpsFrames = 0;

    this.lowTime = fps < 40 ? this.lowTime + 1 : 0;
    this.highTime = fps > 56 ? this.highTime + 1 : 0;
    const idx = ORDER.indexOf(this.tierName);

    if (this.lowTime >= 3 && idx > 0) {
      this.tierName = ORDER[idx - 1];
      this.downgrades++;
      this.lowTime = this.highTime = 0;
      this.tier = TIERS[this.tierName];
      this.applyTier();
    } else if (idx < ORDER.length - 1 && this.highTime >= 8 * (this.downgrades + 1)) {
      // Climb back slowly, and more cautiously after each downgrade,
      // so quality never flickers up and down.
      this.tierName = ORDER[idx + 1];
      this.lowTime = this.highTime = 0;
      this.tier = TIERS[this.tierName];
      this.applyTier();
    }
  }

  render() {
    if (this.tier.bloom) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
