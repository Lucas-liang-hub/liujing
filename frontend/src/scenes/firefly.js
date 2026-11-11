import { density, makeBackdrop, rand } from './engine.js';

const BG = ['#070b06', '#101710', '#182214'];

/** 萤火虫：预渲染光晕 sprite 后 drawImage，避免每帧创建径向渐变 */
export function createScene() {
  let ctx;
  let w = 0;
  let h = 0;
  let bg = null;
  let flies = [];
  let sprite = null;
  let time = 0;

  function buildSprite() {
    const size = 64;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const c = off.getContext('2d');
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,248,205,0.95)');
    g.addColorStop(0.25, 'rgba(247,217,138,0.55)');
    g.addColorStop(1, 'rgba(247,217,138,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return off;
  }

  function seed() {
    const count = density(w, h, 18, 58, 26000);
    flies = Array.from({ length: count }, () => ({
      x: rand(0, w),
      y: rand(h * 0.15, h * 0.95),
      vx: rand(-12, 12),
      vy: rand(-8, 8),
      size: rand(10, 26),
      pulse: rand(0.5, 1.6),
      phase: rand(0, Math.PI * 2),
      driftX: rand(0.2, 1.1),
      driftY: rand(0.2, 0.9),
    }));
  }

  return {
    init(context, width, height) {
      ctx = context;
      w = width;
      h = height;
      bg = makeBackdrop(ctx, w, h, BG);
      sprite = buildSprite();
      seed();
    },
    resize(width, height) {
      w = width;
      h = height;
      bg = makeBackdrop(ctx, w, h, BG);
      seed();
    },
    update(dt) {
      time += dt;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 远处树影
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 40) {
        ctx.lineTo(x, h - 26 - Math.sin(x * 0.012 + 1.2) * 16 - Math.cos(x * 0.031) * 9);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      for (let i = 0; i < flies.length; i += 1) {
        const f = flies[i];
        f.x += (f.vx + Math.sin(time * f.driftX + f.phase) * 16) * dt;
        f.y += (f.vy + Math.cos(time * f.driftY + f.phase) * 11) * dt;

        if (f.x < -20) f.x = w + 20;
        if (f.x > w + 20) f.x = -20;
        if (f.y < h * 0.08) f.y = h * 0.08;
        if (f.y > h - 10) f.y = h - 10;

        const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * f.pulse * 1.7 + f.phase));
        ctx.globalAlpha = Math.min(0.95, blink);
        const s = f.size * (0.8 + blink * 0.4);
        ctx.drawImage(sprite, f.x - s / 2, f.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    },
    destroy() {
      flies = [];
      sprite = null;
    },
  };
}
