import { CONFIG } from './config.js';
import { explodeStateAt } from './partsConfig.js';
import { sequenceState, smooth } from './timeline.js';
import { followMotion } from './motion.js';
import { MOBILE_CONFIG as M, deviceProfile } from './mobileConfig.js';

export function backgroundStateAt(progress) {
  return {
    opacity: sequenceState(progress).productOpacity * (1 - explodeStateAt(progress).weight),
    // Restore the field while the full-screen video still hides it.
    gather: smooth(.815, .865, progress) * (1 - smooth(.895, .915, progress)),
  };
}

export function createBackground(canvas, { pointer, reducedMotion, lowQuality }) {
  const ctx = canvas.getContext('2d', { alpha: true });
  let width, height, particles = [], low = lowQuality, dirty = true;
  function resize() {
    width = innerWidth; height = innerHeight;
    const responsive = deviceProfile().responsive;
    const dpr = Math.min(devicePixelRatio, low ? 1 : responsive ? M.performance.backgroundPixelRatio : 1.5);
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = responsive ? low ? M.performance.lowParticles : M.performance.particles : low ? CONFIG.performance.lowParticles : CONFIG.performance.particles;
    const spacing = Math.sqrt(width * height / count);
    let seed = 91;
    const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    particles = [];
    for (let y = spacing * .5; y < height; y += spacing) for (let x = spacing * .5; x < width; x += spacing) {
      const ox = x + (random() - .5) * spacing * .7, oy = y + (random() - .5) * spacing * .7;
      particles.push({ ox, oy, x: ox, y: oy, offsetX: 0, offsetY: 0, opacity: .15 + random() * .13, length: .7 + random() });
    }
    dirty = true;
  }
  function update(dt, progress) {
    const state = backgroundStateAt(progress), opacity = state.opacity;
    canvas.style.opacity = String(opacity);
    if (opacity < .001) {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => { p.offsetX = p.offsetY = 0; });
      dirty = true;
      return;
    }
    if (reducedMotion.matches && !dirty) return;
    ctx.clearRect(0, 0, width, height);
    const gather = reducedMotion.matches ? 0 : state.gather;
    const radius = CONFIG.performance.cursorRadius;
    ctx.strokeStyle = '#ffffff';
    for (const p of particles) {
      const baseX = p.ox + (width / 2 - p.ox) * gather * .94;
      const baseY = p.oy + (height / 2 - p.oy) * gather * .94;
      const dx = pointer.x - baseX, dy = pointer.y - baseY, distance = Math.hypot(dx, dy);
      const influence = pointer.active && !reducedMotion.matches ? Math.max(0, 1 - distance / radius) ** 2 : 0;
      p.offsetX = followMotion(p.offsetX, -dx * influence * .25, dt);
      p.offsetY = followMotion(p.offsetY, -dy * influence * .25, dt);
      p.x = baseX + p.offsetX; p.y = baseY + p.offsetY;
      ctx.globalAlpha = Math.min(1, p.opacity * (1 + progress * .15) + influence * 1.25);
      ctx.lineWidth = .7 + influence * .65;
      const angle = influence > .01 ? Math.atan2(dy, dx) : -.6;
      const length = p.length + influence * 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(angle) * length, p.y + Math.sin(angle) * length); ctx.stroke();
    }
    ctx.globalAlpha = 1; dirty = false;
  }
  resize();
  return { resize, update, reduceQuality() { low = true; resize(); } };
}
